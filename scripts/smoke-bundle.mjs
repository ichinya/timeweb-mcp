import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const tempRoot = await realpath(tmpdir());
const temp = await mkdtemp(path.join(tempRoot, "timeweb-mcp-bundle-"));
let client;
try {
  await cp(path.join(root, "dist"), path.join(temp, "dist"), { recursive: true });
  await cp(path.join(root, "package.json"), path.join(temp, "package.json"));
  const isolatedRequire = createRequire(path.join(temp, "dist/index.js"));
  for (const name of ["@modelcontextprotocol/sdk/server/mcp.js", "axios", "zod", "ajv"]) {
    assert.throws(() => isolatedRequire.resolve(name), { code: "MODULE_NOT_FOUND" },
      `Isolation failed: ${name} is resolvable outside the bundle`);
  }
  const notices = await readFile(path.join(temp, "dist/THIRD_PARTY_NOTICES.txt"), "utf8");
  for (const name of ["@modelcontextprotocol/sdk", "axios", "zod", "ajv"]) {
    assert.ok(notices.includes(`${name}@`), `Missing notice for ${name}`);
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    // No ancestor node_modules or injected loaders may supply missing code.
    args: ["dist/index.js"], cwd: temp, stderr: "pipe",
    env: { PATH: process.env.PATH ?? "", SystemRoot: process.env.SystemRoot ?? "", TIMEWEB_TOKEN: "" },
  });
  transport.stderr?.on("data", () => {});
  client = new Client({ name: "timeweb-bundle-smoke", version: "1.0.0" });
  await client.connect(transport);
  const pkg = JSON.parse(await readFile(path.join(temp, "package.json"), "utf8"));
  assert.equal(client.getServerVersion()?.version, pkg.version);
  const { tools } = await client.listTools();
  assert.ok(tools.some(tool => tool.name === "create_server"));
  // Missing required name must be rejected before any infrastructure request.
  const invalid = await client.callTool({ name: "create_server", arguments: {} });
  assert.equal(invalid.isError, true);
  const { resources } = await client.listResources();
  assert.ok(resources.some(resource => resource.uri === "allowed-presets://all"));
  await client.listPrompts();
  console.log("Isolated bundle MCP smoke passed (no installed dependencies)");
} finally {
  try {
    await client?.close();
  } finally {
    const target = await realpath(temp);
    if (path.dirname(target) !== tempRoot || !path.basename(target).startsWith("timeweb-mcp-bundle-")) {
      throw new Error("Unsafe bundle smoke cleanup target");
    }
    await rm(target, { recursive: true, force: true });
  }
}
