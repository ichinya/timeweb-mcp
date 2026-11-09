import { z } from "zod";
import { VcsProviders } from "./types/vcs-providers.enum";
import { ServerException } from "./exceptions/server.exception";
import { getRequestContext } from "./api/request-context";

// Compare repository identity, not account login or a substring of an untrusted URL.
// Transport aliases (HTTPS / SSH / scp-style Git) may identify the same repository.
export function normalizeRepositoryUrl(value: string): string | undefined {
  try {
    const scp = /^(?:[\w.-]+@)([^/:]+):(.+)$/.exec(value);
    const url = new URL(scp ? `ssh://${scp[1]}/${scp[2]}` : value);
    if (!["https:", "http:", "ssh:", "git:"].includes(url.protocol) ||
        !url.hostname || url.search || url.hash || url.password ||
        ((url.protocol === "http:" || url.protocol === "https:") && url.username)) return undefined;
    const defaultPort = ({ "ssh:": "22", "git:": "9418" } as Record<string, string>)[url.protocol];
    const host = url.hostname.toLowerCase() + (url.port && url.port !== defaultPort ? `:${url.port}` : "");
    const path = url.pathname.replace(/\/+$/, "").replace(/\.git$/, "");
    if (!path || path === "/") return undefined;
    return `${host}${path}`;
  } catch { return undefined; }
}

const providersSchema = z.array(z.object({
  provider_id: z.string().uuid(), provider: z.nativeEnum(VcsProviders), login: z.string(),
}));
const repositoriesSchema = z.array(z.object({
  id: z.string(), url: z.string().refine(value => normalizeRepositoryUrl(value) !== undefined),
}));

function checked<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ServerException({ kind: "invalid_response", outcome: "unknown",
    semantics: "read", operation: getRequestContext()?.operation });
  return result.data;
}

export const parseVcsProviders = (value: unknown) => checked(providersSchema, value);
export const parseVcsRepositories = (value: unknown) => checked(repositoriesSchema, value);
