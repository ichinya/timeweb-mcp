import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { unbindFloatingIpAction } from "../actions/unbind-floating-ip.action";

const inputSchema = {
  floating_ip_id: z
    .string()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID плавающего IP"),
};

const handler = async (params: { floating_ip_id: string }) => {
  try {
    await unbindFloatingIpAction(params.floating_ip_id);
    return createToolResponse(
      `✅ Плавающий IP ${params.floating_ip_id} отвязан от сервиса.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const unbindFloatingIpTool = {
  name: ToolNames.UNBIND_FLOATING_IP,
  title: "Отвязка плавающего IP от сервиса",
  description: "Отвязывает плавающий IP от текущего сервиса",
  inputSchema,
  handler,
};
