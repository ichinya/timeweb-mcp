import { getDatabasePresetsAction } from "../actions/get-database-presets.action";
import { ResourceNames } from "../types/resource-names.enum";
import { createResourceResponse } from "../utils";

export const databasePresetsResource = {
  name: ResourceNames.DATABASE_PRESETS,
  uri: "database-presets://all",
  title: "Пресеты баз данных",
  description: "Список доступных пресетов конфигураций для создания баз данных",
  mimeType: "application/json",
  handler: async (uri: URL) => {
    try {
      const presets = await getDatabasePresetsAction();

      if (!presets || !presets.length) {
        return createResourceResponse(
          uri.href,
          "❌ Не удалось получить список пресетов баз данных"
        );
      }

      return createResourceResponse(
        uri.href,
        `📊 **Пресеты баз данных Timeweb Cloud**\n\n${JSON.stringify(presets, null, 2)}`
      );
    } catch (error) {
      return createResourceResponse(
        uri.href,
        `❌ Ошибка получения пресетов баз данных: ${
          error instanceof Error ? error.message : "Неизвестная ошибка"
        }`
      );
    }
  },
};
