import { appsApiClient } from "../api";
import { VcsProviderRepository } from "../types/vcs-provider-repository.type";
import { formatRequestError } from "../exceptions/server.exception";

export const getVcsProviderRepositoriesAction = async (
  providerId: string,
  client: Pick<typeof appsApiClient, "getVcsProviderRepositories"> = appsApiClient
): Promise<VcsProviderRepository[]> => {
  try {
    const response = await client.getVcsProviderRepositories(providerId);

    return response?.repositories || [];
  } catch (error) {
    console.error(
      "❌ Ошибка при получении репозиториев провайдера:",
      formatRequestError(error)
    );
    throw error;
  }
};
