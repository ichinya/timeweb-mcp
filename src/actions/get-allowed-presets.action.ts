import { appsApiClient } from "../api";
import { formatRequestError } from "../exceptions/server.exception";

export const getAllowedPresetsAction = async (client: Pick<typeof appsApiClient, "getAllowedPresets"> = appsApiClient) => {
  try {
    const response = await client.getAllowedPresets();

    return response;
  } catch (error) {
    console.error("❌ Ошибка при получении пресетов:", formatRequestError(error));
    throw error;
  }
};
