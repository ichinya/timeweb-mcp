import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { getK8sClusterResourcesAction } from "../actions/get-k8s-cluster-resources.action";

const inputSchema = {
  cluster_id: z.number().int().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID кластера"),
};

const handler = async (params: { cluster_id: number }) => {
  try {
    const r = await getK8sClusterResourcesAction(params.cluster_id);
    const fmt = (x: { requested: number; allocatable: number; capacity: number; used: number }) =>
      `requested=${x.requested}, allocatable=${x.allocatable}, capacity=${x.capacity}, used=${x.used}`;

    return createToolResponse(`📊 Ресурсы кластера ${params.cluster_id}:

• Нод: ${r.nodes}
• CPU (ядра): ${fmt(r.cores)}
• Memory: ${fmt(r.memory)}
• Pods: ${fmt(r.pods)}`);
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const getK8sClusterResourcesTool = {
  name: ToolNames.GET_K8S_CLUSTER_RESOURCES,
  title: "Ресурсы Kubernetes-кластера",
  description:
    "Возвращает агрегированные показатели ресурсов кластера: количество нод, CPU, memory, pods (requested/allocatable/capacity/used).",
  inputSchema,
  handler,
};
