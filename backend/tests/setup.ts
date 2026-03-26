process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "mysql://root:password@localhost:3306/rtu_test";
process.env.JWT_ACCESS_SECRET = "test_access_secret";
process.env.JWT_REFRESH_SECRET = "test_refresh_secret";
process.env.ACCESS_TOKEN_TTL = "30m";
process.env.REFRESH_TOKEN_TTL = "7d";
process.env.FRONTEND_ORIGIN = "http://localhost:5173";
process.env.PORT = "4000";

const { seedDatabase } = await import("../prisma/seed.js");

await seedDatabase({ reset: true });
