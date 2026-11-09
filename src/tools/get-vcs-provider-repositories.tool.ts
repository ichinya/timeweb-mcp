import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { getVcsProviderRepositoriesAction } from "../actions/get-vcs-provider-repositories.action";
import { GetVcsProviderRepositoriesRequestDto } from "../types/dto/get-vcs-provider-repositories-request.dto";

const inputSchema = {
  provider_id: z.string().describe("ID провайдера для получения списка репозиториев"),
};

const handler = async (params: GetVcsProviderRepositoriesRequestDto) => {
  try {
    const repositories = await getVcsProviderRepositoriesAction(
      params.provider_id
    );

    if (!repositories || repositories.length === 0) {
      return createToolResponse(
        `💡 Репозитории не найдены. Проверьте правильность ID провайдера: ${params.provider_id}`
      );
    }

    const repositoriesList = repositories
      .map((repo) => `🔹 ${repo.url} (ID: ${repo.id})`)
      .join("\n\n");

    return createToolResponse(`📋 Список репозиториев для провайдера ${params.provider_id}:

${repositoriesList}

💡 Всего репозиториев: ${repositories.length}

🎉 Список репозиториев успешно получен!`);
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const getVcsProviderRepositoriesTool = {
  name: ToolNames.GET_VCS_PROVIDER_REPOSITORIES,
  title: "Получение списка репозиториев VCS провайдера",
  description: "Получает список репозиториев VCS провайдера по ID",
  inputSchema,
  handler,
};
