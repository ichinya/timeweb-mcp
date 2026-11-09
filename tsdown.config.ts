import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20.0.0",
  outExtensions: () => ({ js: ".js" }),
  dts: false,
  sourcemap: false,
  clean: true,
  outDir: "dist",
  tsconfig: "./tsconfig.json",
});
