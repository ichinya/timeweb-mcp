import { appsApiClient } from "../api";

export const getAllowedPresetsAction = async () => {
  try {
    const response = await appsApiClient.getAllowedPresets();

    return response;
  } catch (error) {
    console.error("❌ Ошибка при получении пресетов:", error);
    throw error;
  }
};
