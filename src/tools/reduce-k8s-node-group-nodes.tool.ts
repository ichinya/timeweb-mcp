import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { reduceK8sNodeGroupNodesAction } from "../actions/reduce-k8s-node-group-nodes.action";

const inputSchema = {
  cluster_id: z.number().int().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID кластера"),
  group_id: z.number().int().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID группы нод"),
  count: z
    .number()
    .int()
    .min(1)
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - количество удаляемых нод"),
};

const handler = async (params: {
  cluster_id: number;
  group_id: number;
  count: number;
}) => {
  try {
    await reduceK8sNodeGroupNodesAction(
      params.cluster_id,
      params.group_id,
      params.count
    );
    return createToolResponse(
      `✅ Из группы ${params.group_id} кластера ${params.cluster_id} удалено ${params.count} нод.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const reduceK8sNodeGroupNodesTool = {
  name: ToolNames.REDUCE_K8S_NODE_GROUP_NODES,
  title: "Уменьшение количества нод в группе",
  description:
    "Удаляет указанное количество воркер-нод из группы. Действие необратимо — удалённые ноды нельзя восстановить.",
  inputSchema,
  handler,
};
