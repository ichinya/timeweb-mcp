import { z } from "zod";
import { ServerException } from "./exceptions/server.exception";
import { getRequestContext } from "./api/request-context";

export type PageParams = { limit?: number; offset?: number };
export type Page<T> = { items: T[]; total: number; limit: number; offset: number; nextOffset: number | null };
export const pageParamsMessage = "❌ Некорректные limit/offset: limit — целое от 1 до 100, offset — неотрицательное безопасное целое; сумма должна быть безопасной. Запрос не отправлен.";
export class PageParamsError extends ServerException {
  constructor() { super({ kind: "local", outcome: "not_sent", semantics: "read" }); }
}

export const pageInputSchema = {
  limit: z.number().int().min(1).max(100).optional()
    .describe("Количество записей на странице: 1–100, по умолчанию 100. Это локальный лимит ответа."),
  offset: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional()
    .describe("Смещение от начала списка, по умолчанию 0. Сумма offset и limit должна быть безопасным целым."),
};

export function normalizePageParams(params: unknown = {}): Required<PageParams> {
  if (!params || typeof params !== "object" || Array.isArray(params)) throw new PageParamsError();
  const { limit = 100, offset = 0 } = params as PageParams;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(offset + limit)) throw new PageParamsError();
  return { limit, offset };
}

export function decodePage<T>(response: unknown, field: string, params: Required<PageParams>): Page<T> {
  const fail = () => new ServerException({ kind: "invalid_response", outcome: "unknown", semantics: "read",
    operation: getRequestContext()?.operation });
  if (!response || typeof response !== "object" || Array.isArray(response)) throw fail();
  const body = response as Record<string, unknown>;
  const items = body[field];
  const meta = body.meta;
  if (!Array.isArray(items) || items.length > params.limit || !meta || typeof meta !== "object" || Array.isArray(meta)) throw fail();
  const total = (meta as Record<string, unknown>).total;
  if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) throw fail();
  const end = params.offset + items.length;
  return { items: items as T[], total, ...params,
    nextOffset: items.length > 0 && Number.isSafeInteger(end) && end > params.offset && end < total ? end : null };
}

export function formatPage<T>(page: Page<T>, title: string, empty: string, tool: string, render: (item: T) => string): string {
  const header = `${title}: получено ${page.items.length}, всего ${page.total} (limit=${page.limit}, offset=${page.offset}).`;
  if (page.items.length === 0) {
    if (page.total === 0) return `${header}\n${empty}`;
    return `${header}\nПо указанному смещению записей нет.` +
      (page.offset < page.total ? " Ответ расходится с total; продолжение остановлено." : "");
  }
  const end = page.offset + page.items.length;
  const continuation = page.nextOffset === null ? "Следующая страница не указана." :
    `Следующая страница: ${tool} с limit=${page.limit}, offset=${page.nextOffset}.`;
  return `${header}\n\n${page.items.map(render).join("\n\n")}\n\n${continuation}` +
    (end > page.total ? "\nКоличество записей расходится с total; полнота списка не подтверждена." : "");
}
