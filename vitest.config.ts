import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    testTimeout: 10000,
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**"],
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        // Baseline at migration time; ratchet upward, never down.
        // (http-server/index run in child processes and are not
        // instrumentable, which caps the global numbers.)
        lines: 64,
        functions: 72,
        branches: 56,
        statements: 64,
      },
    },
  },
});
