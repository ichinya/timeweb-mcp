import axios, { AxiosAdapter, AxiosInstance, AxiosResponseTransformer } from "axios";
import { NoTokenException } from "../exceptions/no-token.exception";
import { ServerException } from "../exceptions/server.exception";
import { OperationSemantics, safeOperation } from "../exceptions/request-failure";
import { combineSignals, getRequestContext } from "./request-context";
import { normalizeRequestError } from "./normalize-error";

export interface RequestOptions {
  signal?: AbortSignal;
  operation?: string;
  semantics?: OperationSemantics;
}
export interface ApiClientOptions {
  token?: string;
  adapter?: AxiosAdapter;
  now?: () => number;
}

export class BaseApiClient {
  private readonly token?: string;
  private readonly baseUrl: string;
  private axiosInstance: AxiosInstance;
  private readonly now: () => number;

  constructor(options: ApiClientOptions = {}) {
    this.token = options.token ?? process.env.TIMEWEB_TOKEN ?? "";
    this.now = options.now ?? Date.now;
    this.baseUrl = "https://timeweb.cloud";

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
      ...(options.adapter ? { adapter: options.adapter } : {}),
    });
  }

  checkToken(): void {
    if (!this.token) {
      throw new NoTokenException();
    }
  }

  protected async makeRequest<T>(
    method: string,
    endpoint: string,
    data?: any,
    options: RequestOptions = {}
  ): Promise<T> {
    const scope = getRequestContext();
    const context: { operation?: string; semantics: OperationSemantics } = { operation: scope ? scope.operation : safeOperation(options.operation),
      semantics: options.semantics === "read" || options.semantics === "mutation" ? options.semantics :
        (method === "GET" || method === "HEAD" ? "read" : "unspecified") as OperationSemantics };
    if (scope && !scope.active) throw new ServerException({ ...context, kind: "local", outcome: "not_sent", reason: "scope_closed" });
    const combined = combineSignals([scope?.signal, options.signal]);
    const signal = combined.signal;
    let removeAbort = () => {};
    try {
      if (signal?.aborted) throw new ServerException({ ...context, kind: "cancelled", outcome: "not_sent" });
      if (!this.token) throw new NoTokenException(context);

      const defaults = this.axiosInstance.defaults.transformResponse;
      const defaultTransforms = Array.isArray(defaults) ? defaults : defaults ? [defaults] : [];
      const transformResponse: AxiosResponseTransformer = function (data, headers, status) {
        const contentType = Object.entries(headers).find(([name]) => name.toLowerCase() === "content-type")?.[1];
        const mediaType = typeof contentType === "string" ? contentType.split(";", 1)[0].trim().toLowerCase() : "";
        const json = mediaType === "application/json" || mediaType.endsWith("+json");
        // Axios' default silent parsing treats malformed JSON as a successful string.
        // Decode declared JSON exactly once; preserve YAML/text and bodyless responses.
        if (json && typeof data === "string" && status !== undefined && status >= 200 && status < 300 && status !== 204 && status !== 205 && method !== "HEAD") {
          try {
            return JSON.parse(data.charCodeAt(0) === 0xFEFF ? data.slice(1) : data);
          } catch {
            throw new ServerException({ ...context, kind: "invalid_response", outcome: "unknown", status, code: "ERR_BAD_RESPONSE" });
          }
        }
        // Keep the previous Axios transforms for non-JSON/empty/error responses.
        // This also preserves their existing HTTP-error classification and metadata.
        for (const transform of defaultTransforms) data = transform.call(this, data, headers, status);
        return data;
      };
      // One dispatch; no retry or reconciliation. Race also handles a custom adapter ignoring signal.
      const pending = this.axiosInstance.request({ method, url: endpoint, data, signal, transformResponse: [transformResponse] });
      const cancelled = new Promise<never>((_resolve, reject) => {
        if (!signal) return;
        const abort = () => reject(new ServerException({ ...context, kind: "cancelled", outcome: "unknown" }));
        signal.addEventListener("abort", abort, { once: true });
        removeAbort = () => signal.removeEventListener("abort", abort);
        if (signal.aborted) abort();
      });
      const response = await (signal ? Promise.race([pending, cancelled]) : pending);

      return response.data;
    } catch (error: unknown) {
      let now = Number.NaN;
      try { now = this.now(); } catch { /* A diagnostic clock must not expose its exception. */ }
      throw normalizeRequestError(error, context, now);
    } finally {
      removeAbort();
      combined.dispose();
    }
  }

  protected async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>("GET", endpoint, undefined, options);
  }

  protected async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>("POST", endpoint, data, options);
  }

  protected async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>("PUT", endpoint, data, options);
  }

  protected async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>("DELETE", endpoint, undefined, options);
  }

  protected async patch<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>("PATCH", endpoint, data, options);
  }
}
