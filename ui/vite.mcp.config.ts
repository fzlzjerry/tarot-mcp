import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const tarotRoot = fileURLToPath(new URL("../src/tarot", import.meta.url));

export default defineConfig({
  root,
  base: "./",
  publicDir: false,
  resolve: {
    alias: {
      "@tarot": tarotRoot,
    },
  },
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: fileURLToPath(new URL("../dist/ui", import.meta.url)),
    emptyOutDir: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./mcp-app.html", import.meta.url)),
    },
  },
});
