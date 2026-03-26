import "dotenv/config";
import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { PrismaClient } from "@prisma/client";
import { ROLE_ADMIN, ROLE_MEMBER } from "../src/roles.js";

const prisma = new PrismaClient();

type SeedOptions = {
  reset?: boolean;
};

export async function seedDatabase(options: SeedOptions = {}) {
  const reset = options.reset ?? true;

  if (reset) {
    await prisma.communityMessage.deleteMany();
    await prisma.communityChannel.deleteMany();
    await prisma.knowledgeTip.deleteMany();
    await prisma.knowledgeArticle.deleteMany();
    await prisma.sleepLog.deleteMany();
    await prisma.symptomLog.deleteMany();
    await prisma.moodLog.deleteMany();
    await prisma.periodLog.deleteMany();
    await prisma.cycle.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
  }

  const passwordHash = await bcrypt.hash("password123", 10);

  let sarah = await prisma.user.findUnique({
    where: { email: "sarah@example.com" }
  });
  if (!sarah) {
    sarah = await prisma.user.create({
      data: {
        email: "sarah@example.com",
        passwordHash,
        displayName: "Sarah M.",
        avatarUrl:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
        roleLabel: ROLE_MEMBER,
        profile: {
          create: {
            age: 24,
            timezone: "Asia/Kathmandu",
            avgCycleLength: 28
          }
        }
      }
    });
  } else if (reset) {
    // Keep demo credentials consistent after a reset seed.
    sarah = await prisma.user.update({
      where: { id: sarah.id },
      data: { passwordHash, roleLabel: ROLE_MEMBER, isGuest: false }
    });
  }

  let admin = await prisma.user.findUnique({
    where: { email: "admin@example.com" }
  });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        passwordHash,
        displayName: "Admin User",
        roleLabel: ROLE_ADMIN,
        profile: {
          create: {
            timezone: "Asia/Kathmandu"
          }
        }
      }
    });
  } else if (reset) {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        displayName: "Admin User",
        roleLabel: ROLE_ADMIN,
        isGuest: false
      }
    });
  }

  // Non-reset seeds are intentionally non-destructive to preserve real user accounts.
  if (!reset) {
    return;
  }

  const cycleStarts = [84, 56, 28].map((days) => subDays(new Date(), days));
  for (const startDate of cycleStarts) {
    await prisma.cycle.create({
      data: {
        userId: sarah.id,
        startDate,
        endDate: addDays(startDate, 4),
        length: 28
      }
    });
  }

  for (let i = 0; i < 4; i += 1) {
    const date = addDays(cycleStarts[2], i);
    await prisma.periodLog.create({
      data: { userId: sarah.id, date, flow: Math.max(1, 4 - i), notes: "Seeded period log" }
    });
  }

  const moods = [
    { mood: 4, label: "High Energy", daysAgo: 2 },
    { mood: 3, label: "Balanced", daysAgo: 1 },
    { mood: 4, label: "Positive", daysAgo: 0 }
  ];
  for (const mood of moods) {
    await prisma.moodLog.create({
      data: {
        userId: sarah.id,
        date: subDays(new Date(), mood.daysAgo),
        mood: mood.mood,
        label: mood.label,
        notes: "Feeling aligned with routine."
      }
    });
  }

  await prisma.symptomLog.create({
    data: {
      userId: sarah.id,
      date: subDays(new Date(), 1),
      symptoms: ["light-cramps", "bloating"],
      notes: "Very manageable."
    }
  });

  await prisma.sleepLog.createMany({
    data: [
      { userId: sarah.id, date: subDays(new Date(), 1), hours: 7.5, quality: 4 },
      { userId: sarah.id, date: subDays(new Date(), 2), hours: 7.2, quality: 4 }
    ]
  });

  const channels = await prisma.$transaction([
    prisma.communityChannel.create({
      data: {
        slug: "general-support",
        name: "General Support",
        description: "Daily check-ins and gentle support.",
        memberCount: 1240
      }
    }),
    prisma.communityChannel.create({
      data: {
        slug: "pcos-hormones",
        name: "PCOS & Hormones",
        description: "Conversations around hormone balance.",
        memberCount: 856
      }
    }),
    prisma.communityChannel.create({
      data: {
        slug: "nutrition-tips",
        name: "Nutrition Tips",
        description: "Food, hydration and energy guidance.",
        memberCount: 654
      }
    })
  ]);

  await prisma.communityMessage.createMany({
    data: [
      {
        channelId: channels[0].id,
        senderName: "Elena R.",
        roleLabel: "Member",
        body: "Has anyone tried raspberry leaf tea for cramps? I heard mixed reviews.",
        createdAt: subDays(new Date(), 0.2)
      },
      {
        channelId: channels[0].id,
        senderName: "Anonymous Butterfly",
        roleLabel: "Member",
        body: "It helped me a bit around day 1. Warm compress helped more.",
        createdAt: subDays(new Date(), 0.15)
      },
      {
        channelId: channels[0].id,
        userId: sarah.id,
        senderName: sarah.displayName,
        roleLabel: sarah.roleLabel,
        body: "Thanks for the tip! I will try it today.",
        createdAt: subDays(new Date(), 0.1)
      }
    ]
  });

  const menstrual101 = await prisma.knowledgeArticle.create({
    data: {
      slug: "menstrual-cycle-101",
      category: "Basics",
      title: "Menstrual Cycle 101",
      summary: "The foundation of understanding your reproductive rhythm.",
      content: [
        {
          heading: "What is a normal cycle length?",
          body: "Most cycles fall between 21 to 35 days. What matters most is your own baseline."
        },
        {
          heading: "How much blood loss is typical?",
          body: "Average loss is around 30-40 ml, and can vary naturally by person and phase."
        }
      ]
    }
  });

  const fourPhases = await prisma.knowledgeArticle.create({
    data: {
      slug: "understanding-four-phases",
      category: "Phases",
      title: "Understanding the Four Phases",
      summary: "Your body moves through distinct hormonal states every month.",
      content: [
        {
          heading: "The Follicular Phase (Days 1-14)",
          body: "Estrogen rises and many people feel more energetic and social."
        },
        {
          heading: "Ovulation",
          body: "Ovulation usually occurs around 14 days before your next expected period."
        },
        {
          heading: "The Luteal Phase",
          body: "Progesterone rises. Support sleep, hydration, and stress recovery."
        }
      ]
    }
  });

  await prisma.knowledgeArticle.create({
    data: {
      slug: "fueling-your-cycle",
      category: "Nutrition",
      title: "Fueling Your Cycle",
      summary: "Food patterns to support energy and hormonal comfort.",
      content: [
        {
          heading: "What should I eat during my period?",
          body: "Pair iron-rich foods with vitamin C and stay hydrated."
        },
        {
          heading: "Cravings and progesterone",
          body: "Steady protein and fiber can help reduce extreme energy dips."
        }
      ]
    }
  });

  await prisma.knowledgeTip.createMany({
    data: [
      {
        articleId: menstrual101.id,
        title: "Morning Sunlight",
        body: "15 minutes of morning light may support better rhythm and mood.",
        theme: "pink",
        position: 1
      },
      {
        articleId: fourPhases.id,
        title: "Sleep and Cycles",
        body: "Lower evening room temperature supports luteal-phase sleep quality.",
        theme: "lilac",
        position: 2
      },
      {
        title: "Need more help?",
        body: "Reach support for personalized educational guidance.",
        theme: "midnight",
        position: 99
      }
    ]
  });
}
