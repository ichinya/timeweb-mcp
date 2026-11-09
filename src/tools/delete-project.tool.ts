import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { deleteProjectAction } from "../actions/delete-project.action";

const inputSchema = {
  project_id: z
    .number()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID удаляемого проекта"),
};

const handler = async (params: { project_id: number }) => {
  try {
    await deleteProjectAction(params.project_id);
    return createToolResponse(`✅ Проект ${params.project_id} удалён.`);
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const deleteProjectTool = {
  name: ToolNames.DELETE_PROJECT,
  title: "Удаление проекта",
  description:
    "Удаляет проект. Проект по умолчанию удалить нельзя. Ресурсы останутся на аккаунте — проверь и перенеси их заранее через transfer_project_resource.",
  inputSchema,
  handler,
};
