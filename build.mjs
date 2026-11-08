import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const python = spawnSync(process.env.PYTHON || "python", ["build.py"], { stdio: "inherit" });
if (python.status !== 0) process.exit(python.status ?? 1);
await build({
  entryPoints: ["editor/write.js"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: "dist/assets/write.js",
});
