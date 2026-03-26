import { prisma } from "../src/db.js";
import { seedDatabase } from "./seed.js";

const reset = process.argv.includes("--reset") || process.env.SEED_RESET === "true";

seedDatabase({ reset })
  .then(async () => {
    // eslint-disable-next-line no-console
    console.log(
      reset
        ? "Seed complete (reset mode: database cleared and reseeded)."
        : "Seed complete (safe mode: existing users preserved)."
    );
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
