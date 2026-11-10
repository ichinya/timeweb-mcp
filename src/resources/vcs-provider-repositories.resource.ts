import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVcsProviderRepositoriesAction } from "../actions/get-vcs-provider-repositories.action";
import { ResourceNames } from "../types/resource-names.enum";
import { jsonResourceHandler, ResourceParamsError } from "../resource-handler";

export const vcsProviderRepositoriesHandler = (load: (providerId: string) => Promise<unknown> = getVcsProviderRepositoriesAction) =>
  jsonResourceHandler(async (variables: Record<string, string | string[]> = {}) => {
    const providerId = variables?.provider_id;
    if (typeof providerId !== "string" || !providerId) throw new ResourceParamsError();
    return load(providerId);
  });

export const vcsProviderRepositoriesResource = {
  name: ResourceNames.VCS_PROVIDER_REPOSITORIES,
  uri: "vcs-provider://{provider_id}/repositories",
  template: new ResourceTemplate("vcs-provider://{provider_id}/repositories", { list: undefined }),
  title: "Список репозиториев провайдера",
  description: "Список репозиториев провайдера в Timeweb Cloud",
  mimeType: "application/json" as const,
  handler: vcsProviderRepositoriesHandler(),
};
