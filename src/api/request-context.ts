import { AsyncLocalStorage } from "node:async_hooks";
import { safeOperation } from "../exceptions/request-failure";
import { ServerException } from "../exceptions/server.exception";

interface RequestScope { operation?: string; signal: AbortSignal; active: boolean }
const storage = new AsyncLocalStorage<RequestScope>();
export const getRequestContext = (): RequestScope | undefined => storage.getStore();

export function combineSignals(signals: (AbortSignal | undefined)[]) {
  const unique = [...new Set(signals.filter((s): s is AbortSignal => s !== undefined))];
  if (unique.length < 2) return { signal: unique[0], dispose: () => {} };
  const controller = new AbortController();
  const abort = () => controller.abort(); // Never copy untrusted signal.reason into an Error.
  for (const signal of unique) {
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  }
  return { signal: controller.signal, dispose: () => { for (const signal of unique) signal.removeEventListener("abort", abort); } };
}

export async function runRequestContext<T>(operation: string, signal: AbortSignal | undefined, callback: () => T | Promise<T>): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const scope: RequestScope = { operation: safeOperation(operation), signal: controller.signal, active: true };
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    return await storage.run(scope, async () => {
      if (scope.signal.aborted) throw new ServerException({ kind: "cancelled", outcome: "not_sent", operation: scope.operation });
      return await callback();
    });
  } finally {
    scope.active = false;
    signal?.removeEventListener("abort", abort);
    controller.abort();
  }
}

// MCP supplies extra as the last argument for tools, resources and resource templates.
export function wrapRequestHandler<Args extends unknown[], Result>(operation: string, handler: (...args: Args) => Result | Promise<Result>) {
  return async (...args: Args): Promise<Result> => {
    const extra = args[args.length - 1] as { signal?: AbortSignal } | undefined;
    try {
      return await runRequestContext(operation, extra?.signal, () => handler(...args));
    } catch (error) {
      throw error instanceof ServerException ? error : new ServerException({ kind: "unexpected", operation: safeOperation(operation) });
    }
  };
}
