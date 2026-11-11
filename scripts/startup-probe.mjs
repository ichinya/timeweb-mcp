import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

const marker = "Timeweb MCP server started";
const spawnCodes = new Set(["EPERM", "EACCES", "ENOENT", "ENOEXEC", "ENOTDIR", "EMFILE", "ENFILE", "EAGAIN", "ENOMEM", "ESRCH", "EINVAL"]);
const safeErrorCode = (error) => spawnCodes.has(error?.code) ? error.code : "UNKNOWN";

// Internal injection points, not public CLI overrides.
export function runStartupProbe({ command = process.execPath, args = ["dist/index.js"],
  cwd = new URL("..", import.meta.url), env = process.env, timeoutMs = 5_000,
  cleanupMs = 1_000, spawnProcess = spawn } = {}) {
  return new Promise((resolve) => {
    const start = performance.now();
    let child, startupTimer, cleanupTimer, settled = false, stopping = false;
    let status = null, readyMs = null, stdoutBytes = 0, stderrBytes = 0, tail = "", spawnError = null;
    const finish = (code = null, signal = null, cleanupFailed = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      clearTimeout(cleanupTimer);
      child?.stdout?.off("data", onStdout);
      child?.stderr?.off("data", onStderr);
      child?.off("error", onError);
      child?.off("close", onClose);
      if (cleanupFailed) {
        child?.stdin?.destroy();
        child?.stdout?.destroy();
        child?.stderr?.destroy();
        child?.unref();
      }
      resolve({ status: cleanupFailed ? "cleanup_timeout" : status ?? "early_exit",
        startupStatus: status ?? "early_exit", elapsedMs: Math.round(performance.now() - start), readyMs,
        timeoutMs, cleanupMs, pid: Number.isSafeInteger(child?.pid) ? child.pid : null,
        code: Number.isSafeInteger(code) ? code : null,
        signal: typeof signal === "string" && /^SIG[A-Z0-9]{1,12}$/.test(signal) ? signal : null,
        spawnError, stdoutBytes, stderrBytes, cleanupFailed });
    };
    const kill = (signal) => { try { child.kill(signal); } catch { /* Deadlines still bound cleanup. */ } };
    const stop = () => {
      if (stopping || settled) return;
      stopping = true;
      clearTimeout(startupTimer);
      cleanupTimer = setTimeout(() => {
        cleanupTimer = setTimeout(() => finish(null, null, true), cleanupMs);
        kill("SIGKILL");
      }, cleanupMs);
      kill("SIGTERM");
    };
    const onStdout = (chunk) => {
      stdoutBytes += Buffer.byteLength(chunk);
      if (status === null || status === "ready") { status = "stdout_noise"; stop(); }
    };
    const onStderr = (chunk) => {
      stderrBytes += Buffer.byteLength(chunk);
      if (status !== null) return;
      const text = tail + chunk.toString("utf8");
      tail = text.slice(-(marker.length - 1));
      if (text.includes(marker)) {
        const duration = performance.now() - start;
        status = duration >= timeoutMs ? "timeout" : "ready";
        if (status === "ready") readyMs = Math.round(duration);
        stop();
      }
    };
    const onError = (error) => {
      if (settled) return;
      spawnError = safeErrorCode(error);
      if (status === null || status === "ready") status = "spawn_error";
      stop();
    };
    const onClose = (code, signal) => finish(code, signal);
    try {
      child = spawnProcess(command, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    } catch (error) {
      spawnError = safeErrorCode(error);
      status = "spawn_error";
      finish();
      return;
    }
    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.on("error", onError);
    child.on("close", onClose);
    startupTimer = setTimeout(() => { if (status === null) { status = "timeout"; stop(); } }, timeoutMs);
  });
}

export function reportStartupProbe(result, { log = console.log, error = console.error } = {}) {
  const ok = result.status === "ready";
  (ok ? log : error)(`${ok ? "Server startup smoke test passed" : "Server startup smoke test failed"} ${JSON.stringify(result)}`);
  return ok ? 0 : 1;
}
