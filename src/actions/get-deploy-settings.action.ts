import { appsApiClient } from "../api";

export const getDeploySettingsAction = async () => {
  try {
    const response = await appsApiClient.getDeploySettings();

    return response.default_deploy_settings;
  } catch (error) {
    console.error("❌ Ошибка при получении настроек деплоя:", error);
    throw error;
  }
};
