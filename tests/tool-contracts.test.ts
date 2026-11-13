import "./network-guard";
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { inspect } from "node:util";
import { getEventListeners } from "node:events";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import * as resources from "../src/resources";
import { allowedPresetsHandler } from "../src/resources/allowed-presets.resource";
import { databasePresetsHandler } from "../src/resources/database-presets.resource";
import { deploySettingsHandler } from "../src/resources/deploy-settings.resource";
import { getVpcsHandler } from "../src/resources/get-vpcs.resource";
import { vcsProvidersHandler } from "../src/resources/vcs-providers.resource";
import { vcsProviderRepositoriesHandler } from "../src/resources/vcs-provider-repositories.resource";
import { registerProjectResources } from "../src/register-resources";
import { wrapResourceHandler } from "../src/resource-handler";
import { ResourceNames } from "../src/types/resource-names.enum";
import { getAllowedPresetsAction } from "../src/actions/get-allowed-presets.action";
import { getDeploySettingsAction } from "../src/actions/get-deploy-settings.action";
import { getVcsProviderRepositoriesAction } from "../src/actions/get-vcs-provider-repositories.action";
import { SshKeysApiClient } from "../src/api/ssh-keys";
import { AppsApiClient } from "../src/api/apps";
import { ServersApiClient } from "../src/api/servers";
import { DomainsApiClient } from "../src/api/domains";
import { RequestOptions } from "../src/api/client";
import { serversApiClient, domainsApiClient, balancersApiClient } from "../src/api";
import { BalancersApiClient } from "../src/api/balancers";
import { listServersAction, listServersPageAction } from "../src/actions/list-servers.action";
import { listDomainsAction, listDomainsPageAction } from "../src/actions/list-domains.action";
import { listServersHandler, listServersTool } from "../src/tools/list-servers.tool";
import { listDomainsHandler, listDomainsTool } from "../src/tools/list-domains.tool";
import { PageParams } from "../src/pagination";
import { ServerException } from "../src/exceptions/server.exception";
import { createSshKeyHandler, createSshKeyTool } from "../src/tools/create-ssh-key.tool";
import { createAppHandler, createAppTool } from "../src/tools/create-app.tool";
import { createDatabaseTool } from "../src/tools/create-database.tool";
import { getVcsProviderByRepositoryUrlHandler } from "../src/tools/get-vcs-provider-by-repository-url.tool";
import { createServerHandler, createServerTool } from "../src/tools/create-server.tool";
import { checkDomainHandler, checkDomainTool } from "../src/tools/check-domain.tool";
import { deleteServerHandler, deleteServerTool } from "../src/tools/delete-server.tool";
import { listSshKeysHandler, listSshKeysTool } from "../src/tools/list-ssh-keys.tool";
import { normalizeRepositoryUrl } from "../src/vcs-repository";
import { getRequestContext, runRequestContext, wrapRequestHandler } from "../src/api/request-context";
import { registerProjectTools } from "../src/register-tools";
import { toolAnnotations } from "../src/tool-annotations";
import * as tools from "../src/tools";
import { CreateAppParams } from "../src/types/create-app-params.type";
import { AppTypes } from "../src/types/app-types.enum";
import { FrameworksBackend, FrameworksFrontend } from "../src/types/app-frameworks.type";
import { DeploySettingsDto } from "../src/types/dto/get-deploy-settings-response.dto";
import { createResourceResponse, createToolResponse } from "../src/utils";

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: "offline", headers: { "content-type": "application/json" } };
}
async function connect(server: McpServer) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "offline-contracts", version: "1" });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
const key = { id: 7, name: "offline", body: "ssh-ed25519 offline", created_at: "2026-01-01T00:00:00Z", used_by: [], is_default: false };

test("balancer MCP health-check paths map to API path and partial updates preserve omission", async () => {
  const requests: { method: string | undefined; url: string | undefined; body: Record<string, unknown> }[] = [];
  const api = new BalancersApiClient({ token: "offline-dummy", adapter: async config => {
    requests.push({ method: config.method, url: config.url, body: JSON.parse(config.data) });
    return response(config, { balancer: { id: 7, name: "offline", created_at: "2026-01-01T00:00:00Z" } });
  } });
  const create = mock.method(balancersApiClient, "createBalancer", api.createBalancer.bind(api));
  const update = mock.method(balancersApiClient, "updateBalancer", api.updateBalancer.bind(api));
  const server = new McpServer({ name: "offline-balancers", version: "1" });
  registerProjectTools(server);
  const pair = await connect(server);
  try {
    const { tools: listed } = await pair.client.listTools();
    const createSchema = listed.find(tool => tool.name === "create_balancer")!.inputSchema;
    const updateSchema = listed.find(tool => tool.name === "update_balancer")!.inputSchema;
    assert.ok(createSchema.required?.includes("health_check_path"));
    assert.ok(!updateSchema.required?.includes("health_check_path"));
    assert.equal(Object.hasOwn(createSchema.properties!, "path"), false);
    assert.equal(Object.hasOwn(updateSchema.properties!, "path"), false);
    const params = { name: "offline", algo: "roundrobin", is_sticky: false, is_use_proxy: false,
      is_ssl: false, is_keepalive: false, proto: "http", inter: 10, timeout: 5, fall: 3, rise: 2, preset_id: 1 };
    const created = await pair.client.callTool({ name: "create_balancer", arguments: { ...params, health_check_path: "/ready?service=api" } });
    assert.notEqual(created.isError, true);
    assert.deepEqual(requests[0], { method: "post", url: "/api/v1/balancers", body: { ...params, path: "/ready?service=api" } });
    const changed = await pair.client.callTool({ name: "update_balancer", arguments: { balancer_id: 7, health_check_path: "/health" } });
    assert.notEqual(changed.isError, true);
    assert.deepEqual(requests[1], { method: "patch", url: "/api/v1/balancers/7", body: { path: "/health" } });
    const renamed = await pair.client.callTool({ name: "update_balancer", arguments: { balancer_id: 7, name: "renamed" } });
    assert.notEqual(renamed.isError, true);
    assert.deepEqual(requests[2].body, { name: "renamed" });
    assert.equal(requests.length, 3);
    // The old argument must not satisfy the new required creation schema.
    const invalid = await pair.client.callTool({ name: "create_balancer", arguments: { ...params, path: "/legacy" } });
    assert.equal(invalid.isError, true);
    assert.equal(requests.length, 3);
  } finally {
    create.mock.restore(); update.mock.restore(); await pair.close();
  }
});

function resourceFixture(load: (name: string, provider?: string) => Promise<unknown>) {
  return {
    allowedPresetsResource: { ...resources.allowedPresetsResource,
      handler: allowedPresetsHandler(() => load(ResourceNames.ALLOWED_PRESETS)) },
    databasePresetsResource: { ...resources.databasePresetsResource,
      handler: databasePresetsHandler(() => load(ResourceNames.DATABASE_PRESETS)) },
    deploySettingsResource: { ...resources.deploySettingsResource,
      handler: deploySettingsHandler(() => load(ResourceNames.DEPLOY_SETTINGS)) },
    getVpcsResource: { ...resources.getVpcsResource,
      handler: getVpcsHandler(() => load(ResourceNames.GET_VPCS)) },
    vcsProvidersResource: { ...resources.vcsProvidersResource,
      handler: vcsProvidersHandler(() => load(ResourceNames.VCS_PROVIDERS)) },
    vcsProviderRepositoriesResource: { ...resources.vcsProviderRepositoriesResource,
      handler: vcsProviderRepositoriesHandler(id => load(ResourceNames.VCS_PROVIDER_REPOSITORIES, id)) },
  };
}
const resourceProvider = "11111111-1111-4111-8111-111111111111";
const resourceUri = (uri: string) => uri.replace("{provider_id}", resourceProvider);
function assertResourceJSON(result: Awaited<ReturnType<Client["readResource"]>>, uri: string, expected: unknown) {
  assert.equal(Object.hasOwn(result, "isError"), false);
  assert.equal(result.contents.length, 1);
  const content = result.contents[0];
  assert.equal(content.uri, uri);
  assert.equal(content.mimeType, "application/json");
  assert.ok("text" in content);
  assert.equal(typeof content.text, "string");
  assert.deepEqual(JSON.parse(content.text), expected);
}

test("all six real resource handlers and MCP reads expose parseable data and empty JSON", async () => {
  for (const empty of [false, true]) {
    const calls: { name: string; provider?: string; operation?: string }[] = [];
    const value = (name: string) => name === ResourceNames.ALLOWED_PRESETS ?
      { frontend_presets: empty ? [] : [{ id: 1 }], backend_presets: empty ? [] : [{ id: 2 }] } :
      empty ? [] : [{ id: 7, name: "offline", nested: { ok: true } }];
    const definitions = resourceFixture(async (name, provider) => {
      calls.push({ name, provider, operation: getRequestContext()?.operation }); return value(name);
    });
    const server = new McpServer({ name: "offline-resources", version: "1" });
    registerProjectResources(server, definitions);
    const pair = await connect(server);
    try {
      const listed = await pair.client.listResources();
      const templates = await pair.client.listResourceTemplates();
      assert.deepEqual(listed.resources.map(item => item.uri).sort(), Object.values(resources)
        .filter(item => !item.uri.includes("{" )).map(item => item.uri).sort());
      assert.equal(templates.resourceTemplates.length, 1);
      assert.equal(templates.resourceTemplates[0].uriTemplate, resources.vcsProviderRepositoriesResource.uri);
      for (const item of [...listed.resources, ...templates.resourceTemplates]) {
        const definition = Object.values(resources).find(resource => resource.name === item.name)!;
        assert.equal(item.mimeType, "application/json");
        assert.equal(item.title, definition.title); assert.equal(item.description, definition.description);
      }
      for (const definition of Object.values(definitions)) {
        const uri = resourceUri(definition.uri);
        const direct = await Reflect.apply(definition.handler, undefined, [new URL(uri), { provider_id: resourceProvider }]);
        assertResourceJSON(direct, uri, value(definition.name));
        const wire = await pair.client.readResource({ uri });
        assertResourceJSON(wire, uri, value(definition.name));
        assert.equal(calls[calls.length - 1].operation, definition.name);
      }
      assert.equal(calls.length, 12);
      const repositoryCalls = calls.filter(call => call.name === ResourceNames.VCS_PROVIDER_REPOSITORIES);
      assert.deepEqual(repositoryCalls.map(call => call.provider), [resourceProvider, resourceProvider]);
    } finally { await pair.close(); }
  }
});

test("resource top-level validation preserves only the agreed optional undefined behavior", async () => {
  const invalid: unknown[] = [undefined, null, false, 0, "DO_NOT_EMIT_RESOURCE_DATA", {}, { frontend_presets: [] },
    { frontend_presets: [], backend_presets: null }];
  for (const value of invalid) {
    const definitions = resourceFixture(async () => value);
    const server = new McpServer({ name: "offline-resource-validation", version: "1" });
    registerProjectResources(server, definitions);
    const pair = await connect(server);
    try {
      for (const definition of Object.values(definitions)) {
        const uri = resourceUri(definition.uri);
        const direct = () => Reflect.apply(definition.handler, undefined, [new URL(uri), { provider_id: resourceProvider }]);
        if (value === undefined && definition.name === ResourceNames.VCS_PROVIDERS) {
          assertResourceJSON(await direct(), uri, []);
          assertResourceJSON(await pair.client.readResource({ uri }), uri, []);
        } else {
          await assert.rejects(direct, (error: unknown) => {
            assert.ok(error instanceof ServerException); assert.equal(error.kind, "invalid_response"); return true;
          });
          await assert.rejects(pair.client.readResource({ uri }), (error: unknown) => {
            assert.ok(error instanceof McpError); assert.equal(error.code, ErrorCode.InternalError);
            assert.doesNotMatch(inspect(error), /DO_NOT_EMIT_RESOURCE_DATA/); return true;
          });
        }
      }
    } finally { await pair.close(); }
  }
});

test("resource JSON serialization fails safely and never double encodes data", async () => {
  const secret = "DO_NOT_EMIT_SERIALIZER";
  const cycle: Record<string, unknown> = { secret }; cycle.self = cycle;
  const hostile = { toJSON() { throw new Error(secret); } };
  for (const input of [undefined, () => secret, Symbol(secret), BigInt(1), cycle, hostile]) {
    assert.throws(() => createResourceResponse("vpc://all", input), (error: unknown) => {
      assert.ok(error instanceof ServerException); assert.equal(error.kind, "invalid_response");
      assert.ok(![error.message, error.stack, JSON.stringify(error), inspect(error)].join(" ").includes(secret)); return true;
    });
  }
  const definitions = resourceFixture(async name => name === ResourceNames.ALLOWED_PRESETS ?
    { frontend_presets: [hostile], backend_presets: [] } : [cycle]);
  const server = new McpServer({ name: "offline-resource-serialization", version: "1" });
  registerProjectResources(server, definitions);
  const pair = await connect(server);
  try {
    for (const definition of Object.values(definitions)) {
      await assert.rejects(pair.client.readResource({ uri: resourceUri(definition.uri) }), (error: unknown) => {
        assert.ok(error instanceof McpError); assert.equal(error.code, ErrorCode.InternalError);
        assert.ok(!inspect(error).includes(secret)); return true;
      });
    }
  } finally { await pair.close(); }
  const data = { nested: [1, "text", null] };
  assertResourceJSON(createResourceResponse("vpc://all", data), "vpc://all", data);
});

test("dependency exceptions cannot escape resource reads as successful text or arbitrary McpError", async () => {
  const secret = "DO_NOT_EMIT_RESOURCE_ERROR";
  for (const failure of [new Error(secret, { cause: secret }), new McpError(ErrorCode.InvalidParams, secret, { secret }),
    new ServerException({ kind: "server", outcome: "unknown", semantics: "read", status: 503 }), secret]) {
    const definitions = resourceFixture(async () => { throw failure; });
    const server = new McpServer({ name: "offline-resource-errors", version: "1" });
    registerProjectResources(server, definitions);
    const pair = await connect(server);
    try {
      for (const definition of Object.values(definitions)) {
        await assert.rejects(Reflect.apply(definition.handler, undefined,
          [new URL(resourceUri(definition.uri)), { provider_id: resourceProvider }]), (error: unknown) => {
          assert.ok(error instanceof ServerException);
          assert.ok(!inspect(error).includes(secret)); return true;
        });
        await assert.rejects(pair.client.readResource({ uri: resourceUri(definition.uri) }), (error: unknown) => {
          assert.ok(error instanceof McpError); assert.equal(error.code, ErrorCode.InternalError);
          assert.equal(error.data, undefined); assert.ok(!inspect(error).includes(secret)); return true;
        });
      }
    } finally { await pair.close(); }
  }
});

test("resource provider parameter errors are controlled InvalidParams before loading", async () => {
  let calls = 0;
  const handler = vcsProviderRepositoriesHandler(async () => { calls++; return []; });
  const wrapped = wrapResourceHandler(ResourceNames.VCS_PROVIDER_REPOSITORIES,
    (uri: URL, vars: Record<string, string | string[]>) => handler(uri, vars));
  for (const vars of [{}, { provider_id: "" }, { provider_id: [] }, { provider_id: ["DO_NOT_EMIT_PROVIDER"] },
    { provider_id: null }, { provider_id: false }, { provider_id: 42 }]) {
    await assert.rejects(wrapped(new URL("vcs-provider://offline/repositories"), vars as Record<string, string | string[]>), (error: unknown) => {
      assert.ok(error instanceof McpError); assert.equal(error.code, ErrorCode.InvalidParams);
      assert.match(error.message, /provider_id/); assert.ok(!inspect(error).includes("DO_NOT_EMIT_PROVIDER")); return true;
    });
  }
  assert.equal(calls, 0);
  // Force the invalid local argument behind the actual production registration as well.
  const definitions = resourceFixture(async () => { calls++; return []; });
  definitions.vcsProviderRepositoriesResource.handler = uri => handler(uri, {});
  const server = new McpServer({ name: "offline-resource-params", version: "1" });
  registerProjectResources(server, definitions);
  const pair = await connect(server);
  try {
    await assert.rejects(pair.client.readResource({ uri: "vcs-provider://offline/repositories" }), (error: unknown) => {
      assert.ok(error instanceof McpError); assert.equal(error.code, ErrorCode.InvalidParams); return true;
    });
    assert.equal(calls, 0);
  } finally { await pair.close(); }
});

type Collection = "servers" | "domains";
test("resource errors sanitize real HTTP failures and production action logging", async () => {
  const secret = "DO_NOT_EMIT_RESOURCE_HTTP";
  const logs: string[] = [];
  const logger = mock.method(console, "error", (...args: unknown[]) => { logs.push(inspect(args)); });
  let requests = 0;
  const api = new AppsApiClient({ token: secret, adapter: async config => {
    requests++;
    throw new AxiosError(secret, "ERR_BAD_RESPONSE", config, { body: secret },
      response(config, { message: secret, error_code: secret, response_id: secret }, 503));
  } });
  const definitions = resourceFixture(async (name, provider) => {
    if (name === ResourceNames.ALLOWED_PRESETS) return getAllowedPresetsAction(api);
    if (name === ResourceNames.DEPLOY_SETTINGS) return getDeploySettingsAction(api);
    if (name === ResourceNames.VCS_PROVIDER_REPOSITORIES) return getVcsProviderRepositoriesAction(provider!, api);
    return [];
  });
  const server = new McpServer({ name: "offline-resource-http", version: "1" });
  registerProjectResources(server, definitions);
  const pair = await connect(server);
  try {
    for (const definition of [definitions.allowedPresetsResource, definitions.deploySettingsResource, definitions.vcsProviderRepositoriesResource]) {
      await assert.rejects(pair.client.readResource({ uri: resourceUri(definition.uri) }), (error: unknown) => {
        assert.ok(error instanceof McpError); assert.equal(error.code, ErrorCode.InternalError);
        assert.match(error.message, /Чтение можно повторить/);
        assert.ok(![error.message, error.stack, inspect(error), JSON.stringify(error)].join(" ").includes(secret)); return true;
      });
    }
    assert.equal(requests, 3); assert.equal(logs.length, 3);
    assert.ok(!logs.join("\n").includes(secret));
  } finally { logger.mock.restore(); await pair.close(); }
});

test("resource scope rejects pre-abort and detached dispatch and releases signal listeners", async () => {
  const controller = new AbortController(); controller.abort("DO_NOT_EMIT_ABORT");
  let calls = 0;
  const wrapped = wrapResourceHandler(ResourceNames.GET_VPCS, async (uri: URL, _extra?: { signal: AbortSignal }) => {
    calls++; return createResourceResponse(uri.href, []);
  });
  await assert.rejects(wrapped(new URL("vpc://all"), { signal: controller.signal }), (error: unknown) => {
    assert.ok(error instanceof McpError); assert.equal(error.code, ErrorCode.InternalError);
    assert.match(error.message, /до отправки/); assert.ok(!inspect(error).includes("DO_NOT_EMIT_ABORT")); return true;
  });
  assert.equal(calls, 0);
  assert.equal(getEventListeners(controller.signal, "abort").length, 0);
  let go!: () => void;
  const gate = new Promise<void>(resolve => { go = resolve; });
  const journal: string[] = [];
  const api = new ServersApiClient({ token: "offline", adapter: async config => { journal.push(config.url!); return response(config, { servers: [] }); } });
  let detached!: Promise<void>;
  const active = new AbortController();
  const closeScope = wrapResourceHandler(ResourceNames.GET_VPCS, async (uri: URL, _extra?: { signal: AbortSignal }) => {
    detached = assert.rejects(gate.then(() => api.listServers()), (error: unknown) => {
      assert.ok(error instanceof ServerException); assert.equal(error.outcome, "not_sent");
      assert.equal(error.failure.reason, "scope_closed"); return true;
    });
    return createResourceResponse(uri.href, []);
  });
  assertResourceJSON(await closeScope(new URL("vpc://all"), { signal: active.signal }), "vpc://all", []);
  go(); await detached;
  assert.deepEqual(journal, []);
  assert.equal(getEventListeners(active.signal, "abort").length, 0);
  assert.equal(getRequestContext(), undefined);
});

test("MCP resource cancellation isolates a real HTTP read from a sibling", async () => {
  let start!: () => void, settle!: () => void;
  const started = new Promise<void>(resolve => { start = resolve; });
  const settled = new Promise<void>(resolve => { settle = resolve; });
  const journal: string[] = [];
  const failures: ServerException[] = [];
  const api = new ServersApiClient({ token: "offline", adapter: async config => {
    journal.push(getRequestContext()?.operation ?? "missing");
    if (getRequestContext()?.operation === ResourceNames.GET_VPCS) { start(); return new Promise<never>(() => {}); }
    return response(config, { servers: [] });
  } });
  const definitions = resourceFixture(async name => {
    try { return await api.listServers(); }
    catch (error) { assert.ok(error instanceof ServerException); failures.push(error); throw error; }
    finally { if (name === ResourceNames.GET_VPCS) settle(); }
  });
  const server = new McpServer({ name: "offline-resource-cancellation", version: "1" });
  registerProjectResources(server, definitions);
  const pair = await connect(server);
  try {
    const controller = new AbortController();
    const cancelled = assert.rejects(pair.client.readResource({ uri: "vpc://all" }, { signal: controller.signal }));
    await started;
    const sibling = pair.client.readResource({ uri: "deploy-settings://all" });
    controller.abort(); await cancelled; await settled;
    assertResourceJSON(await sibling, "deploy-settings://all", []);
    assert.equal(failures.length, 1); assert.equal(failures[0].kind, "cancelled");
    assert.equal(failures[0].outcome, "unknown"); assert.equal(failures[0].failure.semantics, "read");
    assert.deepEqual(journal, [ResourceNames.GET_VPCS, ResourceNames.DEPLOY_SETTINGS]);
  } finally { await pair.close(); }
});

const pageItem = { id: 7, name: "offline-server", status: "on", cpu: 1, ram: 1024, location: "ru-1",
  fqdn: "offline.example", domain_status: "active", expiration: "2027-01-01", is_autoprolong_enabled: false };
function pageFixture(kind: Collection, reply: (config: InternalAxiosRequestConfig) => unknown | Promise<unknown>) {
  const journal: { method: string; url: string }[] = [];
  const options = { token: "offline-dummy", adapter: async (config: InternalAxiosRequestConfig) => {
    journal.push({ method: config.method!, url: config.url! });
    return response(config, await reply(config));
  } };
  const servers = new ServersApiClient(options);
  const domains = new DomainsApiClient(options);
  return { journal, servers, domains,
    tool: kind === "servers" ? listServersTool : listDomainsTool,
    page: (params?: PageParams, request?: RequestOptions) => kind === "servers" ?
      servers.listServersPage(params, request) : domains.listDomainsPage(params, request),
    legacy: () => kind === "servers" ? servers.listServers() : domains.listDomains(),
    handler: kind === "servers" ? listServersHandler(params => listServersPageAction(params, servers)) :
      listDomainsHandler(params => listDomainsPageAction(params, domains)),
  };
}
async function callPage(fixture: ReturnType<typeof pageFixture>, input: unknown, via: "handler" | "MCP") {
  if (via === "handler") return fixture.handler(input as PageParams);
  const server = new McpServer({ name: "offline-pages", version: "1" });
  server.registerTool(fixture.tool.name, { inputSchema: fixture.tool.inputSchema },
    wrapRequestHandler(fixture.tool.name, fixture.handler));
  const pair = await connect(server);
  try {
    return await pair.client.callTool({ name: fixture.tool.name,
      ...(input === undefined ? {} : { arguments: input as Record<string, unknown> }) });
  } finally { await pair.close(); }
}

test("page API keeps totals, query parameters, boundaries and changing collections without implicit requests", async t => {
  for (const kind of ["servers", "domains"] as const) {
    await t.test(kind, async () => {
      for (const params of [undefined, {}, Object.freeze({ limit: undefined, offset: undefined })]) {
        const fixture = pageFixture(kind, () => ({ [kind]: [pageItem], meta: { total: 101 } }));
        const page = await fixture.page(params);
        assert.deepEqual(page, { items: [pageItem], total: 101, limit: 100, offset: 0, nextOffset: 1 });
        assert.deepEqual(fixture.journal, [{ method: "get", url: `/api/v1/${kind}?limit=100&offset=0` }]);
      }
      const scenarios = [
        { limit: 2, offset: 0, count: 2, total: 5, next: 2 },
        { limit: 2, offset: 2, count: 2, total: 5, next: 4 },
        { limit: 2, offset: 4, count: 1, total: 5, next: null },
        { limit: 2, offset: 2, count: 2, total: 4, next: null },
        { limit: 3, offset: 2, count: 1, total: 7, next: 3 },
        { limit: 2, offset: 0, count: 0, total: 0, next: null },
        { limit: 2, offset: 8, count: 0, total: 5, next: null },
        { limit: 2, offset: 2, count: 0, total: 5, next: null },
        { limit: 2, offset: 2, count: 1, total: 1, next: null },
        { limit: 1, offset: Number.MAX_SAFE_INTEGER - 1, count: 1, total: Number.MAX_SAFE_INTEGER, next: null },
      ];
      const fixture = pageFixture(kind, () => {
        const scenario = scenarios[fixture.journal.length - 1];
        return { [kind]: Array.from({ length: scenario.count }, (_, index) => ({ ...pageItem, id: scenario.offset + index })),
          meta: { total: scenario.total } };
      });
      for (const scenario of scenarios) {
        const params = Object.freeze({ limit: scenario.limit, offset: scenario.offset });
        const before = structuredClone(params);
        const page = await fixture.page(params);
        assert.equal(page.total, scenario.total);
        assert.equal(page.items.length, scenario.count);
        assert.equal(page.nextOffset, scenario.next);
        assert.deepEqual(params, before);
      }
      assert.deepEqual(fixture.journal, scenarios.map(s => ({ method: "get", url: `/api/v1/${kind}?limit=${s.limit}&offset=${s.offset}` })));
    });
  }
});

test("both page handlers and MCP display totals and continuation without claiming an empty account", async () => {
  for (const kind of ["servers", "domains"] as const) {
    for (const via of ["handler", "MCP"] as const) {
      for (const input of [undefined, {}, Object.freeze({ limit: 2, offset: 3 })] as (PageParams | undefined)[]) {
        const fixture = pageFixture(kind, () => ({ [kind]: [pageItem], meta: { total: 101 } }));
        const before = structuredClone(input);
        const result = await callPage(fixture, input, via);
        assert.notEqual(result.isError, true);
        const text = JSON.stringify(result);
        const limit = input?.limit ?? 100, offset = input?.offset ?? 0;
        assert.match(text, /получено 1, всего 101/);
        assert.ok(text.includes(`limit=${limit}, offset=${offset}`));
        assert.ok(text.includes(`${fixture.tool.name} с limit=${limit}, offset=${offset + 1}`));
        assert.ok(text.includes(kind === "servers" ? "offline-server" : "offline.example"));
        assert.deepEqual(input, before);
        assert.deepEqual(fixture.journal, [{ method: "get", url: `/api/v1/${kind}?limit=${limit}&offset=${offset}` }]);
      }
      for (const scenario of [
        { items: [], total: 0, offset: 0, expected: /На аккаунте нет/ },
        { items: [], total: 2, offset: 5, expected: /По указанному смещению записей нет/ },
        { items: [], total: 2, offset: 0, expected: /расходится с total; продолжение остановлено/ },
        { items: [pageItem], total: 1, offset: 0, expected: /Следующая страница не указана/ },
        { items: [pageItem], total: 0, offset: 0, expected: /полнота списка не подтверждена/ },
      ]) {
        const fixture = pageFixture(kind, () => ({ [kind]: scenario.items, meta: { total: scenario.total } }));
        const result = await callPage(fixture, { limit: 2, offset: scenario.offset }, via);
        assert.notEqual(result.isError, true);
        const text = JSON.stringify(result);
        assert.match(text, scenario.expected);
        assert.doesNotMatch(text, /Следующая страница: /);
        if (scenario.total > 0) assert.doesNotMatch(text, /На аккаунте нет/);
        assert.equal(fixture.journal.length, 1);
      }
    }
  }
});

test("invalid page parameters cannot dispatch through the API, injected handler or MCP", async () => {
  const secret = "DO_NOT_EMIT_PAGE_INPUT";
  const invalid = [null, secret, true, [], 42, { limit: null }, { offset: null },
    ...[0, -1, 1.5, 101, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, secret, true, [], { secret }].map(limit => ({ limit })),
    ...[-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, secret, true, [], { secret }].map(offset => ({ offset })),
    { limit: 1, offset: Number.MAX_SAFE_INTEGER }, { offset: Number.MAX_SAFE_INTEGER - 99 }];
  for (const kind of ["servers", "domains"] as const) {
    for (const input of invalid) {
      const fixture = pageFixture(kind, () => { throw new Error("Must not dispatch"); });
      await assert.rejects(fixture.page(input as PageParams), (error: unknown) => {
        assert.ok(error instanceof ServerException);
        assert.equal(error.kind, "local"); assert.equal(error.outcome, "not_sent");
        assert.equal(error.failure.semantics, "read");
        assert.ok(!JSON.stringify(error).includes(secret)); return true;
      });
      for (const via of ["handler", "MCP"] as const) {
        let result;
        try { result = await callPage(fixture, input, via); }
        catch (error) {
          // Non-object arguments violate the MCP envelope before tool validation.
          assert.equal(via, "MCP");
          assert.ok(input === null || typeof input !== "object" || Array.isArray(input));
          assert.ok(!String(error).includes(secret));
          continue;
        }
        assert.equal(result.isError, true);
        assert.ok(!JSON.stringify(result).includes(secret));
        if (via === "handler") assert.match(JSON.stringify(result), /limit\/offset/);
      }
      assert.deepEqual(fixture.journal, []);
    }
    let calls = 0;
    const handler = kind === "servers" ? listServersHandler(async () => { calls++; throw new Error("not called"); }) :
      listDomainsHandler(async () => { calls++; throw new Error("not called"); });
    assert.equal((await handler({ limit: 0 })).isError, true);
    assert.equal(calls, 0, "Handler validates before calling an injected action");
  }
});

test("malformed page envelopes are typed read failures without fabricated totals or leaked bodies", async () => {
  const secret = "DO_NOT_EMIT_PAGE_BODY";
  for (const kind of ["servers", "domains"] as const) {
    const invalid: unknown[] = [null, secret, [], {}, { [kind]: [] }, { [kind]: [], meta: null },
      { [kind]: [], meta: [] }, { [kind]: [], meta: {} }, { [kind]: secret, meta: { total: 1 } },
      { [kind]: [pageItem, pageItem], meta: { total: 2 } },
      ...[null, -1, 0.5, secret, true, [], { secret }, Number.MAX_SAFE_INTEGER + 1].map(total => ({ [kind]: [], meta: { total } }))];
    for (const body of invalid) {
      const fixture = pageFixture(kind, () => body);
      await assert.rejects(fixture.page({ limit: 1 }), (error: unknown) => {
        assert.ok(error instanceof ServerException);
        assert.equal(error.kind, "invalid_response"); assert.equal(error.outcome, "unknown");
        assert.equal(error.failure.semantics, "read");
        assert.equal(error.failure.automaticRetry, false);
        assert.equal(error.failure.recommendation, "safe_read");
        assert.ok(!JSON.stringify(error).includes(secret)); return true;
      });
      for (const via of ["handler", "MCP"] as const) {
        const result = await callPage(fixture, { limit: 1 }, via);
        assert.equal(result.isError, true);
        assert.match(JSON.stringify(result), /ошибка разбора ответа/);
        assert.ok(!JSON.stringify(result).includes(secret));
      }
      assert.equal(fixture.journal.length, 3, "Exactly one GET for each failed invocation");
    }
  }
});

test("an error on a subsequent page never retries or returns previous page data", async () => {
  for (const kind of ["servers", "domains"] as const) {
    for (const via of ["handler", "MCP"] as const) {
      const fixture = pageFixture(kind, config => {
        if (config.url!.endsWith("offset=0")) return { [kind]: [{ ...pageItem, name: "FIRST_PAGE_ONLY", fqdn: "FIRST_PAGE_ONLY" }], meta: { total: 2 } };
        throw new AxiosError("DO_NOT_EMIT_PAGE_HTTP", "ERR_BAD_RESPONSE", config, {}, response(config, { message: "DO_NOT_EMIT_PAGE_HTTP" }, 503));
      });
      assert.notEqual((await callPage(fixture, { limit: 1, offset: 0 }, via)).isError, true);
      const result = await callPage(fixture, { limit: 1, offset: 1 }, via);
      assert.equal(result.isError, true);
      assert.doesNotMatch(JSON.stringify(result), /FIRST_PAGE_ONLY|DO_NOT_EMIT_PAGE_HTTP/);
      assert.match(JSON.stringify(result), /Чтение можно повторить/);
      await new Promise<void>(resolve => setImmediate(resolve));
      assert.deepEqual(fixture.journal, [0, 1].map(offset => ({ method: "get", url: `/api/v1/${kind}?limit=1&offset=${offset}` })));
    }
  }
});

test("legacy arrays and actions keep working without page metadata", async () => {
  for (const kind of ["servers", "domains"] as const) {
    const fixture = pageFixture(kind, () => ({ [kind]: [pageItem] }));
    const items = await fixture.legacy();
    assert.deepEqual(items, [pageItem]);
    assert.deepEqual(fixture.journal, [{ method: "get", url: `/api/v1/${kind}` }]);
    const stub = kind === "servers" ? mock.method(serversApiClient, "listServers", async () => fixture.servers.listServers()) :
      mock.method(domainsApiClient, "listDomains", async () => fixture.domains.listDomains());
    try {
      assert.deepEqual(await (kind === "servers" ? listServersAction() : listDomainsAction()), items);
      assert.equal(fixture.journal.length, 2);
    } finally { stub.mock.restore(); }
  }
});

test("page request cancellation remains a typed read and cannot affect a sibling", async () => {
  for (const kind of ["servers", "domains"] as const) {
    let start!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    const fixture = pageFixture(kind, config => {
      if (config.url!.endsWith("offset=0")) { start(); return new Promise<never>(() => {}); }
      return { [kind]: [pageItem], meta: { total: 2 } };
    });
    const pre = new AbortController(); pre.abort();
    await assert.rejects(fixture.page(undefined, { signal: pre.signal }), (error: unknown) => {
      assert.ok(error instanceof ServerException); assert.equal(error.kind, "cancelled");
      assert.equal(error.outcome, "not_sent"); assert.equal(error.failure.semantics, "read"); return true;
    });
    assert.equal(fixture.journal.length, 0);
    const upstream = new AbortController();
    const explicit = new AbortController();
    const pending = assert.rejects(runRequestContext<unknown>(fixture.tool.name, upstream.signal,
      () => fixture.page({ limit: 1 }, { signal: explicit.signal })), (error: unknown) => {
      assert.ok(error instanceof ServerException); assert.equal(error.kind, "cancelled");
      assert.equal(error.outcome, "unknown"); assert.equal(error.failure.semantics, "read");
      assert.equal(error.failure.recommendation, "safe_read"); return true;
    });
    await started;
    const sibling = fixture.page({ limit: 1, offset: 1 });
    upstream.abort("DO_NOT_EMIT_PAGE_ABORT");
    await pending;
    assert.equal((await sibling).items.length, 1);
    assert.equal(fixture.journal.length, 2);
  }
});

test("MCP page cancellation stops its read while another page completes", async () => {
  for (const kind of ["servers", "domains"] as const) {
    let start!: () => void, settle!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    const settled = new Promise<void>(resolve => { settle = resolve; });
    const fixture = pageFixture(kind, config => {
      if (config.url!.endsWith("offset=0")) { start(); return new Promise<never>(() => {}); }
      return { [kind]: [pageItem], meta: { total: 2 } };
    });
    const failures: ServerException[] = [];
    const read = async (params?: PageParams) => {
      try { return await fixture.page(params); }
      catch (error) { assert.ok(error instanceof ServerException); failures.push(error); throw error; }
      finally { if (params?.offset === 0) settle(); }
    };
    // Keep the real tool renderer/action path and capture only the transport failure.
    const handler = kind === "servers" ? listServersHandler(params => listServersPageAction(params,
      { listServersPage: async params => await read(params) as Awaited<ReturnType<ServersApiClient["listServersPage"]>> })) :
      listDomainsHandler(params => listDomainsPageAction(params,
        { listDomainsPage: async params => await read(params) as Awaited<ReturnType<DomainsApiClient["listDomainsPage"]>> }));
    const server = new McpServer({ name: "offline-page-cancellation", version: "1" });
    server.registerTool(fixture.tool.name, { inputSchema: fixture.tool.inputSchema }, wrapRequestHandler(fixture.tool.name, handler));
    const pair = await connect(server);
    try {
      const cancellation = new AbortController();
      const cancelled = assert.rejects(pair.client.callTool({ name: fixture.tool.name, arguments: { limit: 1, offset: 0 } },
        undefined, { signal: cancellation.signal }));
      await started;
      const sibling = pair.client.callTool({ name: fixture.tool.name, arguments: { limit: 1, offset: 1 } });
      cancellation.abort();
      await cancelled;
      await settled;
      assert.notEqual((await sibling).isError, true);
      assert.equal(failures.length, 1);
      assert.equal(failures[0].kind, "cancelled"); assert.equal(failures[0].outcome, "unknown");
      assert.equal(failures[0].failure.semantics, "read");
      assert.equal(failures[0].failure.operation, fixture.tool.name);
      assert.equal(fixture.journal.length, 2);
    } finally { await pair.close(); }
  }
});

test("SSH list/create/get/update normalize both wire formats and consistent aliases", async () => {
  for (const style of ["underscore", "hyphen", "both"]) {
    const journal: string[] = [];
    const api = new SshKeysApiClient({ token: "offline-dummy", adapter: async config => {
      journal.push(config.method!);
      const list = config.method === "get" && config.url === "/api/v1/ssh-keys";
      const field = list ? "ssh_keys" : "ssh_key";
      const value = list ? [key] : key;
      const data = style === "both" ? { [field]: value, [field.replace("_", "-")]: value } :
        { [style === "hyphen" ? field.replace("_", "-") : field]: value };
      return response(config, data, config.method === "post" ? 201 : 200);
    } });
    assert.deepEqual(await api.listSshKeys(), [key]);
    assert.deepEqual(await api.createSshKey({ name: key.name, body: key.body, is_default: false }), key);
    assert.deepEqual(await api.getSshKey(7), key);
    assert.deepEqual(await api.updateSshKey(7, { name: "offline" }), key);
    assert.deepEqual(journal, ["get", "post", "get", "patch"]);
  }
});

test("SSH invalid 2xx responses are typed failures, never a second mutation", async () => {
  const badKeys = [null, "wrong", {}, { ...key, id: "7" }, { ...key, used_by: null }, { ...key, created_at: "invalid" }];
  const malformed = [null, [], {}, ...badKeys.map(value => ({ ssh_key: value })),
    { "ssh-key": {} }, { ssh_key: key, "ssh-key": { ...key, id: 8 } },
    { ssh_key: key, "ssh-key": null }];
  for (const data of malformed) {
    const effects: string[] = [];
    const api = new SshKeysApiClient({ token: "offline-dummy", adapter: async config => {
      effects.push(config.method!); return response(config, data, 201);
    } });
    await assert.rejects(api.createSshKey({ name: "offline", body: key.body, is_default: false }), error => {
      assert.ok(error instanceof ServerException);
      assert.equal(error.kind, "invalid_response");
      assert.equal(error.outcome, "unknown");
      assert.equal(error.failure.recommendation, "reconcile_before_repeat");
      return true;
    });
    assert.deepEqual(effects, ["post"]);
  }
  for (const data of [{ ssh_keys: null }, { "ssh-keys": {} }, { ssh_keys: [{}] },
    { ssh_keys: [], "ssh-keys": [key] }]) {
    const api = new SshKeysApiClient({ token: "offline-dummy", adapter: async config => response(config, data) });
    await assert.rejects(api.listSshKeys(), error => error instanceof ServerException && error.kind === "invalid_response" && error.failure.semantics === "read");
  }
});

test("SSH creation crosses MCP as success or unknown error with exactly one POST", async () => {
  for (const data of [{ "ssh-key": key }, { ssh_key: key }, {}]) {
    let effects = 0;
    const api = new SshKeysApiClient({ token: "offline-dummy", adapter: async config => {
      effects++; return response(config, data, 201);
    } });
    const server = new McpServer({ name: "offline", version: "1" });
    server.registerTool(createSshKeyTool.name, { inputSchema: createSshKeyTool.inputSchema },
      wrapRequestHandler(createSshKeyTool.name, createSshKeyHandler((name, body, is_default) => api.createSshKey({ name, body, is_default }))));
    const pair = await connect(server);
    try {
      const result = await pair.client.callTool({ name: createSshKeyTool.name, arguments: { name: "offline", body: key.body, is_default: false } });
      if (Object.keys(data).length) assert.notEqual(result.isError, true);
      else { assert.equal(result.isError, true); assert.match(JSON.stringify(result), /Изменение могло выполниться/); }
      assert.equal(effects, 1);
    } finally { await pair.close(); }
  }
});

const providerId = "11111111-1111-4111-8111-111111111111";
const otherProviderId = "33333333-3333-4333-8333-333333333333";
const repositoryId = "22222222-2222-4222-8222-222222222222";
const appParams: CreateAppParams = { type: AppTypes.BACKEND, provider_id: providerId, repository_id: repositoryId,
  repository_url: "https://github.com/org/demo.git", preset_id: 101, framework: FrameworksBackend.EXPRESS,
  commit_sha: "a".repeat(40), branch_name: "main", name: "offline", build_cmd: "npm run build", run_cmd: "npm start" };

test("dependency upgrades preserve environment records, enum choices and IPv4 validation", () => {
  assert.deepEqual(createAppTool.inputSchema.envs.parse({ MODE: "offline" }), { MODE: "offline" });
  assert.deepEqual(createAppTool.inputSchema.envs.parse(undefined), {});
  assert.equal(createAppTool.inputSchema.envs.safeParse({ MODE: 42 }).success, false);
  assert.equal(createAppTool.inputSchema.type.safeParse("backend").success, true);
  assert.equal(createAppTool.inputSchema.type.safeParse("invalid").success, false);
  assert.equal(createDatabaseTool.inputSchema.floating_ip.safeParse("192.0.2.1").success, true);
  assert.equal(createDatabaseTool.inputSchema.floating_ip.safeParse("2001:db8::1").success, false);
  assert.equal(createDatabaseTool.inputSchema.floating_ip.safeParse("invalid").success, false);
});

type Fixture = { providers?: unknown; repositories?: Record<string, unknown>; presets?: unknown; deploySettings?: unknown };
function appFixture(fixture: Fixture = {}) {
  const journal: { method: string; url: string; data?: Record<string, unknown> }[] = [];
  const providers = [{ provider: "github", provider_id: providerId, login: "personal-account" }];
  const repositories: Record<string, unknown> = { [providerId]: [{ id: repositoryId, url: "git@github.com:org/demo.git" }] };
  const api = new AppsApiClient({ token: "offline-dummy", adapter: async config => {
    const body = config.data ? JSON.parse(config.data as string) : undefined;
    journal.push({ method: config.method!, url: config.url!, data: body });
    if (config.method === "post") return response(config, { app: { ...body, id: 1, domains: [] } }, 201);
    if (config.url === "/api/v1/vcs-provider") return response(config, { providers: "providers" in fixture ? fixture.providers : providers });
    if (config.url === "/api/v1/presets/apps") return response(config, "presets" in fixture ? fixture.presets : { backend_presets: [{ id: 101 }], frontend_presets: [{ id: 202 }] });
    if (config.url === "/api/v1/deploy-settings/apps") return response(config, { default_deploy_settings: fixture.deploySettings ?? [] });
    const id = config.url!.split("/").pop()!;
    return response(config, { repositories: (fixture.repositories ?? repositories)[id] });
  } });
  return { api, journal, handler: createAppHandler(api) };
}

const frontendParams: CreateAppParams = { ...appParams, type: AppTypes.FRONTEND,
  framework: FrameworksFrontend.REACT, preset_id: 202, run_cmd: "" };
const frontendDefaults: DeploySettingsDto = { framework: "react", build_cmd: "default-build",
  run_cmd: "default-run", index_dir: "dist" };
const backendDefaults: DeploySettingsDto = { ...frontendDefaults, framework: "express" };

function withoutRun(params: CreateAppParams): CreateAppParams {
  const input = { ...params };
  delete input.run_cmd;
  return input;
}

async function callApp(fixture: ReturnType<typeof appFixture>, input: CreateAppParams, via: "handler" | "MCP") {
  if (via === "handler") return fixture.handler(input);
  const server = new McpServer({ name: "offline", version: "1" });
  server.registerTool(createAppTool.name, { inputSchema: createAppTool.inputSchema },
    wrapRequestHandler(createAppTool.name, fixture.handler));
  const pair = await connect(server);
  try {
    return await pair.client.callTool({ name: createAppTool.name, arguments: { ...input } });
  } finally { await pair.close(); }
}

test("run command policy agrees between MCP and the direct handler", async t => {
  const sentinel = "DO_NOT_EMIT_RUN_DEFAULT";
  const badDefault = { ...backendDefaults, run_cmd: { token: sentinel } };
  const cases: { name: string; input: CreateAppParams; settings?: unknown; run?: string; error?: true }[] = [
    { name: "frontend omitted command", input: withoutRun(frontendParams) },
    { name: "frontend omitted command with defaults", input: withoutRun(frontendParams), settings: [frontendDefaults] },
    { name: "frontend nonempty command is not sent", input: { ...frontendParams, run_cmd: "ignored" } },
    { name: "frontend empty command is not sent", input: frontendParams, settings: [frontendDefaults] },
    { name: "frontend ignores malformed unused default", input: withoutRun(frontendParams),
      settings: [{ ...frontendDefaults, run_cmd: { token: sentinel } }] },
    { name: "backend omitted command uses default", input: withoutRun(appParams), settings: [backendDefaults], run: "default-run" },
    { name: "backend empty default is a string", input: withoutRun(appParams), settings: [{ ...backendDefaults, run_cmd: "" }], run: "" },
    { name: "backend without a default fails", input: withoutRun(appParams), error: true },
    { name: "backend ignores defaults of another framework", input: withoutRun(appParams), settings: [frontendDefaults], error: true },
    { name: "backend default without a command fails", input: withoutRun(appParams),
      settings: [{ framework: "express", build_cmd: "default-build", index_dir: "dist" }], error: true },
    { name: "backend explicit command overrides default", input: appParams, settings: [backendDefaults], run: "npm start" },
    { name: "backend explicit empty command overrides default", input: { ...appParams, run_cmd: "" }, settings: [backendDefaults], run: "" },
    { name: "backend explicit command needs no default", input: appParams, run: "npm start" },
    { name: "backend explicit command overrides malformed default", input: appParams, settings: [badDefault], run: "npm start" },
    { name: "backend explicit empty command overrides malformed default", input: { ...appParams, run_cmd: "" }, settings: [badDefault], run: "" },
  ];
  for (const via of ["handler", "MCP"] as const) {
    for (const scenario of cases) {
      await t.test(`${via}: ${scenario.name}`, async () => {
        const fixture = appFixture({ deploySettings: scenario.settings });
        const input = structuredClone(scenario.input);
        const before = structuredClone(input);
        Object.freeze(input);
        const result = await callApp(fixture, input, via);
        assert.deepEqual(input, before);
        assert.ok(!JSON.stringify(result).includes(sentinel));
        const writes = fixture.journal.filter(item => item.method === "post");
        if (scenario.error) {
          assert.equal(result.isError, true);
          assert.match(JSON.stringify(result), /run_cmd/);
          assert.equal(writes.length, 0);
          return;
        }
        assert.notEqual(result.isError, true);
        assert.equal(writes.length, 1);
        assert.equal(writes[0].data?.provider_id, input.provider_id);
        assert.equal(writes[0].data?.repository_id, input.repository_id);
        assert.equal(writes[0].data?.preset_id, input.preset_id);
        if (input.type === AppTypes.FRONTEND) assert.equal(Object.hasOwn(writes[0].data!, "run_cmd"), false);
        else {
          assert.equal(writes[0].data?.run_cmd, scenario.run);
          assert.equal(Object.hasOwn(writes[0].data!, "index_dir"), false);
        }
      });
    }
  }
  await t.test("direct explicit undefined uses a default without altering the input", async () => {
    const fixture = appFixture({ deploySettings: [backendDefaults] });
    const input = Object.freeze({ ...appParams, run_cmd: undefined });
    const before = structuredClone(input);
    assert.equal(Object.hasOwn(input, "run_cmd"), true);
    const result = await fixture.handler(input);
    assert.notEqual(result.isError, true);
    assert.deepEqual(input, before);
    const writes = fixture.journal.filter(item => item.method === "post");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].data?.run_cmd, "default-run");
    assert.equal(writes[0].data?.provider_id, input.provider_id);
    assert.equal(writes[0].data?.repository_id, input.repository_id);
    assert.equal(writes[0].data?.preset_id, input.preset_id);
  });
});

test("invalid run command inputs are rejected before any API read without exposing values", async () => {
  const sentinel = "DO_NOT_EMIT_RUN_INPUT";
  const values: unknown[] = [null, 42, true, { token: sentinel }, [sentinel]];
  for (const via of ["handler", "MCP"] as const) {
    for (const base of [appParams, frontendParams]) {
      for (const value of values) {
        const fixture = appFixture({ deploySettings: [backendDefaults, frontendDefaults] });
        const input = { ...base, run_cmd: value } as unknown as CreateAppParams;
        const before = structuredClone(input);
        const result = await callApp(fixture, input, via);
        assert.equal(result.isError, true);
        assert.match(JSON.stringify(result), /run_cmd/);
        assert.ok(!JSON.stringify(result).includes(sentinel));
        assert.deepEqual(input, before);
        assert.deepEqual(fixture.journal, []);
      }
    }
  }
});

test("malformed selected backend defaults never dispatch a create or expose their payload", async () => {
  const sentinel = "DO_NOT_EMIT_SELECTED_RUN_DEFAULT";
  for (const via of ["handler", "MCP"] as const) {
    for (const value of [null, 42, true, { token: sentinel }, [sentinel]]) {
      const fixture = appFixture({ deploySettings: [{ ...backendDefaults, run_cmd: value }] });
      const input = withoutRun(appParams);
      const before = structuredClone(input);
      const result = await callApp(fixture, input, via);
      assert.equal(result.isError, true);
      assert.match(JSON.stringify(result), /run_cmd/);
      assert.ok(!JSON.stringify(result).includes(sentinel));
      assert.equal(fixture.journal.filter(item => item.method === "post").length, 0);
      assert.deepEqual(input, before);
    }
  }
});

test("create_app resolves deploy defaults per field without mutating input", async t => {
  const scenarios: { name: string; input: CreateAppParams; settings?: DeploySettingsDto[];
    expected: { build_cmd?: string; run_cmd?: string; index_dir?: string } | null }[] = [
    { name: "frontend missing directory uses its framework default", input: frontendParams,
      settings: [frontendDefaults], expected: { build_cmd: "npm run build", index_dir: "dist" } },
    { name: "backend missing build and run use defaults", input: { ...appParams, build_cmd: undefined, run_cmd: undefined },
      settings: [backendDefaults], expected: { build_cmd: "default-build", run_cmd: "default-run" } },
    { name: "explicit build and absent run resolve independently", input: { ...appParams, run_cmd: undefined, index_dir: "unused" },
      settings: [backendDefaults], expected: { build_cmd: "npm run build", run_cmd: "default-run" } },
    { name: "absent build and explicit run resolve independently", input: { ...appParams, build_cmd: undefined },
      settings: [backendDefaults], expected: { build_cmd: "default-build", run_cmd: "npm start" } },
    { name: "backend explicit commands override defaults", input: { ...appParams, index_dir: "unused" },
      settings: [backendDefaults], expected: { build_cmd: "npm run build", run_cmd: "npm start" } },
    { name: "frontend explicit directory overrides default", input: { ...frontendParams, index_dir: "public", run_cmd: "unused" },
      settings: [frontendDefaults], expected: { build_cmd: "npm run build", index_dir: "public" } },
    { name: "empty backend commands override nonempty defaults", input: { ...appParams, build_cmd: "", run_cmd: "" },
      settings: [backendDefaults], expected: { build_cmd: "", run_cmd: "" } },
    { name: "empty frontend build and directory override defaults", input: { ...frontendParams, build_cmd: "", index_dir: "" },
      settings: [frontendDefaults], expected: { build_cmd: "", index_dir: "" } },
    { name: "backend empty catalog cannot supply a missing run command", input: { ...appParams, build_cmd: undefined, run_cmd: undefined },
      settings: [], expected: null },
    { name: "frontend empty catalog preserves action fallback", input: { ...frontendParams, build_cmd: undefined },
      settings: [], expected: { index_dir: "" } },
    { name: "backend ignores settings of another framework", input: { ...appParams, build_cmd: undefined, run_cmd: undefined },
      settings: [frontendDefaults], expected: null },
    { name: "frontend ignores settings of another framework", input: { ...frontendParams, build_cmd: undefined },
      settings: [backendDefaults], expected: { index_dir: "" } },
    { name: "absent default run cannot supply a missing command", input: { ...appParams, build_cmd: undefined, run_cmd: undefined },
      settings: [{ framework: "express", build_cmd: "default-build", index_dir: "dist" }],
      expected: null },
    { name: "explicit values survive without matching settings", input: { ...frontendParams, index_dir: "public" },
      expected: { build_cmd: "npm run build", index_dir: "public" } },
  ];
  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const fixture = appFixture({ deploySettings: scenario.settings });
      const input = structuredClone(scenario.input);
      const before = structuredClone(input);
      const result = await fixture.handler(input);
      assert.deepEqual(input, before);
      const writes = fixture.journal.filter(item => item.method === "post");
      if (scenario.expected === null) {
        assert.equal(result.isError, true);
        assert.match(JSON.stringify(result), /run_cmd/);
        assert.equal(writes.length, 0);
        return;
      }
      assert.notEqual(result.isError, true);
      assert.equal(writes.length, 1);
      assert.equal(writes[0].url, "/api/v1/apps");
      assert.deepEqual(Object.fromEntries(Object.entries(writes[0].data!).filter(([name]) =>
        ["build_cmd", "run_cmd", "index_dir"].includes(name))), scenario.expected);
      assert.equal(writes[0].data?.provider_id, input.provider_id);
      assert.equal(writes[0].data?.repository_id, input.repository_id);
      assert.equal(writes[0].data?.preset_id, input.preset_id);
    });
  }
});

test("create_app accepts frozen input with matching deploy defaults", async () => {
  const fixture = appFixture({ deploySettings: [frontendDefaults] });
  const input: CreateAppParams = { ...frontendParams, envs: { MODE: "offline" }, system_dependencies: ["curl"] };
  const before = structuredClone(input);
  Object.freeze(input.envs);
  Object.freeze(input.system_dependencies);
  Object.freeze(input);
  const result = await fixture.handler(input);
  assert.notEqual(result.isError, true);
  assert.deepEqual(input, before);
  const writes = fixture.journal.filter(item => item.method === "post");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].data?.index_dir, "dist");
  assert.deepEqual(writes[0].data?.envs, before.envs);
  assert.deepEqual(writes[0].data?.system_dependencies, before.system_dependencies);
  assert.equal(writes[0].data?.provider_id, input.provider_id);
  assert.equal(writes[0].data?.repository_id, input.repository_id);
  assert.equal(writes[0].data?.preset_id, input.preset_id);
});

test("MCP frontend creation uses a default directory and keeps explicit build", async () => {
  const fixture = appFixture({ deploySettings: [frontendDefaults] });
  const server = new McpServer({ name: "offline", version: "1" });
  server.registerTool(createAppTool.name, { inputSchema: createAppTool.inputSchema },
    wrapRequestHandler(createAppTool.name, fixture.handler));
  const pair = await connect(server);
  try {
    const result = await pair.client.callTool({ name: createAppTool.name, arguments: { ...frontendParams } });
    assert.notEqual(result.isError, true);
    const writes = fixture.journal.filter(item => item.method === "post");
    assert.equal(writes.length, 1);
    assert.equal(writes[0].data?.index_dir, "dist");
    assert.equal(writes[0].data?.build_cmd, frontendParams.build_cmd);
    assert.equal(Object.hasOwn(writes[0].data!, "run_cmd"), false);
    assert.equal(writes[0].data?.provider_id, frontendParams.provider_id);
    assert.equal(writes[0].data?.repository_id, frontendParams.repository_id);
    assert.equal(writes[0].data?.preset_id, frontendParams.preset_id);
  } finally { await pair.close(); }
});

test("create_app preserves the selected provider, repository and tariff across MCP", async () => {
  const fixture = appFixture();
  const server = new McpServer({ name: "offline", version: "1" });
  server.registerTool(createAppTool.name, { inputSchema: createAppTool.inputSchema }, wrapRequestHandler(createAppTool.name, fixture.handler));
  const pair = await connect(server);
  try {
    for (const repository_url of [appParams.repository_url, "git@github.com:org/demo.git", "ssh://git@github.com:22/org/demo.git", "https://github.com/org/demo.git/"]) {
      const result = await pair.client.callTool({ name: createAppTool.name, arguments: { ...appParams, repository_url } });
      assert.notEqual(result.isError, true);
    }
    const writes = fixture.journal.filter(item => item.method === "post");
    assert.equal(writes.length, 4);
    for (const write of writes) {
      assert.equal(write.data?.provider_id, providerId);
      assert.equal(write.data?.repository_id, repositoryId);
      assert.equal(write.data?.preset_id, 101);
    }
  } finally { await pair.close(); }
});

test("create_app rejects invalid selection and malformed catalogs without a POST", async () => {
  const cases: { patch?: Record<string, unknown>; fixture?: Fixture }[] = [
    { patch: { provider_id: otherProviderId } },
    { patch: { repository_id: otherProviderId } },
    { patch: { repository_url: "https://other-host.invalid/org/demo" } },
    { patch: { repository_url: "https://github.com/another-owner/demo" } },
    { patch: { preset_id: 999 } }, { patch: { preset_id: 202 } },
    { patch: { preset_id: "101" } }, { patch: { preset_id: undefined } },
    { patch: { preset_id: 0 } }, { patch: { type: "invalid" } },
    { patch: { repository_url: "file:///org/demo" } },
    { fixture: { presets: null } },
    { fixture: { presets: {} } },
    { fixture: { presets: { backend_presets: [], frontend_presets: [{ id: 101 }] } } },
    { fixture: { presets: { backend_presets: null } } },
    { fixture: { presets: { backend_presets: [{ id: "101" }] } } },
    { fixture: { providers: [] } }, { fixture: { providers: null } }, { fixture: { providers: [{}] } },
    { fixture: { repositories: { [providerId]: [] } } },
    { fixture: { repositories: { [providerId]: null } } },
  ];
  for (const scenario of cases) {
    const fixture = appFixture(scenario.fixture);
    const result = await fixture.handler({ ...appParams, ...scenario.patch } as CreateAppParams);
    assert.equal(result.isError, true, JSON.stringify(scenario));
    assert.equal(fixture.journal.filter(item => item.method === "post").length, 0);
    assert.ok(fixture.journal.every(item => item.method === "get"));
  }
});

test("repository matching preserves owner, host and path case, supports Git transports", () => {
  const expected = "git.example.test/team/nested/Repo";
  for (const url of ["https://git.example.test/team/nested/Repo.git/", "ssh://git@git.example.test:22/team/nested/Repo.git", "git@git.example.test:team/nested/Repo.git"]) {
    assert.equal(normalizeRepositoryUrl(url), expected);
  }
  assert.notEqual(normalizeRepositoryUrl("https://git.example.test/team/nested/repo"), expected);
  for (const url of ["file:///org/demo", "https://user:secret@github.com/org/demo", "https://github.com/org/demo?token=secret", "not a url"]) {
    assert.equal(normalizeRepositoryUrl(url), undefined);
  }
});

test("VCS helper searches repository membership and rejects ambiguity and substring spoofing", async () => {
  const providers = [providerId, otherProviderId].map(id => ({ provider: "github", provider_id: id, login: "demo" }));
  for (const scenario of ["unique", "ambiguous", "foreign-host", "other-owner", "none", "malformed"]) {
    const fixture = appFixture({ providers,
      repositories: {
        [providerId]: scenario === "malformed" ? null : [{ id: repositoryId, url: "https://github.com/org/demo" }],
        [otherProviderId]: scenario === "ambiguous" ? [{ id: repositoryId, url: "https://github.com/org/demo.git/" }] : [],
      } });
    const url = scenario === "foreign-host" ? "https://other-host.invalid/org/demo" :
      scenario === "other-owner" ? "https://github.com/another-owner/demo" :
      scenario === "none" ? "https://github.com/org/absent" : appParams.repository_url;
    const result = await getVcsProviderByRepositoryUrlHandler(fixture.api)({ repository_url: url });
    if (scenario === "unique") { assert.notEqual(result.isError, true); assert.match(JSON.stringify(result), new RegExp(providerId)); }
    else assert.equal(result.isError, true, scenario);
    assert.ok(fixture.journal.every(item => item.method === "get"));
  }
});

test("MCP error flag covers token, HTTP, business validation and unknown outcomes without secrets", async () => {
  const secret = "DO_NOT_EMIT_CONTRACT_SENTINEL";
  for (const mode of ["token", "http", "unknown", "validation", "success"]) {
    let calls = 0;
    const api = new SshKeysApiClient({ token: mode === "token" ? "" : secret, adapter: async config => {
      calls++;
      if (mode === "http") throw new AxiosError(secret, "ERR_BAD_REQUEST", config, {}, response(config, { message: secret }, 403));
      return response(config, mode === "unknown" ? { message: secret } : { "ssh-key": key }, 201);
    } });
    const server = new McpServer({ name: "offline", version: "1" });
    server.registerTool(createSshKeyTool.name, { inputSchema: createSshKeyTool.inputSchema },
      wrapRequestHandler(createSshKeyTool.name, createSshKeyHandler((name, body, is_default) => api.createSshKey({ name, body, is_default }))));
    server.registerTool(createServerTool.name, { inputSchema: createServerTool.inputSchema }, createServerHandler(async () => { throw new Error("must not dispatch"); }));
    server.registerTool("empty_list", { inputSchema: {} }, async () => createToolResponse("[]"));
    const pair = await connect(server);
    try {
      const result = await pair.client.callTool(mode === "validation" ? { name: createServerTool.name, arguments: { name: "offline" } } :
        { name: createSshKeyTool.name, arguments: { name: "offline", body: key.body, is_default: false } });
      if (mode === "success") assert.notEqual(result.isError, true);
      else assert.equal(result.isError, true);
      assert.ok(!JSON.stringify(result).includes(secret));
      assert.equal(calls, mode === "token" || mode === "validation" ? 0 : 1);
      assert.notEqual((await pair.client.callTool({ name: "empty_list", arguments: {} })).isError, true);
    } finally { await pair.close(); }
  }
});

test("production tools/list exposes complete explicit annotations", async () => {
  assert.deepEqual(Object.keys(toolAnnotations).sort(), Object.keys(tools).sort());
  const server = new McpServer({ name: "offline", version: "1" });
  registerProjectTools(server);
  const pair = await connect(server);
  try {
    const listed = [];
    let cursor: string | undefined;
    do {
      const page = await pair.client.listTools({ cursor });
      listed.push(...page.tools); cursor = page.nextCursor;
    } while (cursor);
    assert.equal(listed.length, Object.keys(tools).length);
    assert.equal(new Set(listed.map(tool => tool.name)).size, listed.length);
    const appSchema = listed.find(tool => tool.name === createAppTool.name)!.inputSchema;
    const properties = appSchema.properties as Record<string, { type?: string; description?: string; default?: unknown }>;
    assert.deepEqual(Object.keys(properties).sort(), Object.keys(createAppTool.inputSchema).sort());
    assert.deepEqual([...(appSchema.required ?? [])].sort(), ["type", "provider_id", "repository_id", "repository_url",
      "preset_id", "framework", "commit_sha", "branch_name", "name", "build_cmd"].sort());
    assert.equal(properties.run_cmd.type, "string");
    assert.equal(Object.hasOwn(properties.run_cmd, "default"), false);
    assert.match(properties.run_cmd.description!, /frontend/);
    assert.match(properties.run_cmd.description!, /backend/);
    assert.match(properties.run_cmd.description!, /по умолчанию/);
    for (const tool of [listServersTool, listDomainsTool]) {
      const listedTool: { description?: string; inputSchema: { properties?: Record<string, unknown>; required?: string[] } } =
        listed.find(item => item.name === tool.name)!;
      const schema = listedTool.inputSchema;
      const fields = schema.properties as Record<string, { type?: string; minimum?: number; maximum?: number }>;
      assert.deepEqual(Object.keys(fields).sort(), ["limit", "offset"]);
      assert.deepEqual(schema.required ?? [], []);
      assert.equal(fields.limit.type, "integer");
      assert.equal(fields.limit.minimum, 1); assert.equal(fields.limit.maximum, 100);
      assert.equal(fields.offset.type, "integer");
      assert.equal(fields.offset.minimum, 0); assert.equal(fields.offset.maximum, Number.MAX_SAFE_INTEGER);
      assert.match(listedTool.description!, /одну страницу/);
      assert.doesNotMatch(listedTool.description!, /список всех/);
    }
    for (const key of Object.keys(tools) as (keyof typeof tools)[]) {
      assert.deepEqual(listed.find(tool => tool.name === tools[key].name)?.annotations,
        { title: tools[key].title, ...toolAnnotations[key] });
    }
    for (const key of ["listServersTool", "getServerTool", "checkDomainTool", "getImageDownloadTool"] as const) {
      assert.equal(toolAnnotations[key].readOnlyHint, true);
    }
    for (const key of ["deleteServerTool", "resetServerPasswordTool", "refreshApiKeyTool", "hardRebootServerTool", "shutdownServerTool", "updateSshKeyTool"] as const) {
      assert.equal(toolAnnotations[key].readOnlyHint, false);
      assert.equal(toolAnnotations[key].destructiveHint, true);
      assert.equal(toolAnnotations[key].idempotentHint, false);
    }
    assert.equal(toolAnnotations.createSshKeyTool.destructiveHint, false);
    assert.equal(toolAnnotations.createImageDownloadTool.readOnlyHint, false);
  } finally { await pair.close(); }
});

test("empty lists, unavailable domains and 2FA challenges remain successful MCP results", async () => {
  const server = new McpServer({ name: "offline", version: "1" });
  server.registerTool(listSshKeysTool.name, { inputSchema: listSshKeysTool.inputSchema }, listSshKeysHandler(async () => []));
  server.registerTool(checkDomainTool.name, { inputSchema: checkDomainTool.inputSchema }, checkDomainHandler(async () => false));
  server.registerTool(deleteServerTool.name, { inputSchema: deleteServerTool.inputSchema }, deleteServerHandler(async () => ({ hash: "offline-challenge" })));
  const pair = await connect(server);
  try {
    for (const request of [
      { name: listSshKeysTool.name, arguments: {} },
      { name: checkDomainTool.name, arguments: { fqdn: "example.invalid" } },
      { name: deleteServerTool.name, arguments: { server_id: 7 } },
    ]) {
      const result = await pair.client.callTool(request);
      assert.notEqual(result.isError, true);
      assert.ok(Array.isArray(result.content));
    }
  } finally { await pair.close(); }
});

test("tool catch paths keep the shared safe error constructor", () => {
  const directory = path.join(process.env.TIMEWEB_TEST_ROOT!, "src/tools");
  for (const file of readdirSync(directory).filter(name => name.endsWith(".tool.ts"))) {
    const source = readFileSync(path.join(directory, file), "utf8");
    assert.doesNotMatch(source, /createToolResponse\(formatRequestError\(/, file);
    assert.match(source, /createToolErrorResponse\(formatRequestError\(error\)\)/, file);
  }
});
