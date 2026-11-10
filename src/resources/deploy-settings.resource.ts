import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDeploySettingsAction } from "../actions/get-deploy-settings.action";
import { ResourceNames } from "../types/resource-names.enum";
import { jsonResourceHandler } from "../resource-handler";

export const deploySettingsHandler = (load: () => Promise<unknown> = getDeploySettingsAction) =>
  jsonResourceHandler(() => load());

export const deploySettingsResource = {
  name: ResourceNames.DEPLOY_SETTINGS,
  uri: "deploy-settings://all",
  template: new ResourceTemplate("deploy-settings://all", { list: undefined }),
  title: "Настройки деплоя по умолчанию",
  description: "Настройки деплоя по умолчанию для различных фреймворков в Timeweb Cloud",
  mimeType: "application/json" as const,
  handler: deploySettingsHandler(),
};
