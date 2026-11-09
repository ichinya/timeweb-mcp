import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listAllProjectDedicatedAction } from "../actions/list-all-project-dedicated.action";

const inputSchema = {};

const handler = async () => {
  try {
    const items = await listAllProjectDedicatedAction();
    if (items.length === 0) {
      return createToolResponse("На аккаунте нет выделенных серверов.");
    }
    const lines = items.map(
      (d: any) =>
        `• ID ${d.id} — ${d.name ?? "без имени"}, проект: ${d.project_id ?? "—"}, CPU: ${d.cpu_description ?? "—"}`
    );
    return createToolResponse(
      `Все выделенные серверы аккаунта (${items.length}):\n${lines.join("\n")}`
    );
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const listAllProjectDedicatedTool = {
  name: ToolNames.LIST_ALL_PROJECT_DEDICATED,
  title: "Все выделенные серверы аккаунта (по проектам)",
  description:
    "Список всех dedicated-серверов аккаунта с привязкой к проекту.",
  inputSchema,
  handler,
};
