import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const currentDir = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(currentDir, "..");
loadEnv({ path: resolve(backendRoot, ".env") });
loadEnv();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().default("dev_access_secret_change_me"),
  JWT_REFRESH_SECRET: z.string().default("dev_refresh_secret_change_me"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  OPENROUTER_API_KEY: z.string().optional(),
  AI_API: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("nvidia/nemotron-3-super-120b-a12b:free"),
  OPENROUTER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),
  PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:5173")
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  OPENROUTER_API_KEY: parsed.OPENROUTER_API_KEY ?? parsed.AI_API
};
