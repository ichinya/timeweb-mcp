import { getDatabasePresetsAction } from "../actions/get-database-presets.action";
import { ResourceNames } from "../types/resource-names.enum";

export const databasePresetsResource = {
  name: ResourceNames.DATABASE_PRESETS,
  title: "Пресеты баз данных",
  description: "Список доступных пресетов конфигураций для создания баз данных",
  mimeType: "application/json",
  handler: async () => {
    try {
      const presets = await getDatabasePresetsAction();

      if (!presets || !presets.length) {
        return {
          contents: [
            {
              type: "text" as const,
              text: "❌ Не удалось получить список пресетов баз данных",
            },
          ],
        };
      }

      const content = `📊 **Пресеты баз данных Timeweb Cloud**\n\n;${JSON.stringify(presets, null, 2)}`;

      return {
        contents: [
          {
            type: "text" as const,
            text: content,
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            type: "text" as const,
            text: `❌ Ошибка получения пресетов баз данных: ${
              error instanceof Error ? error.message : "Неизвестная ошибка"
            }`,
          },
        ],
      };
    }
  },
};
