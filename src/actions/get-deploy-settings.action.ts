import { appsApiClient } from "../api";
import { formatRequestError } from "../exceptions/server.exception";

export const getDeploySettingsAction = async (client: Pick<typeof appsApiClient, "getDeploySettings"> = appsApiClient) => {
  try {
    const response = await client.getDeploySettings();

    return response.default_deploy_settings;
  } catch (error) {
    console.error("❌ Ошибка при получении настроек деплоя:", formatRequestError(error));
    throw error;
  }
};
