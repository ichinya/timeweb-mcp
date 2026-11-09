import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listAllProjectBalancersAction } from "../actions/list-all-project-balancers.action";

const inputSchema = {};

const handler = async () => {
  try {
    const items = await listAllProjectBalancersAction();
    if (items.length === 0) {
      return createToolResponse("На аккаунте нет балансировщиков.");
    }
    const lines = items.map(
      (b: any) =>
        `• ID ${b.id} — ${b.name ?? "без имени"}, проект: ${b.project_id ?? "—"}, статус: ${b.status ?? "—"}`
    );
    return createToolResponse(
      `Все балансировщики аккаунта (${items.length}):\n${lines.join("\n")}`
    );
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const listAllProjectBalancersTool = {
  name: ToolNames.LIST_ALL_PROJECT_BALANCERS,
  title: "Все балансировщики аккаунта (по проектам)",
  description:
    "Список всех балансировщиков на аккаунте с привязкой к проекту (project_id). Удобно искать в каком проекте висит ресурс.",
  inputSchema,
  handler,
};
