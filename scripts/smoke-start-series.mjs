import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runStartupProbe, reportStartupProbe } from "./startup-probe.mjs";

// Every sample starts a new Node process. Filesystem/OS caches are not controlled.
const dist = await readFile(new URL("../dist/index.js", import.meta.url));
console.log(JSON.stringify({ event: "startup_series", node: process.version,
  platform: process.platform, arch: process.arch, samples: 6,
  filesystemCache: "not-controlled", distSha256: createHash("sha256").update(dist).digest("hex") }));
for (let sample = 1; sample <= 6; sample++) {
  const result = await runStartupProbe({ env: { ...process.env, TIMEWEB_TOKEN: "" } });
  const exit = reportStartupProbe({ sample, firstInSeries: sample === 1, ...result });
  if (exit !== 0) process.exitCode = 1;
}
