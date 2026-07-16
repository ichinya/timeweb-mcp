
import { getVcsProviderRepositoriesAction } from "../actions/get-vcs-provider-repositories.action";
import { ResourceNames } from "../types/resource-names.enum";
import { createResourceResponse } from "../utils";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

export const vcsProviderRepositoriesResource = {
  name: ResourceNames.VCS_PROVIDER_REPOSITORIES,
  uri: "vcs-provider://{provider_id}/repositories",
  template: new ResourceTemplate("vcs-provider://{provider_id}/repositories", { list: undefined }),
  title: "Список репозиториев провайдера",
  description: "Список репозиториев провайдера в Timeweb Cloud",
  handler: async (uri: URL, { provider_id }: any) => {
    try {
      if (!provider_id || typeof provider_id !== "string") {
        return createResourceResponse(
          uri.href,
          "Ошибка: не указан ID провайдера"
        );
      }

      const result = await getVcsProviderRepositoriesAction(provider_id);

      if (!result || result.length === 0) {
        return createResourceResponse(
          uri.href,
          `Нет доступных репозиториев для провайдера ${provider_id}`
        );
      }

      return createResourceResponse(uri.href, JSON.stringify(result, null, 2));
    } catch (error: unknown) {
      if (error instanceof Error) {
        return createResourceResponse(
          uri.href,
          `Не удалось получить список репозиториев провайдера. Причина: ${error.message}`
        );
      }

      return createResourceResponse(
        uri.href,
        `Не удалось получить список репозиториев провайдера`
      );
    }
  },
};
