import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { deleteFloatingIpAction } from "../actions/delete-floating-ip.action";

const inputSchema = {
  floating_ip_id: z
    .string()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID плавающего IP"),
};

const handler = async (params: { floating_ip_id: string }) => {
  try {
    await deleteFloatingIpAction(params.floating_ip_id);
    return createToolResponse(
      `✅ Плавающий IP ${params.floating_ip_id} удалён.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const deleteFloatingIpTool = {
  name: ToolNames.DELETE_FLOATING_IP,
  title: "Удаление плавающего IP",
  description: "Удаляет плавающий IP по его ID",
  inputSchema,
  handler,
};
