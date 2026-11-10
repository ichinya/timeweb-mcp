import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { runRequestContext, getRequestContext } from "./api/request-context";
import { ServerException, formatRequestError } from "./exceptions/server.exception";
import { createResourceResponse } from "./utils";

export class ResourceParamsError extends Error {
  constructor() { super("Некорректный или отсутствующий provider_id ресурса."); }
}

export function invalidResourceResult(): ServerException {
  return new ServerException({ kind: "invalid_response", outcome: "unknown", semantics: "read",
    operation: getRequestContext()?.operation });
}

export function resourceArray(value: unknown, optional = false): unknown[] {
  if (value === undefined && optional) return [];
  if (!Array.isArray(value)) throw invalidResourceResult();
  return value;
}

export function jsonResourceHandler<Args extends unknown[]>(load: (...args: Args) => Promise<unknown>,
  validate: (value: unknown) => unknown = resourceArray) {
  return async (uri: URL, ...args: Args) => {
    try { return createResourceResponse(uri.href, validate(await load(...args))); }
    catch (error) {
      if (error instanceof ResourceParamsError || error instanceof ServerException) throw error;
      throw new ServerException({ kind: "unexpected", outcome: "unknown", semantics: "read",
        operation: getRequestContext()?.operation });
    }
  };
}

// Separate from the tool wrapper: resource failures are JSON-RPC errors, not contents.
export function wrapResourceHandler<Args extends unknown[], Result>(operation: string,
  handler: (...args: Args) => Result | Promise<Result>) {
  return async (...args: Args): Promise<Result> => {
    const extra = args[args.length - 1] as { signal?: AbortSignal } | undefined;
    try { return await runRequestContext(operation, extra?.signal, () => handler(...args)); }
    catch (error) {
      if (error instanceof ResourceParamsError) {
        throw new McpError(ErrorCode.InvalidParams, "Некорректный или отсутствующий provider_id ресурса.");
      }
      const safe = error instanceof ServerException ? formatRequestError(error) :
        "Внутренняя ошибка чтения ресурса. Данные не получены.";
      // Do not pass arbitrary McpError messages or data from dependencies through.
      throw new McpError(ErrorCode.InternalError, safe);
    }
  };
}
