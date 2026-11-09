import { formatRequestError } from "../exceptions/server.exception";
import { ToolNames } from "../types/tool-names.enum";
import { createToolResponse } from "../utils";
import { getDeploySettingsAction } from "../actions/get-deploy-settings.action";

const handler = async () => {
  try {
    const deploySettings = await getDeploySettingsAction();

    const responseMessage = `📋 Настройки деплоя по умолчанию:

${deploySettings
  .map(
    (setting) => `🔹 ${setting.framework}:
     build_cmd: ${setting.build_cmd ?? ""}
     index_dir: ${setting.index_dir ?? ""}
     run_cmd: ${setting.run_cmd ?? ""}`
  )
  .join("\n\n")}

💡 Эти настройки нужно использовать при создании приложения в соответствующих полях в зависимости от фреймворка`;

    return createToolResponse(responseMessage);
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const getDeploySettingsTool = {
  name: ToolNames.GET_DEPLOY_SETTINGS,
  title: "Получение настроек деплоя по умолчанию",
  description:
    "Получает список настроек деплоя по умолчанию для различных фреймворков",
  inputSchema: {},
  handler,
};
