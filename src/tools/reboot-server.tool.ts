import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { rebootServerAction } from "../actions/reboot-server.action";

const inputSchema = {
  server_id: z
    .number()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID сервера для перезагрузки"),
};

const handler = async (params: { server_id: number }) => {
  try {
    await rebootServerAction(params.server_id);
    return createToolResponse(
      `✅ Команда мягкой перезагрузки (ACPI reboot) отправлена для сервера ${params.server_id}. Статус перейдёт в rebooting → on.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const rebootServerTool = {
  name: ToolNames.REBOOT_SERVER,
  title: "Перезагрузка сервера",
  description:
    "Мягко перезагружает сервер через ACPI reboot. ОС корректно завершает процессы перед рестартом. Используй для применения обновлений ядра или сброса подвисшего состояния.",
  inputSchema,
  handler,
};
