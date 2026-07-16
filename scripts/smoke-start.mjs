import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["dist/index.js"], {
  cwd: new URL("..", import.meta.url),
  env: process.env,
  stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
let stderr = "";
let started = false;

const timeout = setTimeout(() => {
  child.kill();
  console.error(`Server did not start within 5 seconds.\n${stderr}`);
  process.exitCode = 1;
}, 5_000);

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");

child.stdout.on("data", (chunk) => {
  stdout += chunk;
});

child.stderr.on("data", (chunk) => {
  stderr += chunk;

  if (!started && stderr.includes("Timeweb MCP server started")) {
    started = true;
    clearTimeout(timeout);
    child.kill();
  }
});

child.on("error", (error) => {
  clearTimeout(timeout);
  console.error(error);
  process.exitCode = 1;
});

child.on("close", (code) => {
  clearTimeout(timeout);

  if (!started) {
    console.error(`Server exited before startup (code ${code}).\n${stderr}`);
    process.exitCode = 1;
    return;
  }

  if (stdout.length > 0) {
    console.error(
      `Server wrote to stdout before receiving MCP input:\n${stdout}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log("Server startup smoke test passed");
});
