import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as tools from "./tools";
import { toolAnnotations } from "./tool-annotations";
import { wrapRequestHandler } from "./api/request-context";

export function registerProjectTools(server: McpServer): void {
  for (const key of Object.keys(tools) as (keyof typeof tools)[]) {
    // Tool schemas and callback arguments differ; SDK validation uses each schema.
    const tool: any = tools[key];
    server.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { title: tool.title, ...toolAnnotations[key] },
    }, wrapRequestHandler(tool.name, (...args: unknown[]) => tool.handler(...args)));
  }
}
