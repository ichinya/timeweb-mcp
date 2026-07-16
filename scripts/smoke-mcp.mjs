import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  cwd: projectRoot,
  stderr: "pipe",
});
const client = new Client({
  name: "timeweb-mcp-smoke",
  version: "1.0.0",
});

let stderr = "";
transport.stderr?.setEncoding("utf8");
transport.stderr?.on("data", (chunk) => {
  stderr += chunk;
});

try {
  await client.connect(transport);

  const [{ resources }, { resourceTemplates }] = await Promise.all([
    client.listResources(),
    client.listResourceTemplates(),
  ]);

  assert.deepEqual(resources.map(({ uri }) => uri).sort(), [
    "allowed-presets://all",
    "database-presets://all",
    "deploy-settings://all",
    "vcs-provider://all",
    "vpc://all",
  ]);
  assert.deepEqual(
    resourceTemplates.map(({ uriTemplate }) => uriTemplate).sort(),
    ["vcs-provider://{provider_id}/repositories"],
  );

  console.log("MCP resource registration smoke test passed");
} catch (error) {
  console.error(error);
  if (stderr) {
    console.error(stderr);
  }
  process.exitCode = 1;
} finally {
  await client.close();
}
