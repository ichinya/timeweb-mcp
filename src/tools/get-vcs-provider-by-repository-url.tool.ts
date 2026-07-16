import { createToolResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { z } from "zod";
import { getVcsProvidersAction } from "../actions/get-vcs-providers.action";

const inputSchema = {
  repository_url: z.string({
    description: "URL репозитория для поиска VCS провайдера",
  }),
};

const handler = async (params: { repository_url: string }) => {
  try {
    const providers = await getVcsProvidersAction();

    const provider = providers?.find((provider) =>
      params.repository_url.includes(provider.login.replace(/^[^\/]+\//, ''))
    );

    if (!provider) {
      return createToolResponse(
        `💡 VCS провайдеры не найдены. Добавьте первый провайдер с помощью tool ${ToolNames.ADD_VCS_PROVIDER}`
      );
    }

    return createToolResponse(`🔍 VCS провайдер найден:

    🔹 ${provider.provider} провайдер
    ID: ${provider.provider_id}
    Name: ${provider.login}

    🎉 VCS провайдер успешно найден!`);
  } catch (error) {
    if (error instanceof Error) {
      return createToolResponse(
        `❌ Ошибка при поиске VCS провайдера. Причина: ${error.message}`
      );
    }

    return createToolResponse(
      `❌ Неизвестная ошибка при поиске VCS провайдера.`
    );
  }
};

export const getVcsProviderByRepositoryUrlTool = {
  name: ToolNames.GET_VCS_PROVIDER_BY_REPOSITORY_URL,
  title: "Поиск VCS провайдера по URL репозитория",
  description: "Находит VCS провайдер по URL репозитория",
  inputSchema,
  handler,
};
