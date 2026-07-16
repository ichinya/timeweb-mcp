import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDeploySettingsAction } from "../actions/get-deploy-settings.action";
import { ResourceNames } from "../types/resource-names.enum";
import { createResourceResponse } from "../utils";

export const deploySettingsResource = {
  name: ResourceNames.DEPLOY_SETTINGS,
  uri: "deploy-settings://all",
  template: new ResourceTemplate("deploy-settings://all", { list: undefined }),
  title: "Настройки деплоя по умолчанию",
  description:
    "Настройки деплоя по умолчанию для различных фреймворков в Timeweb Cloud",
  handler: async (uri: URL) => {
    try {
      const result = await getDeploySettingsAction();

      if (!result) {
        return createResourceResponse(
          uri.href,
          "Нет доступных настроек деплоя"
        );
      }

      return createResourceResponse(uri.href, JSON.stringify(result, null, 2));
    } catch (error: unknown) {
      if (error instanceof Error) {
        return createResourceResponse(
          uri.href,
          `Не удалось получить настройки деплоя. Причина: ${error.message}`
        );
      }

      return createResourceResponse(
        uri.href,
        `Не удалось получить настройки деплоя`
      );
    }
  },
};
