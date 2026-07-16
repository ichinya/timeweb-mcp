import { appsApiClient } from "../api";
import { VcsProviderRepository } from "../types/vcs-provider-repository.type";

export const getVcsProviderRepositoriesAction = async (
  providerId: string
): Promise<VcsProviderRepository[]> => {
  try {
    const response = await appsApiClient.getVcsProviderRepositories(providerId);

    return response?.repositories || [];
  } catch (error) {
    console.error(
      `❌ Ошибка при получении репозиториев провайдера ${providerId}:`,
      error
    );
    throw error;
  }
};
