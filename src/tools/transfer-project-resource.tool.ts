import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { ProjectResourceTypeEnum } from "../types/project-resource-type.enum";
import { transferProjectResourceAction } from "../actions/transfer-project-resource.action";

const inputSchema = {
  from_project_id: z
    .number()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID проекта-источника"),
  to_project_id: z
    .number()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID проекта-приёмника"),
  resource_id: z
    .number()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID переносимого ресурса"),
  resource_type: z
    .nativeEnum(ProjectResourceTypeEnum)
    .describe(
      "ОБЯЗАТЕЛЬНОЕ ПОЛЕ - тип ресурса: server | balancer | database | kubernetes | storage | dedicated"
    ),
};

const handler = async (params: {
  from_project_id: number;
  to_project_id: number;
  resource_id: number;
  resource_type: ProjectResourceTypeEnum;
}) => {
  try {
    const allowedTypes = Object.values(ProjectResourceTypeEnum);
    if (!allowedTypes.includes(params.resource_type)) {
      return createToolErrorResponse(
        `❌ Неверный resource_type: ${params.resource_type}. Доступны: ${allowedTypes.join(", ")}`
      );
    }

    const r = await transferProjectResourceAction(
      params.from_project_id,
      params.to_project_id,
      params.resource_id,
      params.resource_type
    );

    return createToolResponse(
      `✅ Ресурс перенесён.\n` +
        `• Тип: ${r.type}\n` +
        `• resource_id: ${r.resource_id}\n` +
        `• Новый проект: ${r.project?.id ?? params.to_project_id} (${r.project?.name ?? "—"})\n` +
        `• ID связи: ${r.id}, создан: ${new Date(r.created_at).toLocaleString("ru-RU")}`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const transferProjectResourceTool = {
  name: ToolNames.TRANSFER_PROJECT_RESOURCE,
  title: "Перенос ресурса в другой проект",
  description:
    "Переносит сервер/БД/балансировщик/хранилище/кластер/dedicated из одного проекта в другой. resource_type обязателен.",
  inputSchema,
  handler,
};
