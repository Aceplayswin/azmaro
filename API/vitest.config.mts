import { defineConfig } from "vitest/config";

/**
 * Integration tests run against a real MySQL database (TEST_DATABASE_URL).
 * tests/setup/global-setup.ts resets the schema with `scripts/migrate.ts`
 * and seeds the catalogue once per run.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/setup/global-setup.ts"],
    setupFiles: ["tests/setup/env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
