import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { addClusterToProjectAction } from "../actions/add-cluster-to-project.action";

const inputSchema = {
  project_id: z
    .number()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID проекта, куда добавить кластер"),
  resource_id: z.number().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID кластера"),
};

const handler = async (params: {
  project_id: number;
  resource_id: number;
}) => {
  try {
    const r = await addClusterToProjectAction(
      params.project_id,
      params.resource_id
    );
    return createToolResponse(
      `✅ Кластер ${params.resource_id} добавлен в проект ${params.project_id}.\n` +
        `• ID связи: ${r.id}, тип: ${r.type}, создан: ${new Date(r.created_at).toLocaleString("ru-RU")}`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const addClusterToProjectTool = {
  name: ToolNames.ADD_CLUSTER_TO_PROJECT,
  title: "Добавление кластера в проект",
  description: "Привязывает существующий Kubernetes-кластер к проекту.",
  inputSchema,
  handler,
};
