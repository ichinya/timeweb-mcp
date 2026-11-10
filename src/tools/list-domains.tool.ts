import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listDomainsPageAction } from "../actions/list-domains.action";
import { formatPage, normalizePageParams, pageInputSchema, PageParams, PageParamsError, pageParamsMessage } from "../pagination";

const inputSchema = pageInputSchema;

export const listDomainsHandler = (list = listDomainsPageAction) => async (params?: PageParams) => {
  try {
    const page = await list(normalizePageParams(params));
    return createToolResponse(formatPage(page, "Домены", "На аккаунте нет доменов.", ToolNames.LIST_DOMAINS, (d) => {
      const autoprolong = d.is_autoprolong_enabled ? "да" : "нет";
      return `• ID ${d.id} — ${d.fqdn}\n  статус: ${d.domain_status}, истекает: ${d.expiration}, дней осталось: ${d.days_left ?? "—"}\n  автопродление: ${autoprolong}, premium: ${d.is_premium ? "да" : "нет"}`;
    }));
  } catch (error) {
    if (error instanceof PageParamsError) return createToolErrorResponse(pageParamsMessage);
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const listDomainsTool = {
  name: ToolNames.LIST_DOMAINS,
  title: "Список доменов",
  description:
    "Возвращает одну страницу доменов: ID, FQDN, статус, дата окончания регистрации, автопродление, общее количество и следующее смещение. limit: 1–100 (по умолчанию 100), offset: от 0 (по умолчанию 0). Для продолжения используй указанный offset; список может меняться между запросами. Используй перед операцией над доменом.",
  inputSchema,
  handler: listDomainsHandler(),
};
