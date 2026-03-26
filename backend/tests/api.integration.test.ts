import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { prisma } from "../src/db.js";

const app = createApp();

async function loginAsDemoUser() {
  const response = await request(app).post("/auth/login").send({
    email: "sarah@example.com",
    password: "password123"
  });
  const cookies = response.headers["set-cookie"];
  return Array.isArray(cookies) ? cookies : [];
}

async function loginAsAdmin() {
  const response = await request(app).post("/auth/login").send({
    email: "admin@example.com",
    password: "password123"
  });
  const cookies = response.headers["set-cookie"];
  return Array.isArray(cookies) ? cookies : [];
}

function findCookie(cookies: string[], prefix: string): string | undefined {
  return cookies.find((cookie) => cookie.startsWith(prefix));
}

describe("auth integration", () => {
  it("logs in and loads profile shell", async () => {
    const login = await request(app).post("/auth/login").send({
      email: "sarah@example.com",
      password: "password123"
    });
    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe("sarah@example.com");
    expect(login.headers["set-cookie"]).toBeTruthy();

    const me = await request(app).get("/auth/me").set("Cookie", login.headers["set-cookie"]);
    expect(me.status).toBe(200);
    expect(me.body.user.displayName).toContain("Sarah");
  });

  it("creates guest users", async () => {
    const guest = await request(app).post("/auth/guest").send({});
    expect(guest.status).toBe(201);
    expect(guest.body.user.isGuest).toBe(true);
  });

  it("refreshes session from refresh cookie", async () => {
    const login = await request(app).post("/auth/login").send({
      email: "sarah@example.com",
      password: "password123"
    });
    expect(login.status).toBe(200);

    const loginCookies = Array.isArray(login.headers["set-cookie"]) ? login.headers["set-cookie"] : [];
    const refreshCookie = findCookie(loginCookies, "rtu_refresh_token=");
    expect(refreshCookie).toBeTruthy();

    const refresh = await request(app).post("/auth/refresh").set("Cookie", [refreshCookie!]);
    expect(refresh.status).toBe(204);
    expect(refresh.headers["set-cookie"]).toBeTruthy();

    const refreshedCookies = Array.isArray(refresh.headers["set-cookie"]) ? refresh.headers["set-cookie"] : [];
    const me = await request(app).get("/auth/me").set("Cookie", refreshedCookies);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("sarah@example.com");
  });
});

describe("domain integration", () => {
  it("restricts admin routes by role", async () => {
    const userCookies = await loginAsDemoUser();
    const forbidden = await request(app).get("/admin/overview").set("Cookie", userCookies);
    expect(forbidden.status).toBe(403);

    const adminCookies = await loginAsAdmin();
    const allowed = await request(app).get("/admin/overview").set("Cookie", adminCookies);
    expect(allowed.status).toBe(200);
    expect(allowed.body.totalUsers).toBeGreaterThanOrEqual(1);
  });

  it("allows admins to moderate messages", async () => {
    const userCookies = await loginAsDemoUser();
    const channels = await request(app).get("/community/channels").set("Cookie", userCookies);
    const channelId = channels.body[0].id as string;

    const created = await request(app)
      .post(`/community/channels/${channelId}/messages`)
      .set("Cookie", userCookies)
      .send({ body: "Temporary moderation target message." });
    expect(created.status).toBe(201);

    const adminCookies = await loginAsAdmin();
    const list = await request(app).get("/admin/community/messages").set("Cookie", adminCookies);
    expect(list.status).toBe(200);
    const target = list.body.find((item: { id: string; body: string }) =>
      item.body.includes("Temporary moderation target message.")
    );
    expect(target).toBeTruthy();
    if (!target) {
      throw new Error("Expected moderated message not found");
    }

    const removed = await request(app).delete(`/admin/community/messages/${target.id}`).set("Cookie", adminCookies);
    expect(removed.status).toBe(204);
  });

  it("allows admins to update and delete knowledge articles", async () => {
    const adminCookies = await loginAsAdmin();
    const tempSlug = `admin-temp-${Date.now()}`;

    const created = await request(app)
      .post("/admin/knowledge/articles")
      .set("Cookie", adminCookies)
      .send({
        slug: tempSlug,
        category: "Admin",
        title: "Admin temporary article",
        summary: "Temporary summary for admin integration test.",
        content: [{ heading: "Test heading", body: "Test body content." }]
      });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .put(`/admin/knowledge/articles/${created.body.id as string}`)
      .set("Cookie", adminCookies)
      .send({
        title: "Admin temporary article updated",
        summary: "Updated summary for admin integration test."
      });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toContain("updated");

    const removed = await request(app)
      .delete(`/admin/knowledge/articles/${created.body.id as string}`)
      .set("Cookie", adminCookies);
    expect(removed.status).toBe(204);
  });

  it("returns dashboard summary", async () => {
    const cookies = await loginAsDemoUser();
    const response = await request(app).get("/dashboard/summary").set("Cookie", cookies);
    expect(response.status).toBe(200);
    expect(response.body.currentPhase).toBeTruthy();
    expect(response.body.quickStats).toBeTruthy();
  });

  it("reads and updates profile settings", async () => {
    const cookies = await loginAsDemoUser();

    const getProfile = await request(app).get("/profile").set("Cookie", cookies);
    expect(getProfile.status).toBe(200);
    expect(getProfile.body.user.email).toBe("sarah@example.com");

    const updateProfile = await request(app)
      .put("/profile")
      .set("Cookie", cookies)
      .send({
        age: 27,
        timezone: "Asia/Kathmandu",
        avgCycleLength: 29,
        notes: "Tracking with profile test."
      });
    expect(updateProfile.status).toBe(200);
    expect(updateProfile.body.profile.age).toBe(27);
    expect(updateProfile.body.profile.timezone).toBe("Asia/Kathmandu");
  });

  it("changes password and deletes profile", async () => {
    const tempEmail = `temp-${Date.now()}@example.com`;

    const register = await request(app).post("/auth/register").send({
      email: tempEmail,
      password: "password123",
      displayName: "Temp User"
    });
    expect(register.status).toBe(201);

    const registerCookies = Array.isArray(register.headers["set-cookie"]) ? register.headers["set-cookie"] : [];
    const passwordChange = await request(app)
      .put("/profile/password")
      .set("Cookie", registerCookies)
      .send({ currentPassword: "password123", newPassword: "password456" });
    expect(passwordChange.status).toBe(204);

    const oldLogin = await request(app).post("/auth/login").send({
      email: tempEmail,
      password: "password123"
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/auth/login").send({
      email: tempEmail,
      password: "password456"
    });
    expect(newLogin.status).toBe(200);

    const newCookies = Array.isArray(newLogin.headers["set-cookie"]) ? newLogin.headers["set-cookie"] : [];
    const deleteProfile = await request(app).delete("/profile").set("Cookie", newCookies);
    expect(deleteProfile.status).toBe(204);
  });

  it("returns calendar prediction payload", async () => {
    const cookies = await loginAsDemoUser();
    const response = await request(app)
      .get("/calendar")
      .query({ month: 3, year: 2026 })
      .set("Cookie", cookies);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.days)).toBe(true);
    expect(response.body.prediction.nextPeriodDate).toBeTruthy();
  });

  it("posts a community message", async () => {
    const cookies = await loginAsDemoUser();
    const channels = await request(app).get("/community/channels").set("Cookie", cookies);
    const channelId = channels.body[0].id as string;

    const post = await request(app)
      .post(`/community/channels/${channelId}/messages`)
      .set("Cookie", cookies)
      .send({ body: "Integration test message." });
    expect(post.status).toBe(201);
    expect(post.body.body).toContain("Integration test");

    const list = await request(app).get(`/community/channels/${channelId}/messages`).set("Cookie", cookies);
    expect(list.status).toBe(200);
    expect(list.body.some((item: { body: string }) => item.body.includes("Integration test"))).toBe(true);
  });

  it("creates logs via required endpoints", async () => {
    const cookies = await loginAsDemoUser();

    const period = await request(app)
      .post("/logs/period")
      .set("Cookie", cookies)
      .send({ startDate: "2026-03-01", endDate: "2026-03-05", flow: 3 });
    expect(period.status).toBe(201);

    const mood = await request(app)
      .post("/logs/mood")
      .set("Cookie", cookies)
      .send({ date: "2026-03-18", mood: 4, label: "Calm" });
    expect(mood.status).toBe(201);

    const symptoms = await request(app)
      .post("/logs/symptoms")
      .set("Cookie", cookies)
      .send({ date: "2026-03-18", symptoms: ["cramps"] });
    expect(symptoms.status).toBe(201);

    const deleteMood = await request(app).delete("/logs/mood").set("Cookie", cookies).query({ date: "2026-03-18" });
    expect(deleteMood.status).toBe(204);

    const deleteSymptoms = await request(app)
      .delete("/logs/symptoms")
      .set("Cookie", cookies)
      .query({ date: "2026-03-18" });
    expect(deleteSymptoms.status).toBe(204);

    const sleep = await request(app)
      .post("/logs/sleep")
      .set("Cookie", cookies)
      .send({ date: "2026-03-18", hours: 7.4, quality: 4 });
    expect(sleep.status).toBe(201);
  });

  it("serves knowledge listing and detail", async () => {
    const cookies = await loginAsDemoUser();
    const list = await request(app).get("/knowledge/articles").set("Cookie", cookies);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThan(0);

    const detail = await request(app)
      .get(`/knowledge/articles/${list.body[0].slug as string}`)
      .set("Cookie", cookies);
    expect(detail.status).toBe(200);
    expect(detail.body.content).toBeTruthy();
  });

  it("returns a clear error when AI assistant is not configured", async () => {
    const cookies = await loginAsDemoUser();
    const ai = await request(app).post("/knowledge/ask").set("Cookie", cookies).send({ query: "What is PMDD?" });
    expect(ai.status).toBe(503);
    expect(ai.body.message).toContain("not configured");
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
