import { formatRequestError } from "../exceptions/server.exception";
import { ToolNames } from "../types/tool-names.enum";
import { createToolResponse } from "../utils";
import { getAllowedPresetsAction } from "../actions/get-allowed-presets.action";

const handler = async () => {
  try {
    const presets = await getAllowedPresetsAction();

    const responseMessage = `📋 Доступные пресеты для создания приложения:

🔹 Backend пресеты:
${
  presets.backend_presets
    ?.map(
      (preset) =>
        `ID: ${preset.id} | ${preset.description_short}
     💰 Цена: ${preset.price}₽/мес
     🖥️ CPU: ${preset.cpu}
     💾 RAM: ${preset.ram / 1024}Gb
     💿 Диск: ${preset.disk / 1024}Gb
     ⚡ Частота: ${preset.cpu_frequency}GHz`
    )
    .join("\n\n") || "  Нет доступных backend пресетов"
}

🔹 Frontend пресеты:
${
  presets.frontend_presets
    ?.map(
      (preset) =>
        `ID: ${preset.id} | ${preset.description_short}
     💰 Цена: ${preset.price}₽/мес
     💿 Диск: ${preset.disk}Mb`
    )
    .join("\n\n") || "  Нет доступных frontend пресетов"
}

💡 Используйте ID пресета при создании приложения в поле preset_id`;

    return createToolResponse(responseMessage);
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const getAllowedPresetsTool = {
  name: ToolNames.GET_ALLOWED_PRESETS,
  title: "Получение доступных пресетов для создания приложения",
  description: "Получает список доступных пресетов для создания приложения",
  inputSchema: {},
  handler,
};
