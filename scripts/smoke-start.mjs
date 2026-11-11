import { runStartupProbe, reportStartupProbe } from "./startup-probe.mjs";
import { readStartupTimeout, timeoutVariable } from "./startup-config.mjs";

const config = readStartupTimeout(process.env[timeoutVariable]);
if (config.status === "configuration_error") {
  console.error(JSON.stringify(config));
  process.exitCode = 1;
} else {
  process.exitCode = reportStartupProbe(await runStartupProbe({ timeoutMs: config.timeoutMs }));
}
