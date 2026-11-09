import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { getVcsProvidersAction } from "../actions/get-vcs-providers.action";
import { ToolNames } from "../types/tool-names.enum";

const handler = async () => {
  try {
    const providers = await getVcsProvidersAction();

    if (!providers || providers.length === 0) {
      return createToolResponse(
        `💡 VCS провайдеры не найдены. Добавьте первый провайдер с помощью tool ${ToolNames.ADD_VCS_PROVIDER}`
      );
    }

    const providersList = providers
      .map(
        (provider) =>
          `🔹 ${provider.provider} провайдер
        ID: ${provider.provider_id}
        Name: ${provider.login}`
      )
      .join("\n\n");

    return createToolResponse(`📋 Список VCS провайдеров:

    ${providersList}

    💡 Всего провайдеров: ${providers.length}

    🎉 Список провайдеров успешно получен!`);
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const getVcsProvidersTool = {
  name: ToolNames.GET_VCS_PROVIDERS,
  title: "Получение списка VCS провайдеров",
  description: "Получает список всех добавленных VCS провайдеров",
  inputSchema: {},
  handler,
};
