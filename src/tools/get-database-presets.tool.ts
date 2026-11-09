import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { getDatabasePresetsAction } from "../actions/get-database-presets.action";
import { ToolNames } from "../types/tool-names.enum";

const handler = async () => {
  try {
    const presets = await getDatabasePresetsAction();

    if (!presets || !presets.length) {
      return createToolErrorResponse(
        `❌ Не удалось получить список пресетов баз данных`
      );
    }

    const response = `📊 **Пресеты баз данных Timeweb Cloud**\n\n;${JSON.stringify(presets, null, 2)}`;

    return createToolResponse(response);
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const getDatabasePresetsTool = {
  name: ToolNames.GET_DATABASE_PRESETS,
  title: "Получение пресетов баз данных",
  description:
    "Получает список доступных пресетов конфигураций для создания баз данных",
  inputSchema: {},
  handler,
};
