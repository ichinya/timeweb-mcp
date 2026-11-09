import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listAllProjectDatabasesAction } from "../actions/list-all-project-databases.action";

const inputSchema = {};

const handler = async () => {
  try {
    const items = await listAllProjectDatabasesAction();
    if (items.length === 0) {
      return createToolResponse("На аккаунте нет баз данных.");
    }
    const lines = items.map(
      (d: any) =>
        `• ID ${d.id} — ${d.name ?? "без имени"}, проект: ${d.project_id ?? "—"}, тип: ${d.type ?? "—"}, статус: ${d.status ?? "—"}`
    );
    return createToolResponse(
      `Все БД аккаунта (${items.length}):\n${lines.join("\n")}`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const listAllProjectDatabasesTool = {
  name: ToolNames.LIST_ALL_PROJECT_DATABASES,
  title: "Все БД аккаунта (по проектам)",
  description:
    "Список всех managed-БД аккаунта с привязкой к проекту (project_id).",
  inputSchema,
  handler,
};
