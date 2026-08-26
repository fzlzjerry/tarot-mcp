import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const tarotRoot = fileURLToPath(new URL("../src/tarot", import.meta.url));

export default defineConfig({
  root,
  base: "/draw/",
  publicDir: false,
  resolve: {
    alias: {
      "@tarot": tarotRoot,
    },
  },
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL("../dist/ui/web", import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL("./index.html", import.meta.url)),
    },
  },
});
