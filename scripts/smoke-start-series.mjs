import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { runStartupProbe, reportStartupProbe } from "./startup-probe.mjs";
import { readStartupTimeout, timeoutVariable } from "./startup-config.mjs";

const config = readStartupTimeout(process.env[timeoutVariable]);
if (config.status === "configuration_error") {
  console.error(JSON.stringify(config));
  process.exitCode = 1;
} else {
  // Every sample starts a new Node process. Filesystem/OS caches are not controlled.
  const dist = await readFile(new URL("../dist/index.js", import.meta.url));
  console.log(JSON.stringify({ event: "startup_series", node: process.version,
    platform: process.platform, arch: process.arch, samples: 6, timeoutMs: config.timeoutMs,
    filesystemCache: "not-controlled", distSha256: createHash("sha256").update(dist).digest("hex") }));
  for (let sample = 1; sample <= 6; sample++) {
    const result = await runStartupProbe({ timeoutMs: config.timeoutMs, env: { ...process.env, TIMEWEB_TOKEN: "" } });
    const exit = reportStartupProbe({ sample, firstInSeries: sample === 1, ...result });
    if (exit !== 0) process.exitCode = 1;
  }
}
