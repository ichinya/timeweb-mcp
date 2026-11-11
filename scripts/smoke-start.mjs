import { runStartupProbe, reportStartupProbe } from "./startup-probe.mjs";

process.exitCode = reportStartupProbe(await runStartupProbe());
