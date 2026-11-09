import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listProjectDedicatedAction } from "../actions/list-project-dedicated.action";

const inputSchema = {
  project_id: z.number().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID проекта"),
};

const handler = async (params: { project_id: number }) => {
  try {
    const items = await listProjectDedicatedAction(params.project_id);
    if (items.length === 0) {
      return createToolResponse(
        `Выделенных серверов в проекте ${params.project_id} нет.`
      );
    }
    const lines = items.map(
      (d: any) =>
        `• ID ${d.id} — ${d.name ?? "без имени"}, CPU: ${d.cpu_description ?? "—"}, RAM: ${d.ram_description ?? "—"}`
    );
    return createToolResponse(
      `Выделенные серверы проекта ${params.project_id} (${items.length}):\n${lines.join("\n")}`
    );
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const listProjectDedicatedTool = {
  name: ToolNames.LIST_PROJECT_DEDICATED,
  title: "Выделенные серверы проекта",
  description: "Список dedicated-серверов в указанном проекте.",
  inputSchema,
  handler,
};
