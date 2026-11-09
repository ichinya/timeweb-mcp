import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { deleteContainerRegistryAction } from "../actions/delete-container-registry.action";

const inputSchema = {
  registry_id: z
    .number()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID реестра для удаления"),
};

const handler = async (params: { registry_id: number }) => {
  try {
    await deleteContainerRegistryAction(params.registry_id);
    return createToolResponse(
      `✅ Реестр контейнеров ${params.registry_id} удалён.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const deleteContainerRegistryTool = {
  name: ToolNames.DELETE_CONTAINER_REGISTRY,
  title: "Удаление реестра контейнеров",
  description:
    "Удаляет реестр контейнеров безвозвратно. ⚠️ Все образы в реестре будут потеряны. Перед удалением убедись, что реестр не используется.",
  inputSchema,
  handler,
};
