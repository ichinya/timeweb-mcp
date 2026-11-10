import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVcsProvidersAction } from "../actions/get-vcs-providers.action";
import { ResourceNames } from "../types/resource-names.enum";
import { jsonResourceHandler, resourceArray } from "../resource-handler";

export const vcsProvidersHandler = (load: () => Promise<unknown> = getVcsProvidersAction) =>
  jsonResourceHandler(() => load(), value => resourceArray(value, true));

export const vcsProvidersResource = {
  name: ResourceNames.VCS_PROVIDERS,
  uri: "vcs-provider://all",
  template: new ResourceTemplate("vcs-provider://all", { list: undefined }),
  title: "Список доступных VCS провайдеров",
  description: "Список доступных VCS провайдеров в Timeweb Cloud",
  mimeType: "application/json" as const,
  handler: vcsProvidersHandler(),
};
