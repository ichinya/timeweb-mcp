import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { SshKey } from "../types/ssh-key.type";
import { ServerException } from "../exceptions/server.exception";
import { getRequestContext } from "./request-context";

const keySchema: z.ZodType<SshKey> = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  body: z.string(),
  created_at: z.string().refine(value => Number.isFinite(Date.parse(value))),
  used_by: z.array(z.object({ id: z.number().int().positive(), name: z.string() })),
  is_default: z.boolean().optional(),
});

// The published specification and historical live responses use different aliases.
// Parse each present alias independently; never turn a malformed 2xx into a retry.
export function parseSshKeyResponse(value: unknown, list: true, mutation?: false): SshKey[];
export function parseSshKeyResponse(value: unknown, list: false, mutation: boolean): SshKey;
export function parseSshKeyResponse(value: unknown, list: boolean, mutation = false): SshKey | SshKey[] {
  const invalid = () => new ServerException({ kind: "invalid_response", outcome: "unknown",
    semantics: mutation ? "mutation" : "read", operation: getRequestContext()?.operation });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  const record = value as Record<string, unknown>;
  const aliases = list ? ["ssh_keys", "ssh-keys"] : ["ssh_key", "ssh-key"];
  const schema = list ? z.array(keySchema) : keySchema;
  const present = aliases.filter(alias => Object.hasOwn(record, alias));
  if (!present.length) throw invalid();
  const parsed = present.map(alias => schema.safeParse(record[alias]));
  if (parsed.some(result => !result.success)) throw invalid();
  const results = parsed.map(result => {
    if (!result.success) throw invalid();
    return result.data;
  });
  if (results.length > 1 && !isDeepStrictEqual(results[0], results[1])) throw invalid();
  return results[0];
}
