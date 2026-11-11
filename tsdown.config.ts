import { defineConfig } from "tsdown";
import { isBuiltin } from "node:module";
import { bundleNotices } from "./scripts/bundle-notices.mjs";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  // A CLI benefits from loading one bundle instead of hundreds of dependency
  // files, whose open latency can exceed the startup deadline on Windows.
  deps: {
    alwaysBundle: (id) => !isBuiltin(id),
    onlyBundle: false,
    onlyImport: [],
  },
  plugins: [bundleNotices()],
  target: "node20.0.0",
  outExtensions: () => ({ js: ".js" }),
  dts: false,
  sourcemap: false,
  clean: true,
  outDir: "dist",
  tsconfig: "./tsconfig.json",
});
