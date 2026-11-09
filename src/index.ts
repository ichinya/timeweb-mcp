#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as tools from "./tools";
import * as resources from "./resources";
import * as prompts from "./prompts";
import { getVersion } from "./utils";
import { wrapRequestHandler } from "./api/request-context";
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

  Object.values(tools).forEach((tool: any) => {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          title: tool.title,
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      wrapRequestHandler(tool.name, (...args: unknown[]) => tool.handler(...args))
    );
  });

  Object.values(resources).forEach((resource: any) => {
    const uriOrTemplate = resource.uri.includes("{")
      ? resource.template
      : resource.uri;

    server.registerResource(
      resource.name,
      uriOrTemplate,
      {
        title: resource.title,
        description: resource.description,
      },
      wrapRequestHandler(resource.name, (...args: unknown[]) => resource.handler(...args))
    );
  });

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
