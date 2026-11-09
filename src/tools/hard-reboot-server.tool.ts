import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { hardRebootServerAction } from "../actions/hard-reboot-server.action";

const inputSchema = {
  server_id: z
    .number()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID сервера для принудительной перезагрузки"),
};

const handler = async (params: { server_id: number }) => {
  try {
    await hardRebootServerAction(params.server_id);
    return createToolResponse(
      `✅ Команда принудительной перезагрузки отправлена для сервера ${params.server_id}.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const hardRebootServerTool = {
  name: ToolNames.HARD_REBOOT_SERVER,
  title: "Принудительная перезагрузка сервера",
  description:
    "Принудительно перезагружает сервер (reset power). Использовать когда мягкий reboot_server не помогает (зависшая ОС). Данные в RAM потеряются.",
  inputSchema,
  handler,
};
