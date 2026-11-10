import { networkAttempts } from "./network-guard";
import "./tool-contracts.test";
import "./knowledge-bases.test";
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { getEventListeners } from "node:events";
import { inspect } from "node:util";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import axios, { AxiosAdapter, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BaseApiClient, RequestOptions } from "../src/api/client";
import { ServersApiClient } from "../src/api/servers";
import { AppsApiClient } from "../src/api/apps";
import { KubernetesApiClient } from "../src/api/kubernetes";
import { combineSignals, getRequestContext, runRequestContext, wrapRequestHandler } from "../src/api/request-context";
import { parseRetryAfter } from "../src/api/normalize-error";
import { ServerException, formatRequestError } from "../src/exceptions/server.exception";
import { NoTokenException } from "../src/exceptions/no-token.exception";
import { safeFailure } from "../src/exceptions/request-failure";
import { createServerHandler, createServerTool } from "../src/tools/create-server.tool";
import { getAllowedPresetsAction } from "../src/actions/get-allowed-presets.action";
import { getDeploySettingsAction } from "../src/actions/get-deploy-settings.action";
import { getVcsProviderRepositoriesAction } from "../src/actions/get-vcs-provider-repositories.action";
import { ToolNames } from "../src/types/tool-names.enum";
import { ResourceNames } from "../src/types/resource-names.enum";

class Probe extends BaseApiClient {
  read(options?: RequestOptions) { return this.get("/offline", options); }
  write(options?: RequestOptions) { return this.post("/offline", { name: "offline" }, options); }
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: "offline", headers: {} };
}
function httpError(config: InternalAxiosRequestConfig, status: number, data: unknown = {}, headers: Record<string, string> = {}) {
  const result = response(config, data, status);
  result.headers = headers;
  return new AxiosError("raw provider message", status >= 500 ? "ERR_BAD_RESPONSE" : "ERR_BAD_REQUEST", config, {}, result);
}
async function failure(promise: Promise<unknown>): Promise<ServerException> {
  try { await promise; } catch (error) { assert.ok(error instanceof ServerException); return error; }
  throw new Error("Expected a typed failure");
}
function probe(adapter: AxiosAdapter) { return new Probe({ token: "offline-dummy", adapter }); }

test("HTTP failures preserve safe details, classify conservatively and never retry", async () => {
  const cases = [[400, "validation", "unknown"], [422, "validation", "unknown"], [401, "auth", "rejected"],
    [403, "auth", "rejected"], [408, "timeout", "unknown"], [409, "http", "unknown"],
    [429, "rate_limit", "unknown"], [503, "server", "unknown"], [404, "http", "unknown"]] as const;
  for (const [status, kind, outcome] of cases) {
    let calls = 0;
    const client = probe(async config => {
      calls++;
      throw httpError(config, status, { error_code: "forbidden", response_id: "12345678-1234-4123-8123-123456789abc" }, { "retry-after": "30" });
    });
    const error = await failure(client.write({ semantics: "mutation", operation: ToolNames.CREATE_SERVER }));
    assert.equal(error.kind, kind);
    assert.equal(error.outcome, outcome);
    assert.equal(error.status, status);
    assert.equal(error.retryAfterMs, 30000);
    assert.equal(error.failure.providerCode, "forbidden");
    assert.equal(error.failure.responseId, "12345678-1234-4123-8123-123456789abc");
    assert.equal(error.failure.automaticRetry, false);
    assert.equal(error.failure.recommendation, outcome === "unknown" ? "reconcile_before_repeat" : "no_automatic_retry");
    await tick();
    assert.equal(calls, 1);
  }
});

test("transport timeouts, network, real cancellation and unexpected exceptions stay distinguishable", async () => {
  for (const [code, kind] of [["ECONNABORTED", "timeout"], ["ETIMEDOUT", "timeout"], ["ECONNRESET", "network"], ["ENOTFOUND", "network"], ["ERR_BAD_RESPONSE", "invalid_response"]]) {
    const error = await failure(probe(async config => { throw new AxiosError("untrusted", code, config); }).read());
    assert.equal(error.kind, kind);
    assert.equal(error.code, code);
    assert.equal(error.outcome, "unknown");
    assert.equal(error.failure.recommendation, "safe_read");
  }
  const cancelled = await failure(probe(async config => { throw new axios.CanceledError("untrusted reason", config); }).write());
  assert.equal(cancelled.kind, "cancelled");
  assert.equal(cancelled.code, "ERR_CANCELED");
  const unexpected = await failure(probe(async () => { throw new Error("programmer detail"); }).write());
  assert.equal(unexpected.kind, "unexpected");
  assert.doesNotMatch(unexpected.message, /programmer detail|недоступност/);
});

test("Retry-After accepts exact dates/integers without overflow or early clamping", () => {
  const now = Date.UTC(2026, 10, 9, 0, 0, 0);
  assert.equal(parseRetryAfter("0", now), 0);
  assert.equal(parseRetryAfter("30", now), 30000);
  assert.equal(parseRetryAfter(new Date(now + 60000).toUTCString(), now), 60000);
  assert.equal(parseRetryAfter(new Date(now - 60000).toUTCString(), now), 0);
  assert.equal(parseRetryAfter("864000", now), 864000000);
  for (const value of [undefined, 30, ["1", "2"], "-1", "1.5", "1, 2", "Infinity", "99999999999999999999999999", "not a date", "Mon, 31 Feb 2026 00:00:00 GMT", "2026-11-09"]) {
    assert.equal(parseRetryAfter(value, now), undefined);
  }
});

test("Retry-After headers are case insensitive and use the injected clock", async () => {
  const now = Date.UTC(2026, 10, 9, 0, 0, 0);
  const client = new Probe({ token: "offline-dummy", now: () => now, adapter: async config => {
    throw httpError(config, 429, {}, { "Retry-After": new Date(now + 60000).toUTCString() });
  } });
  assert.equal((await failure(client.write())).retryAfterMs, 60000);
  const brokenClock = new Probe({ token: "offline-dummy", now: () => { throw new Error("DO_NOT_EMIT_CLOCK"); }, adapter: async config => { throw httpError(config, 429); } });
  assert.doesNotMatch(inspect(await failure(brokenClock.write())), /DO_NOT_EMIT_CLOCK/);
});

test("missing token and pre-aborted requests never reach the adapter; cancellation wins", async () => {
  let calls = 0;
  const client = new Probe({ token: "", adapter: async () => { calls++; throw new Error("dispatch forbidden"); } });
  const noToken = await failure(client.write());
  assert.ok(noToken instanceof NoTokenException);
  assert.equal(noToken.outcome, "not_sent");
  const controller = new AbortController();
  controller.abort("secret reason");
  const aborted = await failure(client.write({ signal: controller.signal }));
  assert.equal(aborted.kind, "cancelled");
  assert.equal(aborted.outcome, "not_sent");
  let handlerCalls = 0;
  await assert.rejects(runRequestContext(ToolNames.CREATE_SERVER, controller.signal, () => { handlerCalls++; }));
  assert.equal(handlerCalls, 0);
  assert.equal(calls, 0);
  const realClient = new ServersApiClient({ token: "offline-dummy", adapter: async () => { calls++; throw new Error("dispatch forbidden"); } });
  const directAbort = await failure(realClient.createServer({ name: "offline" }, { signal: controller.signal }));
  assert.equal(directAbort.kind, "cancelled");
  assert.equal(directAbort.outcome, "not_sent");
  assert.equal(calls, 0);
});

test("lost create response has one independent provider effect and no second POST", async () => {
  for (const code of ["ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "503", "invalid_json"]) {
    const journal: { method: string; id: number }[] = [];
    const client = new ServersApiClient({ token: "offline-dummy", adapter: async config => {
      journal.push({ method: config.method!, id: 7 });
      if (code === "503") throw httpError(config, 503);
      if (code === "invalid_json") {
        const malformed = response(config, "{broken-json", 201);
        malformed.headers = { "content-type": "application/json" };
        return malformed;
      }
      throw new AxiosError("response lost", code, config, {});
    } });
    const handler = createServerHandler(body => client.createServer(body));
    const result = await runRequestContext(ToolNames.CREATE_SERVER, undefined, () => handler({ name: "offline", preset_id: 1, os_id: 1 }));
    const text = result.content[0].text;
    assert.match(text, /Результат запроса неизвестен/);
    assert.match(text, /Изменение могло выполниться/);
    assert.doesNotMatch(text, /Не удалось создать|не создан|response lost|decoder failed/);
    assert.equal(result.isError, true);
    assert.deepEqual(journal, [{ method: "post", id: 7 }]);
    await tick();
    await tick();
    assert.deepEqual(journal, [{ method: "post", id: 7 }]);
  }
});

test("actual response decoding rejects malformed declared JSON without leaking or retrying", async () => {
  const secret = "DO_NOT_EMIT_DECODE_SENTINEL";
  for (const contentType of ["application/json", "Application/JSON; charset=utf-8", "application/problem+json"]) {
    for (const kind of ["base", "servers"] as const) {
      const journal: string[] = [];
      const adapter: AxiosAdapter = async config => {
        journal.push(config.method!);
        const malformed = response(config, `{broken-${secret}`, 201);
        malformed.headers = { "Content-Type": contentType };
        return malformed;
      };
      const request = kind === "base" ? new Probe({ token: "offline-dummy", adapter }).write() :
        new ServersApiClient({ token: "offline-dummy", adapter }).createServer({ name: "offline" });
      const error = await failure(request);
      assert.equal(error.kind, "invalid_response");
      assert.equal(error.outcome, "unknown");
      assert.equal(error.status, 201);
      assert.equal(error.code, "ERR_BAD_RESPONSE");
      assert.equal(error.failure.automaticRetry, false);
      assert.equal(error.failure.recommendation, "reconcile_before_repeat");
      for (const output of [error.message, error.stack!, JSON.stringify(error), inspect(error), formatRequestError(error)]) assert.ok(!output.includes(secret));
      assert.deepEqual(journal, ["post"]);
      await tick();
      assert.deepEqual(journal, ["post"]);
    }
  }
});

test("valid JSON values decode once; YAML kubeconfig, bodyless and error responses remain compatible", async () => {
  for (const [raw, expected] of [
    ['{"ok":true}', { ok: true }], ['"literal string"', "literal string"], ["null", null],
    ["[1,2]", [1, 2]], ["true", true], ["42", 42], ['\uFEFF{"ok":true}', { ok: true }],
  ] as const) {
    const client = probe(async config => {
      const result = response(config, raw, 201);
      result.headers = { "content-type": "application/json; charset=utf-8" };
      return result;
    });
    assert.deepEqual(await client.write(), expected);
  }
  const yaml = "apiVersion: v1\nkind: Config\nclusters: []\n";
  for (const contentType of ["application/yaml", "text/yaml", "text/plain"]) {
    const kube = new KubernetesApiClient({ token: "offline-dummy", adapter: async config => {
      const result = response(config, yaml);
      result.headers = { "content-type": contentType };
      return result;
    } });
    assert.equal(await kube.getKubeconfig(42), yaml);
  }
  for (const status of [204, 205]) {
    const client = probe(async config => {
      const result = response(config, "", status);
      result.headers = { "content-type": "application/json" };
      return result;
    });
    assert.equal(await client.write(), "");
  }
  const badRequest = probe(async config => { throw httpError(config, 400, "{broken-json", { "content-type": "application/json" }); });
  const error = await failure(badRequest.write());
  assert.equal(error.kind, "validation");
  assert.equal(error.status, 400);
});

test("confirmed authorization rejection has zero effects and normal creation stays compatible", async () => {
  let effects = 0;
  const rejected = new ServersApiClient({ token: "offline-dummy", adapter: async config => { throw httpError(config, 403); } });
  assert.equal((await failure(rejected.createServer({ name: "offline" }))).outcome, "rejected");
  assert.equal(effects, 0);
  const success = new ServersApiClient({ token: "offline-dummy", adapter: async config => {
    effects++;
    return response(config, { server: { id: 7, name: "offline", status: "on", cpu: 1, ram: 1024, location: "test" } }, 201);
  } });
  const result = await createServerHandler(body => success.createServer(body))({ name: "offline", preset_id: 1, os_id: 1 });
  assert.match(result.content[0].text, /Сервер создан/);
  assert.match(result.content[0].text, /ID: 7/);
  assert.equal(effects, 1);
});

test("sanitization survives provider payloads, causes, operation names and hostile getters", async () => {
  const secret = "DO_NOT_EMIT_OFFLINE_SENTINEL";
  for (const message of [secret, [secret], { nested: secret }, null]) {
    const error = await failure(probe(async config => {
      config.headers.Authorization = secret;
      config.url = `/offline?hash=${secret}&code=${secret}`;
      config.data = { password: secret };
      const raw = httpError(config, 400, { message, error_code: secret, response_id: secret });
      Object.assign(raw, { cause: new Error(secret) });
      throw raw;
    }).write({ operation: secret }));
    assert.equal(error.failure.providerCode, undefined);
    assert.equal(error.failure.responseId, undefined);
    assert.equal(error.failure.operation, undefined);
    for (const output of [error.message, error.stack!, JSON.stringify(error), inspect(error), formatRequestError(error)]) assert.ok(!output.includes(secret));
    assert.ok(Object.isFrozen(error.failure));
  }
  const hostile = { isAxiosError: true, get response(): never { throw new Error(secret); } };
  const normalized = await failure(probe(async () => { throw hostile; }).write());
  assert.equal(normalized.kind, "unexpected");
  assert.ok(!inspect(normalized).includes(secret));
  assert.ok(!formatRequestError(new Error(secret)).includes(secret));
  assert.ok(!new ServerException(secret).message.includes(secret));
  assert.equal(safeFailure({ operation: secret, code: secret, providerCode: secret }).operation, undefined);
});

test("production action logging and mutation MCP content cannot emit sentinel secrets", async () => {
  const secret = "DO_NOT_EMIT_ACTION_SENTINEL";
  const lines: string[] = [];
  const log = console.error;
  console.error = (...args: unknown[]) => { lines.push(inspect(args)); };
  try {
    const client = new AppsApiClient({ token: "offline-dummy", adapter: async config => {
      throw httpError(config, 400, { message: secret, error_code: secret, response_id: secret });
    } });
    await assert.rejects(getAllowedPresetsAction(client));
    await assert.rejects(getDeploySettingsAction(client));
    await assert.rejects(getVcsProviderRepositoriesAction(secret, client));
    // Even unexpected exceptions from an injected dependency go through the actual action log path.
    await assert.rejects(getAllowedPresetsAction({ getAllowedPresets: async () => { throw new Error(secret); } }));
  } finally { console.error = log; }
  assert.equal(lines.length, 4);
  assert.ok(!lines.join("\n").includes(secret));
  const handler = createServerHandler(async () => { throw new Error(secret); });
  const result = await handler({ name: "offline", preset_id: 1, os_id: 1 });
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.match(result.content[0].text, /Внутренняя ошибка/);
});

test("real production catches use the safe formatter instead of raw error objects/messages", () => {
  const root = process.env.TIMEWEB_TEST_ROOT!;
  for (const dir of ["tools", "resources"]) {
    for (const file of readdirSync(path.join(root, "src", dir)).filter(f => f.endsWith(".ts"))) {
      const source = readFileSync(path.join(root, "src", dir, file), "utf8");
      assert.doesNotMatch(source, /error\.message/, `${dir}/${file}`);
      if (source.includes("catch (error")) assert.match(source, /formatRequestError\(error\)/, `${dir}/${file}`);
    }
  }
});

test("both signals cancel, listeners are removed and a closed scope cannot dispatch", async () => {
  const parent = new AbortController();
  const explicit = new AbortController();
  const ready = deferred();
  let calls = 0;
  const client = probe(async () => { calls++; ready.resolve(); return await new Promise<AxiosResponse>(() => {}); });
  const pending = failure(runRequestContext(ToolNames.CREATE_SERVER, parent.signal, () => client.write({ signal: explicit.signal, operation: ToolNames.LIST_SERVERS })));
  await ready.promise;
  parent.abort("secret parent reason");
  const error = await pending;
  assert.equal(error.kind, "cancelled");
  assert.equal(error.outcome, "unknown");
  assert.equal(error.failure.operation, ToolNames.CREATE_SERVER);
  assert.equal(getEventListeners(parent.signal, "abort").length, 0);
  assert.equal(getEventListeners(explicit.signal, "abort").length, 0);
  assert.equal(calls, 1);
  let detached!: Promise<ServerException>;
  const go = deferred();
  await runRequestContext(ToolNames.CREATE_SERVER, undefined, async () => {
    detached = failure(go.promise.then(() => client.write()));
  });
  go.resolve();
  const closed = await detached;
  assert.equal(closed.outcome, "not_sent");
  assert.equal(closed.failure.reason, "scope_closed");
  assert.equal(calls, 1);
  const combined = combineSignals([explicit.signal, explicit.signal]);
  assert.equal(combined.signal, explicit.signal);
  combined.dispose();
});

async function mcpPair(server: McpServer) {
  const client = new Client({ name: "offline", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

test("MCP cancels only its request while a concurrent real handler succeeds", async () => {
  const started = deferred();
  const settled = deferred();
  const unblock = deferred();
  const effects: string[] = [];
  const outcomes: string[] = [];
  const api = new ServersApiClient({ token: "offline-dummy", adapter: async config => {
    const body = JSON.parse(config.data as string) as { name: string };
    effects.push(body.name);
    if (body.name === "cancel") { started.resolve(); return await new Promise<AxiosResponse>(() => {}); }
    await unblock.promise;
    return response(config, { server: { id: 9, name: body.name, status: "on", cpu: 1, ram: 1024 } });
  } });
  const handler = createServerHandler(async body => {
    try { return await api.createServer(body); }
    catch (error) { assert.ok(error instanceof ServerException); outcomes.push(error.outcome); throw error; }
    finally { if (body.name === "cancel") settled.resolve(); }
  });
  const server = new McpServer({ name: "offline", version: "1" });
  server.registerTool(ToolNames.CREATE_SERVER, { inputSchema: createServerTool.inputSchema }, wrapRequestHandler(ToolNames.CREATE_SERVER, handler));
  const pair = await mcpPair(server);
  try {
    const cancellation = new AbortController();
    const cancelled = assert.rejects(pair.client.callTool({ name: ToolNames.CREATE_SERVER, arguments: { name: "cancel", preset_id: 1, os_id: 1 } }, undefined, { signal: cancellation.signal }));
    await started.promise;
    const success = pair.client.callTool({ name: ToolNames.CREATE_SERVER, arguments: { name: "success", preset_id: 1, os_id: 1 } });
    cancellation.abort();
    await cancelled;
    await settled.promise;
    unblock.resolve();
    const result = await success;
    assert.match(JSON.stringify(result), /Сервер создан/);
    assert.deepEqual(outcomes, ["unknown"]);
    assert.deepEqual(effects.sort(), ["cancel", "success"]);
    await tick();
    assert.equal(effects.length, 2);
  } finally { unblock.resolve(); await pair.close(); }
});

test("explicit cancellation is isolated from siblings and does not contaminate next requests", async () => {
  const explicit = new AbortController();
  const parent = new AbortController();
  const ready = deferred();
  const client = probe(async config => {
    if (getRequestContext()?.operation === ToolNames.CREATE_SERVER) { ready.resolve(); return await new Promise<AxiosResponse>(() => {}); }
    return response(config, { ok: true });
  });
  const first = failure(runRequestContext(ToolNames.CREATE_SERVER, parent.signal, () => client.write({ signal: explicit.signal })));
  await ready.promise;
  const second = runRequestContext(ToolNames.LIST_SERVERS, parent.signal, () => client.read());
  explicit.abort();
  assert.equal((await first).kind, "cancelled");
  assert.deepEqual(await second, { ok: true });
  assert.deepEqual(await client.read(), { ok: true });
  assert.equal(getRequestContext(), undefined);
  assert.equal(getEventListeners(parent.signal, "abort").length, 0);
  assert.equal(getEventListeners(explicit.signal, "abort").length, 0);
});

test("ordinary and template MCP resources preserve argument order and their own context", async () => {
  const operations: (string | undefined)[] = [];
  const api = probe(async config => { operations.push(getRequestContext()?.operation); return response(config, { ok: true }); });
  const server = new McpServer({ name: "offline", version: "1" });
  server.registerResource(ResourceNames.GET_VPCS, "vpc://all", {}, wrapRequestHandler(ResourceNames.GET_VPCS, async (uri: URL) => {
    await api.read();
    return { contents: [{ uri: uri.href, text: "ordinary" }] };
  }));
  server.registerResource(ResourceNames.VCS_PROVIDER_REPOSITORIES, new ResourceTemplate("vcs-provider://{provider_id}/repositories", { list: undefined }), {},
    wrapRequestHandler(ResourceNames.VCS_PROVIDER_REPOSITORIES, async (uri: URL, vars: Record<string, string | string[]>) => {
      await api.read();
      return { contents: [{ uri: uri.href, text: String(vars.provider_id) }] };
    }));
  const pair = await mcpPair(server);
  try {
    const a = await pair.client.readResource({ uri: "vpc://all" });
    const b = await pair.client.readResource({ uri: "vcs-provider://offline/repositories" });
    assert.ok("text" in a.contents[0]);
    assert.ok("text" in b.contents[0]);
    assert.equal(a.contents[0].text, "ordinary");
    assert.equal(b.contents[0].text, "offline");
    assert.deepEqual(operations, [ResourceNames.GET_VPCS, ResourceNames.VCS_PROVIDER_REPOSITORIES]);
  } finally { await pair.close(); }
});

test("sanitized errors cross the real MCP protocol without changing content shape", async () => {
  const secret = "DO_NOT_EMIT_MCP_SENTINEL";
  const api = new ServersApiClient({ token: secret, adapter: async config => {
    const error = httpError(config, 400, { message: secret, error_code: secret, response_id: secret });
    Object.assign(error, { cause: new Error(secret) });
    throw error;
  } });
  const server = new McpServer({ name: "offline", version: "1" });
  server.registerTool(ToolNames.CREATE_SERVER, { inputSchema: createServerTool.inputSchema },
    wrapRequestHandler(ToolNames.CREATE_SERVER, createServerHandler(body => api.createServer(body))));
  const pair = await mcpPair(server);
  try {
    const result = await pair.client.callTool({ name: ToolNames.CREATE_SERVER, arguments: { name: "offline", preset_id: 1, os_id: 1 } });
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.match(JSON.stringify(result), /Результат запроса неизвестен/);
    assert.equal(result.isError, true);
  } finally { await pair.close(); }
});

after(() => {
  assert.equal(networkAttempts(), 0, "No real network calls are allowed");
  const open = process.getActiveResourcesInfo().filter(name => /TCP|TLS|UDP|Timeout/.test(name));
  assert.deepEqual(open, [], "Transport tests must not leave network handles or timers");
});
