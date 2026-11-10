#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerProjectTools } from "./register-tools";
import { registerProjectResources } from "./register-resources";
import * as prompts from "./prompts";
import { getVersion } from "./utils";
import { formatRequestError } from "./exceptions/server.exception";

const startServer = async () => {
  const server = new McpServer(
    {
      name: "timeweb-mcp",
      title: "Timeweb MCP Server",
      version: getVersion(),
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  registerProjectTools(server);

  registerProjectResources(server);

  Object.values(prompts).forEach((prompt: any) => {
    server.registerPrompt(prompt.name, prompt.config, prompt.handler);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
};

startServer()
  .then(() => {
    console.error("Timeweb MCP server started");
  })
  .catch((error) => {
    console.error("Failed to start Timeweb MCP server:", formatRequestError(error));
    process.exit(1);
  });
