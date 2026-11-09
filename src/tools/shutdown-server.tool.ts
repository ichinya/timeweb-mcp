import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { shutdownServerAction } from "../actions/shutdown-server.action";

const inputSchema = {
  server_id: z
    .number()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID сервера для выключения"),
};

const handler = async (params: { server_id: number }) => {
  try {
    await shutdownServerAction(params.server_id);
    return createToolResponse(
      `✅ Команда мягкого выключения (ACPI shutdown) отправлена для сервера ${params.server_id}. Статус перейдёт в turning_off → off.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const shutdownServerTool = {
  name: ToolNames.SHUTDOWN_SERVER,
  title: "Выключение сервера",
  description:
    "Мягко выключает сервер через ACPI shutdown (аналог нажатия кнопки питания). ОС корректно завершает процессы. Для принудительного выключения используй hard-shutdown через /action API (не покрыто этим tool-ом).",
  inputSchema,
  handler,
};
