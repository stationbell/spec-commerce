import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import { assemble, pkgVersion } from "./scripts/assemble.ts";

/**
 * `vite build` writes the fresh bundle to build/ (gitignored). The plugin then assembles the
 * deployable trees under dist/ from frozen releases in releases/ (local, gitignored; see scripts/assemble.ts):
 *
 *   dist/static/  -> Pages project `stationbell-static`  (static.stationbell.com)
 *   dist/site/    -> Pages project `spec-commerce`       (spec-commerce.stationbell.com)
 *   dist/local/   -> `pnpm preview`, serving this build
 *
 * Release flow: bump version -> `pnpm release` (freeze) -> `pnpm ship` (static, then site; the
 * /v1/ pointer does NOT move) -> verify live -> `pnpm promote && pnpm deploy:static`.
 */
function assembleOutputs(): Plugin {
  return { name: "spec-commerce:assemble", closeBundle: () => assemble(false) };
}

export default defineConfig({
  plugins: [react(), assembleOutputs()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    __SC_VERSION__: JSON.stringify(pkgVersion()),
  },
  build: {
    target: "es2022",
    sourcemap: true,
    cssCodeSplit: false,
    outDir: "build",
    emptyOutDir: true,
    lib: {
      entry: "src/embed.ts",
      name: "SpecCommerce",
      formats: ["iife"],
      fileName: () => "spec-commerce.js",
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
