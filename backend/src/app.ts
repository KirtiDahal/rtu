import cors from "cors";
import express from "express";
import cookieParser from "cookie-parser";
import { addDays, eachDayOfInterval, endOfMonth, formatISO, startOfDay, startOfMonth } from "date-fns";
import { z } from "zod";
import { prisma } from "./db.js";
import { env } from "./config.js";
import {
  clearAuthCookies,
  compareSecret,
  cookieNames,
  hashSecret,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
} from "./auth.js";
import { requireAdmin, requireAuth } from "./middleware.js";
import { computeCyclePrediction } from "./prediction.js";
import { serializeMessage, serializeUser } from "./serializers.js";
import { getIoInstance } from "./socket.js";
import { askKnowledgeAi } from "./knowledge-ai.js";
import { ROLE_ADMIN, ROLE_GUEST, ROLE_MEMBER } from "./roles.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(40)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const periodSchema = z.object({
  startDate: z.string(),
  endDate: z.string().optional(),
  flow: z.number().int().min(1).max(5).default(3),
  notes: z.string().max(400).optional()
});

const moodSchema = z.object({
  date: z.string(),
  mood: z.number().int().min(1).max(5),
  label: z.string().min(2).max(40),
  notes: z.string().max(400).optional()
});

const symptomSchema = z.object({
  date: z.string(),
  symptoms: z.array(z.string().min(2)).min(1),
  notes: z.string().max(400).optional()
});

const sleepSchema = z.object({
  date: z.string(),
  hours: z.number().min(0).max(24),
  quality: z.number().int().min(1).max(5)
});

const profileAccountUpdateSchema = z.object({
  displayName: z.string().trim().min(2).max(40).optional(),
  email: z.string().trim().email().optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  age: z.number().int().min(10).max(60).nullable().optional(),
  location: z.string().trim().min(1).max(120).nullable().optional(),
  timezone: z.string().trim().min(1).max(80).nullable().optional(),
  avgCycleLength: z.number().int().min(15).max(60).nullable().optional(),
  notes: z.string().trim().max(600).nullable().optional()
});

const profilePasswordUpdateSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
});

const chatSchema = z.object({
  body: z.string().min(1).max(1000)
});

const monthQuerySchema = z.object({
  month: z.coerce.number().min(1).max(12).optional(),
  year: z.coerce.number().min(2020).max(2100).optional()
});

const logDateQuerySchema = z.object({
  date: z.string()
});

const knowledgeAskSchema = z.object({
  query: z.string().trim().min(3).max(300)
});

const adminMessageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional()
});

const adminChannelCreateSchema = z.object({
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(400),
  memberCount: z.number().int().min(0).max(100000).optional()
});

const adminArticleContentItemSchema = z.object({
  heading: z.string().trim().min(2).max(140),
  body: z.string().trim().min(2).max(6000)
});

const adminArticleCreateSchema = z.object({
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/),
  category: z.string().trim().min(2).max(80),
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().min(10).max(500),
  content: z.array(adminArticleContentItemSchema).min(1).max(40)
});

const adminArticleUpdateSchema = z
  .object({
    slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/).optional(),
    category: z.string().trim().min(2).max(80).optional(),
    title: z.string().trim().min(3).max(180).optional(),
    summary: z.string().trim().min(10).max(500).optional(),
    content: z.array(adminArticleContentItemSchema).min(1).max(40).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required"
  });

function toDateOnly(date: Date): string {
  return formatISO(startOfDay(date), { representation: "date" });
}

function appShell(user: ReturnType<typeof serializeUser>) {
  return {
    greeting: `Good morning, ${user.displayName.split(" ")[0]}`,
    avatarUrl: user.avatarUrl,
    roleLabel: user.roleLabel
  };
}

async function issueTokens(userId: string, email: string) {
  const accessToken = signAccessToken(userId, email);
  const refreshToken = signRefreshToken(userId, email);
  const refreshHash = await hashSecret(refreshToken);
  await prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: refreshHash } });
  return { accessToken, refreshToken };
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  return startOfDay(date);
}

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function parseDateFromQuery(query: unknown): Date {
  const parsed = logDateQuerySchema.safeParse({ date: firstQueryValue(query) });
  if (!parsed.success) {
    throw new Error("Invalid date query");
  }
  return parseDate(parsed.data.date);
}

function parseSymptomValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
}

function moodToneFromLabel(label: string): "energetic" | "neutral" | "low" {
  const normalized = label.trim().toLowerCase();
  if (
    normalized.includes("happy") ||
    normalized.includes("high energy") ||
    normalized.includes("positive") ||
    normalized.includes("great")
  ) {
    return "energetic";
  }
  if (
    normalized.includes("ok") ||
    normalized.includes("okay") ||
    normalized.includes("balanced") ||
    normalized.includes("calm")
  ) {
    return "neutral";
  }
  return "low";
}

async function getProfilePayload(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true }
  });

  if (!user) {
    throw new Error("User not found");
  }

  const profile =
    user.profile ??
    (await prisma.profile.create({
      data: { userId }
    }));

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roleLabel: user.roleLabel,
      avatarUrl: user.avatarUrl,
      isGuest: user.isGuest
    },
    profile: {
      dateOfBirth: profile.dateOfBirth ? toDateOnly(profile.dateOfBirth) : null,
      age: profile.age,
      location: profile.location,
      timezone: profile.timezone,
      avgCycleLength: profile.avgCycleLength,
      notes: profile.notes
    }
  };
}

export function createApp() {
  const app = express();
  const localOriginPattern = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }
        if (origin === env.FRONTEND_ORIGIN || localOriginPattern.test(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/auth/register", async (request, response) => {
    const payload = registerSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email: payload.data.email } });
    if (existing) {
      response.status(409).json({ message: "Email already in use" });
      return;
    }

    const passwordHash = await hashSecret(payload.data.password);
    const user = await prisma.user.create({
      data: {
        email: payload.data.email,
        passwordHash,
        displayName: payload.data.displayName,
        roleLabel: ROLE_MEMBER,
        profile: { create: {} }
      }
    });

    const tokens = await issueTokens(user.id, user.email);
    setAuthCookies(response, tokens.accessToken, tokens.refreshToken);

    const publicUser = serializeUser(user);
    response.status(201).json({ user: publicUser, appShell: appShell(publicUser) });
  });

  app.post("/auth/login", async (request, response) => {
    const payload = loginSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: payload.data.email } });
    if (!user?.passwordHash) {
      response.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const matches = await compareSecret(payload.data.password, user.passwordHash);
    if (!matches) {
      response.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const tokens = await issueTokens(user.id, user.email);
    setAuthCookies(response, tokens.accessToken, tokens.refreshToken);

    const publicUser = serializeUser(user);
    response.json({ user: publicUser, appShell: appShell(publicUser) });
  });

  app.post("/auth/guest", async (_request, response) => {
    const guest = await prisma.user.create({
      data: {
        email: `guest-${crypto.randomUUID()}@rtu.local`,
        displayName: "Anonymous Guest",
        isGuest: true,
        roleLabel: ROLE_GUEST,
        profile: { create: {} }
      }
    });

    const tokens = await issueTokens(guest.id, guest.email);
    setAuthCookies(response, tokens.accessToken, tokens.refreshToken);

    const publicUser = serializeUser(guest);
    response.status(201).json({ user: publicUser, appShell: appShell(publicUser) });
  });

  app.post("/auth/logout", async (request, response) => {
    const token = request.cookies?.[cookieNames.access] as string | undefined;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        await prisma.user.update({
          where: { id: payload.sub },
          data: { refreshTokenHash: null }
        });
      } catch {
        // no-op
      }
    }
    clearAuthCookies(response);
    response.status(204).send();
  });

  app.post("/auth/refresh", async (request, response) => {
    const refreshToken = request.cookies?.[cookieNames.refresh] as string | undefined;
    if (!refreshToken) {
      response.status(401).json({ message: "Not authenticated" });
      return;
    }

    try {
      const payload = verifyRefreshToken(refreshToken);
      if (payload.type !== "refresh") {
        clearAuthCookies(response);
        response.status(401).json({ message: "Invalid token type" });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user?.refreshTokenHash) {
        clearAuthCookies(response);
        response.status(401).json({ message: "Not authenticated" });
        return;
      }

      const matches = await compareSecret(refreshToken, user.refreshTokenHash);
      if (!matches) {
        clearAuthCookies(response);
        response.status(401).json({ message: "Invalid refresh token" });
        return;
      }

      const tokens = await issueTokens(user.id, user.email);
      setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
      response.status(204).send();
    } catch {
      clearAuthCookies(response);
      response.status(401).json({ message: "Invalid refresh token" });
    }
  });

  app.get("/auth/me", requireAuth, async (request, response) => {
    response.json({
      user: request.user,
      appShell: appShell(request.user!)
    });
  });

  app.get("/profile", requireAuth, async (request, response) => {
    const payload = await getProfilePayload(request.user!.id);
    response.json(payload);
  });

  app.put("/profile", requireAuth, async (request, response) => {
    const payload = profileAccountUpdateSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const userId = request.user!.id;
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      response.status(404).json({ message: "User not found" });
      return;
    }

    const userUpdateData: {
      displayName?: string;
      email?: string;
      avatarUrl?: string | null;
    } = {};
    if ("displayName" in payload.data && payload.data.displayName) {
      userUpdateData.displayName = payload.data.displayName;
    }
    if ("avatarUrl" in payload.data) {
      userUpdateData.avatarUrl = payload.data.avatarUrl ?? null;
    }
    if ("email" in payload.data && payload.data.email && payload.data.email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email: payload.data.email } });
      if (emailTaken && emailTaken.id !== userId) {
        response.status(409).json({ message: "Email already in use" });
        return;
      }
      userUpdateData.email = payload.data.email;
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userUpdateData
      });
    }

    const updateData: {
      dateOfBirth?: Date | null;
      age?: number | null;
      location?: string | null;
      timezone?: string | null;
      avgCycleLength?: number | null;
      notes?: string | null;
    } = {};

    const minDateOfBirth = "1900-01-01";
    const maxDateOfBirth = toDateOnly(new Date());

    if ("dateOfBirth" in payload.data) {
      if (!payload.data.dateOfBirth) {
        updateData.dateOfBirth = null;
      } else {
        if (payload.data.dateOfBirth < minDateOfBirth || payload.data.dateOfBirth > maxDateOfBirth) {
          response.status(400).json({
            message: `dateOfBirth must be between ${minDateOfBirth} and ${maxDateOfBirth}`
          });
          return;
        }
        try {
          updateData.dateOfBirth = parseDate(payload.data.dateOfBirth);
        } catch {
          response.status(400).json({ message: "Invalid dateOfBirth" });
          return;
        }
      }
    }
    if ("age" in payload.data) {
      updateData.age = payload.data.age ?? null;
    }
    if ("location" in payload.data) {
      updateData.location = payload.data.location ?? null;
    }
    if ("timezone" in payload.data) {
      updateData.timezone = payload.data.timezone ?? null;
    }
    if ("avgCycleLength" in payload.data) {
      updateData.avgCycleLength = payload.data.avgCycleLength ?? null;
    }
    if ("notes" in payload.data) {
      updateData.notes = payload.data.notes ?? null;
    }

    await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        dateOfBirth: updateData.dateOfBirth ?? null,
        age: updateData.age ?? null,
        location: updateData.location ?? null,
        timezone: updateData.timezone ?? null,
        avgCycleLength: updateData.avgCycleLength ?? null,
        notes: updateData.notes ?? null
      },
      update: updateData
    });

    const profilePayload = await getProfilePayload(userId);
    response.json(profilePayload);
  });

  app.put("/profile/password", requireAuth, async (request, response) => {
    const payload = profilePasswordUpdateSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: request.user!.id } });
    if (!user?.passwordHash) {
      response.status(400).json({ message: "Password update is unavailable for this account" });
      return;
    }

    const matches = await compareSecret(payload.data.currentPassword, user.passwordHash);
    if (!matches) {
      response.status(401).json({ message: "Current password is incorrect" });
      return;
    }

    if (payload.data.currentPassword === payload.data.newPassword) {
      response.status(400).json({ message: "New password must be different from current password" });
      return;
    }

    const passwordHash = await hashSecret(payload.data.newPassword);
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { passwordHash }
    });
    response.status(204).send();
  });

  app.delete("/profile", requireAuth, async (request, response) => {
    await prisma.user.delete({
      where: { id: request.user!.id }
    });
    clearAuthCookies(response);
    response.status(204).send();
  });

  app.get("/dashboard/summary", requireAuth, async (request, response) => {
    const userId = request.user!.id;
    const [cycles, moodLogs, sleepLogs, symptomLogs, periodLogs, recentMessages] = await Promise.all([
      prisma.cycle.findMany({ where: { userId }, orderBy: { startDate: "asc" } }),
      prisma.moodLog.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 7 }),
      prisma.sleepLog.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 7 }),
      prisma.symptomLog.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5 }),
      prisma.periodLog.findMany({ where: { userId }, orderBy: { date: "desc" }, take: 5 }),
      prisma.communityMessage.findMany({ orderBy: { createdAt: "desc" }, take: 4 })
    ]);

    const prediction = computeCyclePrediction(cycles);
    const avgSleep =
      sleepLogs.length > 0
        ? Number((sleepLogs.reduce((sum, item) => sum + item.hours, 0) / sleepLogs.length).toFixed(1))
        : 0;
    const positiveMoods = moodLogs.filter((item) => item.mood >= 4).length;
    const moodPercent = moodLogs.length ? Math.round((positiveMoods / moodLogs.length) * 100) : 0;

    response.json({
      cycleDay: prediction.currentCycleDay,
      currentPhase: prediction.currentPhase,
      phaseExplanation: prediction.phaseExplanation,
      nextPeriodDate: prediction.nextPeriodDate,
      ovulationDate: prediction.ovulationDate,
      fertileWindow: {
        start: prediction.fertileWindowStart,
        end: prediction.fertileWindowEnd
      },
      quickStats: {
        averageCycleLength: prediction.averageCycleLength,
        averageSleepHours: avgSleep,
        moodPositivityPercent: moodPercent,
        symptomsLogged: symptomLogs.length
      },
      recentActivity: [
        ...periodLogs.map((item) => ({
          type: "period",
          label: "Period logged",
          at: item.date.toISOString()
        })),
        ...moodLogs.map((item) => ({
          type: "mood",
          label: `${item.label} mood tracked`,
          at: item.date.toISOString()
        }))
      ]
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
        .slice(0, 6),
      communityTeaser: recentMessages.map(serializeMessage)
    });
  });

  app.get("/calendar", requireAuth, async (request, response) => {
    const userId = request.user!.id;
    const query = monthQuerySchema.parse(request.query);
    const today = new Date();
    const month = query.month ?? today.getMonth() + 1;
    const year = query.year ?? today.getFullYear();
    const windowStart = startOfMonth(new Date(year, month - 1, 1));
    const windowEnd = endOfMonth(windowStart);

    const [cycles, periodLogs, symptomLogs, moodLogs] = await Promise.all([
      prisma.cycle.findMany({ where: { userId }, orderBy: { startDate: "asc" } }),
      prisma.periodLog.findMany({
        where: { userId, date: { gte: windowStart, lte: windowEnd } },
        orderBy: { date: "asc" }
      }),
      prisma.symptomLog.findMany({
        where: { userId, date: { gte: windowStart, lte: windowEnd } },
        orderBy: { date: "asc" }
      }),
      prisma.moodLog.findMany({
        where: { userId, date: { gte: windowStart, lte: windowEnd } },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }]
      })
    ]);

    const prediction = computeCyclePrediction(cycles);
    const fertileRange = eachDayOfInterval({
      start: parseDate(prediction.fertileWindowStart),
      end: parseDate(prediction.fertileWindowEnd)
    }).map(toDateOnly);
    const periodSet = new Set(periodLogs.map((item) => toDateOnly(item.date)));
    const symptomByDate = new Map<string, string[]>();
    symptomLogs.forEach((item) => {
      const dateKey = toDateOnly(item.date);
      const existing = symptomByDate.get(dateKey) ?? [];
      const merged = new Set([...existing, ...parseSymptomValues(item.symptoms)]);
      symptomByDate.set(dateKey, [...merged]);
    });
    const moodByDate = new Map(
      moodLogs.map((item) => [toDateOnly(item.date), { label: item.label, tone: moodToneFromLabel(item.label) }])
    );
    const ovulation = prediction.ovulationDate;

    const days = eachDayOfInterval({ start: windowStart, end: windowEnd }).map((date) => {
      const dateKey = toDateOnly(date);
      const mood = moodByDate.get(dateKey);
      const symptoms = symptomByDate.get(dateKey) ?? [];
      return {
        date: dateKey,
        day: date.getDate(),
        isPeriodDay: periodSet.has(dateKey),
        isOvulationDay: dateKey === ovulation,
        isFertileWindow: fertileRange.includes(dateKey),
        hasSymptoms: symptoms.length > 0,
        symptoms,
        moodLabel: mood?.label ?? null,
        moodTone: mood?.tone ?? null
      };
    });

    response.json({
      month,
      year,
      prediction: {
        nextPeriodDate: prediction.nextPeriodDate,
        ovulationDate: prediction.ovulationDate,
        fertileWindowStart: prediction.fertileWindowStart,
        fertileWindowEnd: prediction.fertileWindowEnd
      },
      stats: {
        lastCycleLength: prediction.averageCycleLength,
        averagePeriodLength: periodLogs.length ? Math.max(1, Math.round(periodLogs.length / 1.2)) : 5
      },
      days
    });
  });

  app.post("/logs/period", requireAuth, async (request, response) => {
    const payload = periodSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const startDate = parseDate(payload.data.startDate);
    const endDate = payload.data.endDate ? parseDate(payload.data.endDate) : startDate;

    if (endDate < startDate) {
      response.status(400).json({ message: "endDate must be after startDate" });
      return;
    }

    const cycle = await prisma.cycle.create({
      data: {
        userId: request.user!.id,
        startDate,
        endDate,
        length: Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
      }
    });

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    await prisma.periodLog.createMany({
      data: days.map((date) => ({
        userId: request.user!.id,
        date,
        flow: payload.data.flow,
        notes: payload.data.notes
      }))
    });

    response.status(201).json({
      id: cycle.id,
      startDate: cycle.startDate.toISOString(),
      endDate: cycle.endDate?.toISOString() ?? null
    });
  });

  app.post("/logs/mood", requireAuth, async (request, response) => {
    const payload = moodSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const log = await prisma.moodLog.create({
      data: {
        userId: request.user!.id,
        date: parseDate(payload.data.date),
        mood: payload.data.mood,
        label: payload.data.label,
        notes: payload.data.notes
      }
    });
    response.status(201).json(log);
  });

  app.delete("/logs/mood", requireAuth, async (request, response) => {
    let date: Date;
    try {
      date = parseDateFromQuery(request.query.date);
    } catch {
      response.status(400).json({ message: "Invalid date query" });
      return;
    }

    await prisma.moodLog.deleteMany({
      where: {
        userId: request.user!.id,
        date
      }
    });
    response.status(204).send();
  });

  app.post("/logs/symptoms", requireAuth, async (request, response) => {
    const payload = symptomSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const log = await prisma.symptomLog.create({
      data: {
        userId: request.user!.id,
        date: parseDate(payload.data.date),
        symptoms: payload.data.symptoms,
        notes: payload.data.notes
      }
    });
    response.status(201).json(log);
  });

  app.delete("/logs/symptoms", requireAuth, async (request, response) => {
    let date: Date;
    try {
      date = parseDateFromQuery(request.query.date);
    } catch {
      response.status(400).json({ message: "Invalid date query" });
      return;
    }

    await prisma.symptomLog.deleteMany({
      where: {
        userId: request.user!.id,
        date
      }
    });
    response.status(204).send();
  });

  app.post("/logs/sleep", requireAuth, async (request, response) => {
    const payload = sleepSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const log = await prisma.sleepLog.create({
      data: {
        userId: request.user!.id,
        date: parseDate(payload.data.date),
        hours: payload.data.hours,
        quality: payload.data.quality
      }
    });
    response.status(201).json(log);
  });

  app.get("/community/channels", requireAuth, async (_request, response) => {
    const channels = await prisma.communityChannel.findMany({ orderBy: { name: "asc" } });
    response.json(
      channels.map((item) => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        description: item.description,
        memberCount: item.memberCount
      }))
    );
  });

  app.get("/community/channels/:id/messages", requireAuth, async (request, response) => {
    const channelId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const messages = await prisma.communityMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" }
    });
    response.json(messages.map(serializeMessage));
  });

  app.post("/community/channels/:id/messages", requireAuth, async (request, response) => {
    const channelId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const payload = chatSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const channel = await prisma.communityChannel.findUnique({ where: { id: channelId } });
    if (!channel) {
      response.status(404).json({ message: "Channel not found" });
      return;
    }

    const message = await prisma.communityMessage.create({
      data: {
        channelId: channel.id,
        userId: request.user!.id,
        senderName: request.user!.displayName,
        roleLabel: request.user!.roleLabel,
        body: payload.data.body
      }
    });

    const serialized = serializeMessage(message);
    getIoInstance()?.to(channel.id).emit("community:new-message", serialized);
    response.status(201).json(serialized);
  });

  app.get("/knowledge/articles", requireAuth, async (request, response) => {
    const category = firstQueryValue(request.query.category);
    const search = firstQueryValue(request.query.search)?.toLowerCase();

    const articles = await prisma.knowledgeArticle.findMany({
      where: {
        ...(category && category !== "All" ? { category } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search } },
                { summary: { contains: search } },
                { category: { contains: search } }
              ]
            }
          : {})
      },
      orderBy: { title: "asc" }
    });

    response.json(
      articles.map((article) => ({
        slug: article.slug,
        category: article.category,
        title: article.title,
        summary: article.summary
      }))
    );
  });

  app.post("/knowledge/ask", requireAuth, async (request, response) => {
    const payload = knowledgeAskSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    if (!env.OPENROUTER_API_KEY) {
      response.status(503).json({ message: "AI assistant is not configured on the server" });
      return;
    }

    const query = payload.data.query;
    const relatedArticles = await prisma.knowledgeArticle.findMany({
      where: {
        OR: [{ title: { contains: query } }, { summary: { contains: query } }, { category: { contains: query } }]
      },
      select: {
        slug: true,
        title: true,
        summary: true,
        content: true
      },
      take: 3,
      orderBy: { updatedAt: "desc" }
    });

    try {
      const aiResponse = await askKnowledgeAi({
        apiKey: env.OPENROUTER_API_KEY,
        model: env.OPENROUTER_MODEL,
        timeoutMs: env.OPENROUTER_TIMEOUT_MS,
        appOrigin: env.FRONTEND_ORIGIN,
        query,
        articles: relatedArticles
      });

      response.json(aiResponse);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      response.status(502).json({ message: "AI assistant failed to respond. Please try again." });
    }
  });

  app.get("/knowledge/articles/:slug", requireAuth, async (request, response) => {
    const slug = Array.isArray(request.params.slug) ? request.params.slug[0] : request.params.slug;
    const article = await prisma.knowledgeArticle.findUnique({
      where: { slug }
    });

    if (!article) {
      response.status(404).json({ message: "Article not found" });
      return;
    }

    const articleTips = await prisma.knowledgeTip.findMany({
      where: { articleId: article.id },
      orderBy: { position: "asc" }
    });

    const globalTips = await prisma.knowledgeTip.findMany({
      where: { articleId: null },
      orderBy: { position: "asc" }
    });

    response.json({
      slug: article.slug,
      category: article.category,
      title: article.title,
      summary: article.summary,
      content: article.content,
      tips: [...articleTips, ...globalTips]
    });
  });

  app.get("/admin/overview", requireAuth, requireAdmin, async (_request, response) => {
    const [totalUsers, totalGuests, totalAdmins, totalMessages, totalChannels, totalArticles] = await Promise.all([
      prisma.user.count({ where: { isGuest: false } }),
      prisma.user.count({ where: { isGuest: true } }),
      prisma.user.count({ where: { roleLabel: ROLE_ADMIN } }),
      prisma.communityMessage.count(),
      prisma.communityChannel.count(),
      prisma.knowledgeArticle.count()
    ]);

    response.json({
      totalUsers,
      totalGuests,
      totalAdmins,
      totalMessages,
      totalChannels,
      totalArticles
    });
  });

  app.get("/admin/community/messages", requireAuth, requireAdmin, async (request, response) => {
    const query = adminMessageQuerySchema.safeParse(request.query);
    if (!query.success) {
      response.status(400).json({ message: "Invalid query", errors: query.error.flatten() });
      return;
    }

    const limit = query.data.limit ?? 50;
    const messages = await prisma.communityMessage.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        channel: { select: { name: true } }
      }
    });

    response.json(
      messages.map((message) => ({
        id: message.id,
        channelId: message.channelId,
        channelName: message.channel.name,
        userId: message.userId,
        senderName: message.senderName,
        roleLabel: message.roleLabel,
        body: message.body,
        createdAt: message.createdAt.toISOString()
      }))
    );
  });

  app.delete("/admin/community/messages/:id", requireAuth, requireAdmin, async (request, response) => {
    const messageId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const message = await prisma.communityMessage.findUnique({
      where: { id: messageId }
    });

    if (!message) {
      response.status(404).json({ message: "Message not found" });
      return;
    }

    await prisma.communityMessage.delete({ where: { id: messageId } });
    getIoInstance()?.to(message.channelId).emit("community:message-deleted", { id: messageId });
    response.status(204).send();
  });

  app.post("/admin/community/channels", requireAuth, requireAdmin, async (request, response) => {
    const payload = adminChannelCreateSchema.safeParse(request.body);
    if (!payload.success) {
      response.status(400).json({ message: "Invalid payload", errors: payload.error.flatten() });
      return;
    }

    const existingSlug = await prisma.communityChannel.findUnique({
      where: { slug: payload.data.slug }
    });
    if (existingSlug) {
      response.status(409).json({ message: "Channel slug already exists" });
      return;
    }

    const created = await prisma.communityChannel.create({
      data: {
        slug: payload.data.slug,
        name: payload.data.name,
        description: payload.data.description,
        memberCount: payload.data.memberCount ?? 0
      }
    });

    response.status(201).json({
      id: created.id,
      slug: created.slug,
      name: created.name,
      description: created.description,
      memberCount: created.memberCount
    });
  });

  app.get("/admin/knowledge/articles", requireAuth, requireAdmin, async (_request, response) => {
    const articles = await prisma.knowledgeArticle.findMany({
      orderBy: { updatedAt: "desc" }
    });

    response.json(
      articles.map((article) => ({
        id: article.id,
        slug: article.slug,
        category: article.category,
        title: article.title,
        summary: article.summary,
        content: article.content,
        updatedAt: article.updatedAt.toISOString()
      }))
    );
  });

  app.post("/admin/knowledge/articles", requireAuth, requireAdmin, async (request, response) => {
    const payload = adminArticleCreateSchema.safeParse(request.body);
    if (!payload.success) {
      const flattened = payload.error.flatten();
      const firstFieldMessage = Object.values(flattened.fieldErrors).flat().find(Boolean);
      response
        .status(400)
        .json({ message: firstFieldMessage ?? "Invalid payload", errors: flattened });
      return;
    }

    const existing = await prisma.knowledgeArticle.findUnique({
      where: { slug: payload.data.slug }
    });
    if (existing) {
      response.status(409).json({ message: "Article slug already exists" });
      return;
    }

    const created = await prisma.knowledgeArticle.create({
      data: payload.data
    });

    response.status(201).json({
      id: created.id,
      slug: created.slug,
      category: created.category,
      title: created.title,
      summary: created.summary,
      content: created.content,
      updatedAt: created.updatedAt.toISOString()
    });
  });

  app.put("/admin/knowledge/articles/:id", requireAuth, requireAdmin, async (request, response) => {
    const articleId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const payload = adminArticleUpdateSchema.safeParse(request.body);
    if (!payload.success) {
      const flattened = payload.error.flatten();
      const firstFieldMessage = Object.values(flattened.fieldErrors).flat().find(Boolean);
      response
        .status(400)
        .json({ message: firstFieldMessage ?? "Invalid payload", errors: flattened });
      return;
    }

    const article = await prisma.knowledgeArticle.findUnique({ where: { id: articleId } });
    if (!article) {
      response.status(404).json({ message: "Article not found" });
      return;
    }

    if (payload.data.slug && payload.data.slug !== article.slug) {
      const existing = await prisma.knowledgeArticle.findUnique({
        where: { slug: payload.data.slug }
      });
      if (existing && existing.id !== article.id) {
        response.status(409).json({ message: "Article slug already exists" });
        return;
      }
    }

    const updated = await prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: payload.data
    });

    response.json({
      id: updated.id,
      slug: updated.slug,
      category: updated.category,
      title: updated.title,
      summary: updated.summary,
      content: updated.content,
      updatedAt: updated.updatedAt.toISOString()
    });
  });

  app.delete("/admin/knowledge/articles/:id", requireAuth, requireAdmin, async (request, response) => {
    const articleId = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const existing = await prisma.knowledgeArticle.findUnique({ where: { id: articleId } });
    if (!existing) {
      response.status(404).json({ message: "Article not found" });
      return;
    }

    await prisma.knowledgeArticle.delete({ where: { id: articleId } });
    response.status(204).send();
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(error);
    response.status(500).json({ message: "Internal server error" });
  });

  return app;
}
