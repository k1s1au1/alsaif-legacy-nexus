import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  root: path.resolve(import.meta.dirname),
  base: "/tv-app/",
  envDir: path.resolve(import.meta.dirname, ".."),
  define: { __TV_PREVIEW__: "false" },
  publicDir: path.resolve(import.meta.dirname, "../public"),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../src") } },
  build: {
    outDir: path.resolve(import.meta.dirname, "../android-tv/app/src/main/assets/web"),
    emptyOutDir: true,
    target: "chrome100",
    sourcemap: false,
  },
}));
