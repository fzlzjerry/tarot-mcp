import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const tarotRoot = fileURLToPath(new URL("../src/tarot", import.meta.url));

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@tarot": tarotRoot,
    },
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["src/__tests__/setup.ts"],
    css: true,
  },
});
