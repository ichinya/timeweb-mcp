import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listServersPageAction } from "../actions/list-servers.action";
import { formatPage, normalizePageParams, pageInputSchema, PageParams, PageParamsError, pageParamsMessage } from "../pagination";

const inputSchema = pageInputSchema;

export const listServersHandler = (list = listServersPageAction) => async (params?: PageParams) => {
  try {
    const page = await list(normalizePageParams(params));
    return createToolResponse(formatPage(page, "Серверы", "На аккаунте нет серверов.", ToolNames.LIST_SERVERS,
      (s) =>
        `• ID ${s.id} — ${s.name}\n  статус: ${s.status}, локация: ${s.location}, CPU: ${s.cpu}, RAM: ${s.ram} MB\n  IPv4: ${s.main_ipv4 ?? "—"}, ОС: ${s.os?.name ?? "—"} ${s.os?.version ?? ""}`
    ));
  } catch (error) {
    if (error instanceof PageParamsError) return createToolErrorResponse(pageParamsMessage);
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const listServersTool = {
  name: ToolNames.LIST_SERVERS,
  title: "Список серверов",
  description:
    "Возвращает одну страницу VPS-серверов: ID, имя, статус, локация, CPU, RAM, IPv4, ОС, общее количество и следующее смещение. limit: 1–100 (по умолчанию 100), offset: от 0 (по умолчанию 0). Для продолжения используй указанный offset; список может меняться между запросами. Используй перед операцией над сервером, чтобы получить его ID.",
  inputSchema,
  handler: listServersHandler(),
};
