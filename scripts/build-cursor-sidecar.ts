import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");
const sidecarName = "specforge-cursor-sidecar";
const targetTriple = execFileSync("rustc", ["--print", "host-tuple"], {
  cwd: repoRoot,
  encoding: "utf8"
}).trim();
const extension = process.platform === "win32" ? ".exe" : "";
const outputPath = join(
  repoRoot,
  "src-tauri",
  "binaries",
  `${sidecarName}-${targetTriple}${extension}`
);

mkdirSync(dirname(outputPath), { recursive: true });
rmSync(outputPath, { force: true });

const result = await Bun.build({
  entrypoints: [join(repoRoot, "src", "cursorSidecar.ts")],
  compile: {
    outfile: outputPath
  },
  minify: true,
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  }
});

if (!result.success) {
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Built Cursor sidecar: ${outputPath}`);
