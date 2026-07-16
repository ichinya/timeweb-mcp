import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVcsProvidersAction } from "../actions/get-vcs-providers.action";
import { ResourceNames } from "../types/resource-names.enum";
import { createResourceResponse } from "../utils";

export const vcsProvidersResource = {
  name: ResourceNames.VCS_PROVIDERS,
  uri: "vcs-provider://all",
  template: new ResourceTemplate("vcs-provider://all", { list: undefined }),
  title: "Список доступных VCS провайдеров",
  description: "Список доступных VCS провайдеров в Timeweb Cloud",
  handler: async (uri: URL) => {
    try {
      const result = await getVcsProvidersAction();

      if (!result || result.length === 0) {
        return createResourceResponse(
          uri.href,
          "Нет доступных VCS провайдеров"
        );
      }

      return createResourceResponse(uri.href, JSON.stringify(result, null, 2));
    } catch (error: unknown) {
      if (error instanceof Error) {
        return createResourceResponse(
          uri.href,
          `Не удалось получить список VCS провайдеров. Причина: ${error.message}`
        );
      }

      return createResourceResponse(
        uri.href,
        `Не удалось получить список VCS провайдеров`
      );
    }
  },
};
