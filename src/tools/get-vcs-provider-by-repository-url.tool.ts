import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { z } from "zod";
import { getVcsProvidersAction } from "../actions/get-vcs-providers.action";
import { appsApiClient } from "../api/apps";
import { normalizeRepositoryUrl, parseVcsProviders, parseVcsRepositories } from "../vcs-repository";

const inputSchema = {
  repository_url: z.string().describe("URL репозитория для поиска VCS провайдера"),
};

export const getVcsProviderByRepositoryUrlHandler = (
  client: Pick<typeof appsApiClient, "getVcsProviders" | "getVcsProviderRepositories"> = appsApiClient
) => async (params: { repository_url: string }) => {
  try {
    const identity = normalizeRepositoryUrl(params.repository_url);
    if (!identity) return createToolErrorResponse("❌ Некорректный URL Git-репозитория.");
    const providers = parseVcsProviders(await getVcsProvidersAction(client));
    const matches = [];
    for (const candidate of providers) {
      const response = await client.getVcsProviderRepositories(candidate.provider_id);
      const repositories = parseVcsRepositories(response?.repositories);
      if (repositories.some(repository => normalizeRepositoryUrl(repository.url) === identity)) matches.push(candidate);
    }
    if (!matches.length) return createToolErrorResponse("❌ Репозиторий не найден среди доступных VCS провайдеров.");
    if (matches.length > 1) return createToolErrorResponse("❌ Репозиторий доступен через несколько VCS провайдеров. Выберите provider_id явно.");
    const provider = matches[0];

    return createToolResponse(`🔍 VCS провайдер найден:

    🔹 ${provider.provider} провайдер
    ID: ${provider.provider_id}
    Name: ${provider.login}

    🎉 VCS провайдер успешно найден!`);
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const getVcsProviderByRepositoryUrlTool = {
  name: ToolNames.GET_VCS_PROVIDER_BY_REPOSITORY_URL,
  title: "Поиск VCS провайдера по URL репозитория",
  description: "Находит VCS провайдер по URL репозитория",
  inputSchema,
  handler: getVcsProviderByRepositoryUrlHandler(),
};
