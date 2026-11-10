import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as resources from "./resources";
import { wrapResourceHandler } from "./resource-handler";

export function registerProjectResources(server: McpServer, definitions: typeof resources = resources): void {
  for (const entry of Object.values(definitions)) {
    // Static and template callback signatures differ; preserve the SDK's argument order.
    const resource: any = entry;
    server.registerResource(resource.name, resource.uri.includes("{") ? resource.template : resource.uri,
      { title: resource.title, description: resource.description, mimeType: resource.mimeType },
      wrapResourceHandler(resource.name, (...args: unknown[]) => resource.handler(...args)));
  }
}
