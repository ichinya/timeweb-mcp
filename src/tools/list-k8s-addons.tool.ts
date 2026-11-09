import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listK8sAddonsAction } from "../actions/list-k8s-addons.action";

const inputSchema = {
  cluster_id: z.number().int().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID кластера"),
};

const handler = async (params: { cluster_id: number }) => {
  try {
    const addons = await listK8sAddonsAction(params.cluster_id);
    if (addons.length === 0) {
      return createToolResponse(
        `В кластере ${params.cluster_id} нет установленных дополнений.`
      );
    }

    const lines = addons.map(
      (a) =>
        `• ID ${a.id} — ${a.type} v${a.version}, статус: ${a.status}, config_type: ${a.config_type}, установлено: ${new Date(a.created_at).toLocaleString("ru-RU")}`
    );

    return createToolResponse(
      `Установленные дополнения кластера ${params.cluster_id} (${addons.length}):\n${lines.join("\n")}`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const listK8sAddonsTool = {
  name: ToolNames.LIST_K8S_ADDONS,
  title: "Установленные дополнения кластера",
  description:
    "Возвращает список установленных в кластере дополнений (addons) с их ID, типом, версией и статусом.",
  inputSchema,
  handler,
};
