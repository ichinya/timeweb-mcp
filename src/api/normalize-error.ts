import axios from "axios";
import { OperationSemantics, RequestFailure } from "../exceptions/request-failure";
import { ServerException } from "../exceptions/server.exception";

export function parseRetryAfter(value: unknown, now: number): number | undefined {
  if (typeof value !== "string" || value.length > 64) return undefined;
  const input = value.trim();
  let result: number;
  if (/^\d+$/.test(input)) result = Number(input) * 1000;
  else {
    // Require a round-tripping IMF-fixdate; Date.parse alone accepts invalid dates/numbers.
    if (!/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(input)) return undefined;
    const date = Date.parse(input);
    if (!Number.isFinite(date) || new Date(date).toUTCString() !== input) return undefined;
    result = Math.max(0, date - now);
  }
  return Number.isSafeInteger(result) && result >= 0 ? result : undefined;
}

export function normalizeRequestError(error: unknown, context: { operation?: string; semantics: OperationSemantics }, now: number): ServerException {
  try {
    if (error instanceof ServerException) return error;
    if (!axios.isAxiosError(error)) return new ServerException({ ...context, kind: "unexpected" });
    const status = error.response?.status;
    const code = error.code;
    const body: unknown = error.response?.data;
    const data = body !== null && typeof body === "object" ? body as Record<string, unknown> : {};
    const retryHeaders = Object.entries(error.response?.headers ?? {}).filter(([name]) => name.toLowerCase() === "retry-after");
    const failure: { -readonly [K in keyof RequestFailure]?: RequestFailure[K] } = { ...context, outcome: "unknown", status,
      code, providerCode: data.error_code as string, responseId: data.response_id as string,
      retryAfterMs: parseRetryAfter(retryHeaders.length === 1 ? retryHeaders[0][1] : undefined, now),
    };
    if (axios.isCancel(error) || code === "ERR_CANCELED") failure.kind = "cancelled";
    else if (code === "ECONNABORTED" || code === "ETIMEDOUT" || status === 408) failure.kind = "timeout";
    else if (status !== undefined && status >= 200 && status < 300) failure.kind = "invalid_response";
    else if (status === 401 || status === 403) { failure.kind = "auth"; failure.outcome = "rejected"; }
    else if (status === 400 || status === 422) failure.kind = "validation";
    else if (status === 429) failure.kind = "rate_limit";
    else if (status !== undefined && status >= 500) failure.kind = "server";
    else if (status !== undefined) failure.kind = "http";
    else if (["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EPIPE", "ERR_NETWORK"].includes(code ?? "")) failure.kind = "network";
    else if (code === "ERR_BAD_RESPONSE") failure.kind = "invalid_response";
    else failure.kind = "unexpected";
    return new ServerException(failure);
  } catch {
    return new ServerException({ ...context, kind: "unexpected" });
  }
}
