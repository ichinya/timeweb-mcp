import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { deleteK8sClusterNodeAction } from "../actions/delete-k8s-cluster-node.action";

const inputSchema = {
  cluster_id: z.number().int().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID кластера"),
  node_id: z
    .number()
    .int()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID ноды для удаления"),
};

const handler = async (params: { cluster_id: number; node_id: number }) => {
  try {
    await deleteK8sClusterNodeAction(params.cluster_id, params.node_id);
    return createToolResponse(
      `✅ Нода ${params.node_id} удалена из кластера ${params.cluster_id}.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const deleteK8sClusterNodeTool = {
  name: ToolNames.DELETE_K8S_CLUSTER_NODE,
  title: "Удаление ноды кластера",
  description:
    "Удаляет конкретную ноду из кластера. Действие необратимо.",
  inputSchema,
  handler,
};
