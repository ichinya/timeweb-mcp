import "./network-guard";
import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { inspect } from "node:util";
import { getEventListeners } from "node:events";
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { BaseApiClient } from "../src/api/client";
import { DbaasApiClient, dbaasApiClient } from "../src/api/dbaas";
import { AuthApiClient } from "../src/api/auth";
import { KnowledgeBasesApiClient } from "../src/api/knowledge-bases";
import { parseDatabaseClusterDeleteResponse } from "../src/api/database-cluster-delete-response";
import { runRequestContext } from "../src/api/request-context";
import { ServerException } from "../src/exceptions/server.exception";
import { ToolNames } from "../src/types/tool-names.enum";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { registerProjectTools } from "../src/register-tools";
import { registerProjectResources } from "../src/register-resources";
import * as tools from "../src/tools";
import { toolAnnotations } from "../src/tool-annotations";
import { databaseDeleteChallenge, legacyApiKey, legacyDatabase, legacyKnowledgeStatistics } from "./fixtures/api-compatibility";

const secret = "DO_NOT_EMIT_API_COMPATIBILITY";
function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: "offline", headers: { "content-type": "application/json" } };
}
function safe(error: unknown, kind: string): asserts error is ServerException {
  assert.ok(error instanceof ServerException); assert.equal(error.kind, kind); assert.equal(error.outcome, "unknown");
  assert.equal(error.failure.semantics, "mutation");
  assert.ok(![error.message, error.stack, inspect(error), JSON.stringify(error)].join(" ").includes(secret));
}

test("canonical host preserves auth, path, query, body and a single dispatch for reads and writes", async () => {
  class Probe extends BaseApiClient {
    read() { return this.get('/api/v1/servers/7?limit=1&offset=2'); }
    write() { return this.post('/api/v1/servers', { name: 'offline' }, { semantics: 'mutation' }); }
  }
  const requests: InternalAxiosRequestConfig[] = [];
  const api = new Probe({ token: secret, adapter: async config => { requests.push(config); return response(config, { ok: true }); } });
  await api.read(); await api.write(); assert.equal(requests.length, 2);
  assert.equal(axios.getUri(requests[0]), 'https://api.timeweb.cloud/api/v1/servers/7?limit=1&offset=2');
  assert.equal(axios.getUri(requests[1]), 'https://api.timeweb.cloud/api/v1/servers');
  for (const request of requests) {
    assert.equal(request.headers.Authorization, `Bearer ${secret}`); assert.equal(request.timeout, 30000);
    assert.equal(request.headers['Content-Type'], 'application/json');
  }
  assert.deepEqual(JSON.parse(requests[1].data), { name: 'offline' });
});

test("database delete parser distinguishes challenge, missing body and malformed or conflicting data", () => {
  const hash = databaseDeleteChallenge.database_delete.hash;
  for (const payload of [databaseDeleteChallenge, { hash }, { ...databaseDeleteChallenge, hash }]) {
    assert.deepEqual(parseDatabaseClusterDeleteResponse(payload), { kind: 'challenge', hash });
  }
  for (const body of [undefined, '']) assert.deepEqual(parseDatabaseClusterDeleteResponse(body), { kind: 'unconfirmed' });
  for (const body of [null, false, 42, secret, [], {}, { database_delete: null }, { database_delete: {} },
    { hash: '' }, { hash: '  ' }, { hash: 42 }, { ...databaseDeleteChallenge, hash: 'other' },
    { ...databaseDeleteChallenge, hash: null }, { database_delete: { hash: null }, hash },
    { get database_delete() { throw new Error(secret, { cause: secret }); } }]) {
    assert.throws(() => parseDatabaseClusterDeleteResponse(body), error => { safe(error, 'invalid_response'); return true; });
  }
});

test("production MCP database deletion requires 2FA even after code and never claims a completed deletion", async () => {
  const server = new McpServer({ name: 'offline-api-compatibility', version: '1' });
  registerProjectTools(server); registerProjectResources(server);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'offline', version: '1' });
  await server.connect(serverTransport); await client.connect(clientTransport);
  const cases = [databaseDeleteChallenge, { hash: databaseDeleteChallenge.database_delete.hash }, undefined, '',
    {}, { database_delete: null }, { ...databaseDeleteChallenge, hash: 'other' }, secret];
  try {
    const names: string[] = []; let cursor: string | undefined;
    do {
      const page = await client.listTools({ cursor });
      for (const entry of page.tools) {
        names.push(entry.name);
        const key = Object.keys(tools).find(key => tools[key as keyof typeof tools].name === entry.name) as keyof typeof toolAnnotations;
        assert.deepEqual(entry.annotations, { title: tools[key].title, ...toolAnnotations[key] });
      }
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(names.length, 245); assert.equal(Object.keys(tools).length, 245);
    assert.equal((await client.listResources()).resources.length, 5);
    assert.equal((await client.listResourceTemplates()).resourceTemplates.length, 1);
    for (const payload of cases) {
      for (const withCode of [false, true]) {
        const requests: InternalAxiosRequestConfig[] = [];
        const api = new DbaasApiClient({ token: secret, adapter: async config => {
          requests.push(config); return response(config, payload, payload === '' || payload === undefined ? 204 : 200);
        } });
        const hooked = mock.method(dbaasApiClient, 'deleteDatabaseCluster', api.deleteDatabaseCluster.bind(api));
        try {
          const result = await client.callTool({ name: ToolNames.DELETE_DATABASE_CLUSTER,
            arguments: { db_cluster_id: 7, ...(withCode ? { hash: 'provided-hash', code: '123456' } : {}) } });
          const text = JSON.stringify(result);
          assert.equal(requests.length, 1); assert.equal(requests[0].method, 'delete');
          const url = new URL(axios.getUri(requests[0]));
          assert.equal(url.origin, 'https://api.timeweb.cloud'); assert.equal(url.pathname, '/api/v1/databases/7');
          assert.equal(url.searchParams.get('hash'), withCode ? 'provided-hash' : null);
          assert.equal(url.searchParams.get('code'), withCode ? '123456' : null);
          assert.equal(requests[0].data, undefined);
          if (payload === databaseDeleteChallenge || (payload && typeof payload === 'object' && Object.hasOwn(payload, 'hash') && !Object.hasOwn(payload, 'database_delete'))) {
            assert.notEqual(result.isError, true); assert.match(text, /2FA/);
            assert.ok(text.includes(databaseDeleteChallenge.database_delete.hash));
          } else if (payload === '' || payload === undefined) {
            assert.notEqual(result.isError, true); assert.match(text, /удаление не подтверждено/);
          } else {
            assert.equal(result.isError, true); assert.match(text, /Результат запроса неизвестен/);
          }
          assert.doesNotMatch(text, /✅|удалён|перемещён/); assert.ok(!text.includes(secret));
        } finally { hooked.mock.restore(); }
      }
    }
  } finally { await client.close(); await server.close(); }
});

test("database delete HTTP failure and lost response stay unknown mutations without fallback or retry", async () => {
  for (const mode of ['http', 'network']) {
    let calls = 0;
    const api = new DbaasApiClient({ token: secret, adapter: async config => {
      calls++;
      assert.equal(config.baseURL, 'https://api.timeweb.cloud');
      throw new AxiosError(secret, mode === 'http' ? 'ERR_BAD_RESPONSE' : 'ECONNRESET', config,
        { body: secret }, mode === 'http' ? response(config, { message: secret }, 503) : undefined);
    } });
    await assert.rejects(runRequestContext(ToolNames.DELETE_DATABASE_CLUSTER, undefined, () => api.deleteDatabaseCluster(7)), error => {
      safe(error, mode === 'http' ? 'server' : 'network'); assert.equal(error.failure.operation, ToolNames.DELETE_DATABASE_CLUSTER); return true;
    });
    assert.equal(calls, 1);
  }
});

test("database delete cancellation releases listeners and preserves an independent sibling", async () => {
  let start!: () => void; const started = new Promise<void>(resolve => { start = resolve; });
  let calls = 0; const controller = new AbortController();
  const api = new DbaasApiClient({ token: 'offline', adapter: async config => {
    calls++; if (calls === 1) { start(); return new Promise<never>(() => {}); }
    return response(config, databaseDeleteChallenge);
  } });
  const pending = assert.rejects(runRequestContext(ToolNames.DELETE_DATABASE_CLUSTER, controller.signal, () => api.deleteDatabaseCluster(7)), error => {
    safe(error, 'cancelled'); assert.equal(error.failure.operation, ToolNames.DELETE_DATABASE_CLUSTER); return true;
  });
  await started;
  const sibling = runRequestContext(ToolNames.DELETE_DATABASE_CLUSTER, undefined, () => api.deleteDatabaseCluster(8));
  controller.abort(secret); await pending;
  assert.deepEqual(await sibling, databaseDeleteChallenge); assert.equal(calls, 2);
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
});

test("historical local fixtures preserve ten legacy calls without asserting live endpoint support", async () => {
  const calls: [string, string][] = [];
  const auth = new AuthApiClient({ token: 'offline', adapter: async config => {
    calls.push([config.method!, config.url!]); return response(config, config.method === 'get' ? { api_keys: [legacyApiKey] } : { api_key: legacyApiKey });
  } });
  assert.deepEqual(await auth.listApiKeys(), [legacyApiKey]);
  assert.deepEqual(await auth.createApiKey({ name: 'offline' }), legacyApiKey);
  assert.deepEqual(await auth.editApiKey('offline-key', { name: 'offline' }), legacyApiKey);
  assert.deepEqual(await auth.refreshApiKey('offline-key'), legacyApiKey); await auth.deleteApiKey('offline-key');
  const db = new DbaasApiClient({ token: 'offline', adapter: async config => {
    calls.push([config.method!, config.url!]); return response(config, config.method === 'get' && config.url?.includes('?') ? { dbs: [legacyDatabase] } : { db: legacyDatabase });
  } });
  assert.deepEqual(await db.listDatabases(1, 2), [legacyDatabase]); assert.deepEqual(await db.getDatabase(7), legacyDatabase);
  assert.deepEqual(await db.updateDatabase(7, { name: 'offline' }), legacyDatabase); await db.deleteDatabase(7, 'hash', 'code');
  const kb = new KnowledgeBasesApiClient({ token: 'offline', adapter: async config => {
    calls.push([config.method!, config.url!]); return response(config, { knowledgebase_statistics: legacyKnowledgeStatistics });
  } });
  assert.deepEqual(await kb.getKnowledgeBaseStatistic(7, { interval: 1 }), legacyKnowledgeStatistics);
  assert.deepEqual(calls, [
    ['get', '/api/v1/auth/api-keys'], ['post', '/api/v1/auth/api-keys'], ['patch', '/api/v1/auth/api-keys/offline-key'],
    ['put', '/api/v1/auth/api-keys/offline-key'], ['delete', '/api/v1/auth/api-keys/offline-key'],
    ['get', '/api/v1/dbs?limit=1&offset=2'], ['get', '/api/v1/dbs/7'], ['patch', '/api/v1/dbs/7'],
    ['delete', '/api/v1/dbs/7?hash=hash&code=code'], ['get', '/api/v1/cloud-ai/knowledge-bases/7/statistic?interval=1'],
  ]);
});
