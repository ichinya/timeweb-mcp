import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { deleteFirewallGroupAction } from "../actions/delete-firewall-group.action";

const inputSchema = {
  group_id: z
    .string()
    .describe(
      "ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID группы правил firewall для удаления"
    ),
};

const handler = async (params: { group_id: string }) => {
  try {
    await deleteFirewallGroupAction(params.group_id);
    return createToolResponse(
      `✅ Группа правил firewall ${params.group_id} удалена.`
    );
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const deleteFirewallGroupTool = {
  name: ToolNames.DELETE_FIREWALL_GROUP,
  title: "Удаление группы правил firewall",
  description:
    "Удаляет группу правил firewall. Действие необратимо. Перед удалением рекомендуется отлинковать все связанные ресурсы через unlink_firewall_resource.",
  inputSchema,
  handler,
};
