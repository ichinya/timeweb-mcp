import { isDeepStrictEqual } from "node:util";
import { KnowledgeBase } from "../types/knowledge-base.type";
import { ServerException } from "../exceptions/server.exception";
import { getRequestContext } from "./request-context";

type Version = 1 | 2;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const numeric = (value: unknown, legacy: boolean) =>
  typeof value === "number" && Number.isFinite(value) && (legacy || Number.isInteger(value));

function validBase(value: unknown, version: Version, legacy: boolean): value is KnowledgeBase {
  if (!record(value)) return false;
  const own = (key: string) => Object.hasOwn(value, key);
  for (const key of ["id", "dbaas_id", "total_tokens", "used_tokens", "remaining_tokens", "token_package_id"]) {
    if (!own(key) || !numeric(value[key], legacy)) return false;
  }
  for (const key of ["name", "created_at"]) {
    if (!own(key) || typeof value[key] !== "string") return false;
  }
  for (const key of ["description", "last_sync"]) {
    // These nullable fields were optional in the historical local specification.
    if (!own(key)) { if (!legacy) return false; }
    else if (value[key] !== null && typeof value[key] !== "string") return false;
  }
  if (!own("subscription_renewal_date") ||
    (value.subscription_renewal_date !== null && typeof value.subscription_renewal_date !== "string")) return false;
  if (!own("status") || !["active", "blocked", "creating", "deleted"].includes(value.status as string)) return false;
  if (own("project_id") && !numeric(value.project_id, false)) return false;
  if (!own("agents_ids") || !Array.isArray(value.agents_ids) || !value.agents_ids.every(id => numeric(id, legacy))) return false;
  if (version === 1) {
    // Check document containers without introducing a full recursive document validator.
    if (!own("documents") || !Array.isArray(value.documents) || !value.documents.every(record)) return false;
  } else if (!own("documents_count") || !numeric(value.documents_count, legacy)) return false;
  return true;
}

export function parseKnowledgeBaseResponse(value: unknown, version: Version, list: true, mutation?: false): KnowledgeBase[];
export function parseKnowledgeBaseResponse(value: unknown, version: 1, list: false, mutation: boolean): KnowledgeBase;
export function parseKnowledgeBaseResponse(value: unknown, version: Version, list: boolean, mutation = false): KnowledgeBase | KnowledgeBase[] {
  const invalid = () => new ServerException({ kind: "invalid_response", outcome: "unknown",
    semantics: mutation ? "mutation" : "read", operation: getRequestContext()?.operation });
  try {
    if (!record(value)) throw invalid();
    const aliases = list ? ["knowledge_bases", "knowledgebases"] : ["knowledge_base", "knowledgebase"];
    const present = aliases.filter(key => Object.hasOwn(value, key));
    if (!present.length) throw invalid();
    for (const key of present) {
      const data = value[key];
      const legacy = key === aliases[1];
      if (list ? !Array.isArray(data) || !data.every(item => validBase(item, version, legacy)) : !validBase(data, version, legacy)) throw invalid();
    }
    if (present.length === 2 && !isDeepStrictEqual(value[present[0]], value[present[1]])) throw invalid();
    // Return the original data: validators must not strip additional provider fields.
    return value[present[0]] as KnowledgeBase | KnowledgeBase[];
  } catch {
    // Never retain raw payloads, getter exceptions or validation diagnostics.
    throw invalid();
  }
}
