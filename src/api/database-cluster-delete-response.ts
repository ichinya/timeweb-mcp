import { ServerException } from "../exceptions/server.exception";
import { getRequestContext } from "./request-context";

export type DatabaseClusterDeleteResult = { kind: "challenge"; hash: string } | { kind: "unconfirmed" };

// A bodyless response cannot prove deletion: the shared client exposes only data.
export function parseDatabaseClusterDeleteResponse(value: unknown): DatabaseClusterDeleteResult {
  const invalid = () => new ServerException({ kind: "invalid_response", outcome: "unknown",
    semantics: "mutation", operation: getRequestContext()?.operation });
  try {
    if (value === undefined || value === "") return { kind: "unconfirmed" };
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
    const data = value as Record<string, unknown>;
    const hashes: string[] = [];
    if (Object.hasOwn(data, "database_delete")) {
      const nested = data.database_delete;
      if (!nested || typeof nested !== "object" || Array.isArray(nested) || !Object.hasOwn(nested, "hash")) throw invalid();
      const hash = (nested as Record<string, unknown>).hash;
      if (typeof hash !== "string" || !hash.trim()) throw invalid();
      hashes.push(hash);
    }
    if (Object.hasOwn(data, "hash")) {
      if (typeof data.hash !== "string" || !data.hash.trim()) throw invalid();
      hashes.push(data.hash);
    }
    if (!hashes.length || hashes.some(hash => hash !== hashes[0])) throw invalid();
    return { kind: "challenge", hash: hashes[0] };
  } catch {
    throw invalid();
  }
}
