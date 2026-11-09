import { ResourceNames } from "../types/resource-names.enum";
import { ToolNames } from "../types/tool-names.enum";

export type FailureKind = "local" | "auth" | "validation" | "rate_limit" | "http" |
  "server" | "timeout" | "network" | "cancelled" | "invalid_response" | "unexpected";
export type RequestOutcome = "not_sent" | "rejected" | "unknown";
export type OperationSemantics = "read" | "mutation" | "unspecified";
export interface RequestFailure {
  readonly kind: FailureKind;
  readonly outcome: RequestOutcome;
  readonly semantics: OperationSemantics;
  readonly automaticRetry: false;
  readonly recommendation: "safe_read" | "reconcile_before_repeat" | "no_automatic_retry";
  readonly status?: number;
  readonly code?: string;
  readonly providerCode?: string;
  readonly responseId?: string;
  readonly retryAfterMs?: number;
  readonly operation?: string;
  readonly reason?: "missing_token" | "scope_closed";
}

const kinds: readonly string[] = ["local", "auth", "validation", "rate_limit", "http", "server", "timeout", "network", "cancelled", "invalid_response", "unexpected"];
export const transportCodes = new Set(["ECONNABORTED", "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "ERR_NETWORK", "ERR_CANCELED", "ERR_BAD_REQUEST", "ERR_BAD_RESPONSE"]);
export const providerCodes = new Set(["unauthorized", "forbidden", "not_found", "bad_request", "validation_error", "too_many_requests", "internal_server_error"]);
const operations = new Set<string>([...Object.values(ToolNames), ...Object.values(ResourceNames)]);
export const safeOperation = (value: unknown): string | undefined =>
  typeof value === "string" && operations.has(value) ? value : undefined;

// Always copy a closed schema: even callers constructing an Error cannot attach a raw cause/config.
export function safeFailure(input: Partial<RequestFailure> = {}): RequestFailure {
  try {
    const kind = kinds.includes(input.kind ?? "") ? input.kind! : "unexpected";
    const outcome = input.outcome === "not_sent" || input.outcome === "rejected" ? input.outcome : "unknown";
    const semantics = input.semantics === "read" || input.semantics === "mutation" ? input.semantics : "unspecified";
    const status = Number.isInteger(input.status) && input.status! >= 100 && input.status! <= 599 ? input.status : undefined;
    const code = typeof input.code === "string" && transportCodes.has(input.code) ? input.code : undefined;
    const providerCode = typeof input.providerCode === "string" && providerCodes.has(input.providerCode) ? input.providerCode : undefined;
    const responseId = typeof input.responseId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.responseId) ? input.responseId : undefined;
    const retryAfterMs = Number.isSafeInteger(input.retryAfterMs) && input.retryAfterMs! >= 0 ? input.retryAfterMs : undefined;
    return Object.freeze({ kind, outcome, semantics, automaticRetry: false,
      recommendation: outcome !== "unknown" ? "no_automatic_retry" : semantics === "read" ? "safe_read" : "reconcile_before_repeat",
      ...(status === undefined ? {} : { status }), ...(code ? { code } : {}),
      ...(providerCode ? { providerCode } : {}), ...(responseId ? { responseId } : {}),
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
      ...(safeOperation(input.operation) ? { operation: safeOperation(input.operation) } : {}),
      ...(input.reason === "missing_token" || input.reason === "scope_closed" ? { reason: input.reason } : {}),
    });
  } catch {
    return Object.freeze({ kind: "unexpected", outcome: "unknown", semantics: "unspecified", automaticRetry: false, recommendation: "reconcile_before_repeat" });
  }
}

export function failureMessage(failure: RequestFailure): string {
  const f = safeFailure(failure);
  if (f.reason === "missing_token") return "❌ Не установлена переменная окружения TIMEWEB_TOKEN. Запрос не отправлен.";
  if (f.reason === "scope_closed") return "❌ Вызов уже завершён. Новый запрос не отправлен.";
  if (f.outcome === "not_sent") return f.kind === "cancelled" ? "❌ Запрос отменён до отправки." : "❌ Запрос не отправлен из-за локальной ошибки.";
  if (f.outcome === "rejected") return `❌ API отклонил запрос: ${f.status === 403 ? "недостаточно прав" : "ошибка авторизации"}.`;
  const labels: Record<FailureKind, string> = { local: "локальная ошибка", auth: "ошибка авторизации", validation: "ошибка параметров", rate_limit: "ограничение частоты", http: "ошибка HTTP", server: "ошибка сервера", timeout: "таймаут", network: "сетевая ошибка", cancelled: "отмена запроса", invalid_response: "ошибка разбора ответа", unexpected: "внутренняя ошибка обработки запроса" };
  const prefix = f.operation ? `[${f.operation}] ` : "";
  return `❌ ${prefix}${labels[f.kind]}. Результат запроса неизвестен.` +
    (f.semantics === "read" ? " Чтение можно повторить по политике вызывающего кода." : " Изменение могло выполниться. Перед повтором проверьте состояние ресурса; автоматически повторять операцию нельзя.");
}
