import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { runStartupProbe, reportStartupProbe } from "./startup-probe.mjs";

const marker = "Timeweb MCP server started";
const secret = "test-secret-never-print";
function report(result, expected) {
  const lines = [];
  const exit = reportStartupProbe(result, { log: line => lines.push(line), error: line => lines.push(line) });
  assert.equal(result.status, expected);
  assert.equal(exit, expected === "ready" ? 0 : 1);
  assert.equal(lines.length, 1);
  assert.ok(!lines[0].includes(secret));
  assert.ok(result.elapsedMs >= 0);
  return result;
}
async function real(code, expected, options = {}) {
  let child;
  const result = await runStartupProbe({ args: ["-e", code], env: { ...process.env, TIMEWEB_TOKEN: "" },
    timeoutMs: 5_000, cleanupMs: 1_000, ...options,
    spawnProcess: (...args) => { child = spawn(...args); return child; } });
  assert.ok(child.exitCode !== null || child.signalCode !== null, "Child must have exited");
  assert.equal(child.stdout.listenerCount("data"), 0);
  assert.equal(child.stderr.listenerCount("data"), 0);
  return report(result, expected);
}
function simulated(onStart, onKill) {
  const child = new EventEmitter();
  child.pid = 123;
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.unref = () => {};
  child.kill = signal => { onKill?.(child, signal); return true; };
  return { child, spawnProcess: (_command, _args, options) => {
    assert.equal(options.windowsHide, true);
    queueMicrotask(() => onStart?.(child));
    return child;
  } };
}

test("real ready child is stopped and reports elapsed time without stderr contents", async () => {
  const result = await real(`process.stderr.write(${JSON.stringify(secret + marker)}); setInterval(()=>{},1000)`, "ready");
  assert.ok(result.readyMs !== null && result.readyMs <= result.elapsedMs);
  assert.equal(result.stdoutBytes, 0);
});
test("real delayed marker split across chunks is recognized", async () => {
  const result = await real(`process.stderr.write('Timeweb MCP '); setTimeout(()=>process.stderr.write('server started'),60);setInterval(()=>{},1000)`, "ready");
  assert.ok(result.readyMs >= 60);
});
test("stdout pollution fails without leaking the output", async () => {
  const result = await real(`process.stdout.write(${JSON.stringify(secret)});setInterval(()=>{},1000)`, "stdout_noise");
  assert.ok(result.stdoutBytes > 0);
});
test("early exit preserves exit code without exposing stderr", async () => {
  const result = await real(`process.stderr.write(${JSON.stringify(secret)});process.exit(7)`, "early_exit");
  assert.equal(result.code, 7);
});
test("real hung process hits timeout and is terminated", async () => {
  await real("setInterval(()=>{},1000)", "timeout", { timeoutMs: 100 });
});
test("real missing executable reports spawn error, not timeout", async () => {
  const result = await runStartupProbe({ command: new URL("./missing-smoke-command", import.meta.url).pathname, timeoutMs: 500 });
  report(result, "spawn_error");
  assert.equal(result.spawnError, "ENOENT");
});
test("EPERM and unknown spawn errors are safe and distinct from timeout", async () => {
  for (const code of ["EPERM", secret]) {
    const result = await runStartupProbe({ spawnProcess: () => { throw Object.assign(new Error(secret), { code }); } });
    report(result, "spawn_error");
    assert.equal(result.spawnError, code === "EPERM" ? "EPERM" : "UNKNOWN");
  }
});
test("asynchronous spawn error clears timers and owned handlers", async () => {
  const fake = simulated(c => c.emit("error", Object.assign(new Error(secret), { code: "EPERM" })), c => c.emit("close", -1, null));
  report(await runStartupProbe({ spawnProcess: fake.spawnProcess }), "spawn_error");
  assert.equal(fake.child.listenerCount("error"), 0);
  assert.equal(fake.child.listenerCount("close"), 0);
});
test("late readiness after timeout cannot produce a pass", async () => {
  const fake = simulated(null, (c, signal) => {
    if (signal === "SIGTERM") { c.stderr.write(marker); c.emit("close", null, signal); }
  });
  const result = report(await runStartupProbe({ spawnProcess: fake.spawnProcess, timeoutMs: 20 }), "timeout");
  assert.equal(result.readyMs, null);
});
test("stdout arriving during ready cleanup still fails", async () => {
  const fake = simulated(c => c.stderr.write(marker), (c, signal) => { c.stdout.write(secret); c.emit("close", null, signal); });
  report(await runStartupProbe({ spawnProcess: fake.spawnProcess }), "stdout_noise");
});
test("cleanup escalates to SIGKILL when graceful termination does not close", async () => {
  const signals = [];
  const fake = simulated(c => c.stderr.write(marker), (c, signal) => { signals.push(signal); if (signal === "SIGKILL") c.emit("close", null, signal); });
  report(await runStartupProbe({ spawnProcess: fake.spawnProcess, cleanupMs: 20 }), "ready");
  assert.deepEqual(signals, ["SIGTERM", "SIGKILL"]);
});
test("failed cleanup is bounded, detaches streams and never reports ready", async () => {
  const fake = simulated(c => c.stderr.write(marker));
  const result = report(await runStartupProbe({ spawnProcess: fake.spawnProcess, cleanupMs: 20 }), "cleanup_timeout");
  assert.equal(result.startupStatus, "ready");
  assert.equal(result.cleanupFailed, true);
  assert.equal(fake.child.stdout.destroyed, true);
  assert.equal(fake.child.stderr.listenerCount("data"), 0);
  assert.equal(fake.child.listenerCount("close"), 0);
});
