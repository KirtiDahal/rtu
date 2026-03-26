import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    pool: "forks",
    maxWorkers: 1,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"]
  }
});
