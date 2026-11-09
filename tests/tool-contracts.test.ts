import "./network-guard";
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SshKeysApiClient } from "../src/api/ssh-keys";
import { AppsApiClient } from "../src/api/apps";
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
import { wrapRequestHandler } from "../src/api/request-context";
import { registerProjectTools } from "../src/register-tools";
import { toolAnnotations } from "../src/tool-annotations";
import * as tools from "../src/tools";
import { CreateAppParams } from "../src/types/create-app-params.type";
import { AppTypes } from "../src/types/app-types.enum";
import { FrameworksBackend, FrameworksFrontend } from "../src/types/app-frameworks.type";
import { DeploySettingsDto } from "../src/types/dto/get-deploy-settings-response.dto";
import { createToolResponse } from "../src/utils";

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

type Fixture = { providers?: unknown; repositories?: Record<string, unknown>; presets?: unknown; deploySettings?: DeploySettingsDto[] };
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

test("create_app resolves deploy defaults per field without mutating input", async t => {
  const scenarios: { name: string; input: CreateAppParams; settings?: DeploySettingsDto[];
    expected: { build_cmd?: string; run_cmd?: string; index_dir?: string } }[] = [
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
    { name: "backend empty catalog preserves action fallback", input: { ...appParams, build_cmd: undefined, run_cmd: undefined },
      settings: [], expected: { run_cmd: "" } },
    { name: "frontend empty catalog preserves action fallback", input: { ...frontendParams, build_cmd: undefined },
      settings: [], expected: { index_dir: "" } },
    { name: "backend ignores settings of another framework", input: { ...appParams, build_cmd: undefined, run_cmd: undefined },
      settings: [frontendDefaults], expected: { run_cmd: "" } },
    { name: "frontend ignores settings of another framework", input: { ...frontendParams, build_cmd: undefined },
      settings: [backendDefaults], expected: { index_dir: "" } },
    { name: "absent default run uses action fallback", input: { ...appParams, build_cmd: undefined, run_cmd: undefined },
      settings: [{ framework: "express", build_cmd: "default-build", index_dir: "dist" }],
      expected: { build_cmd: "default-build", run_cmd: "" } },
    { name: "explicit values survive without matching settings", input: { ...frontendParams, index_dir: "public" },
      expected: { build_cmd: "npm run build", index_dir: "public" } },
  ];
  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const fixture = appFixture({ deploySettings: scenario.settings });
      const input = structuredClone(scenario.input);
      const before = structuredClone(input);
      const result = await fixture.handler(input);
      assert.notEqual(result.isError, true);
      assert.deepEqual(input, before);
      const writes = fixture.journal.filter(item => item.method === "post");
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
