import "./network-guard";
import assert from "node:assert/strict";
import { test } from "node:test";
import { inspect, isDeepStrictEqual } from "node:util";
import { getEventListeners } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { KnowledgeBasesApiClient } from "../src/api/knowledge-bases";
import { parseKnowledgeBaseResponse } from "../src/api/knowledge-base-response";
import { runRequestContext } from "../src/api/request-context";
import { ServerException } from "../src/exceptions/server.exception";
import { ToolNames } from "../src/types/tool-names.enum";
import { knowledgeBaseV1, knowledgeBaseV2, listV1Response, listV2Response, singleResponse } from "./fixtures/knowledge-bases";

const secret = "DO_NOT_EMIT_KNOWLEDGE_BASE";
const operationName = (name: string) => ({ list_v1: ToolNames.LIST_KNOWLEDGE_BASES_V1,
  list_v2: ToolNames.LIST_KNOWLEDGE_BASES, get: ToolNames.GET_KNOWLEDGE_BASE,
  create: ToolNames.CREATE_KNOWLEDGE_BASE, update: ToolNames.UPDATE_KNOWLEDGE_BASE })[name];
const createInput = { name: "offline", dbaas_preset_id: 2449, network_id: "offline", token_package_id: 111 };
const updateInput = { name: "updated" };
const root = "/api/v1/cloud-ai/knowledge-bases";
const operations = [
  { name: "list_v1", method: "get", url: root, status: 200, list: true, version: 1,
    payload: listV1Response, value: [knowledgeBaseV1], invoke: (api: KnowledgeBasesApiClient) => api.listKnowledgeBases() },
  { name: "list_v2", method: "get", url: "/api/v2/cloud-ai/knowledge-bases", status: 200, list: true, version: 2,
    payload: listV2Response, value: [knowledgeBaseV2], invoke: (api: KnowledgeBasesApiClient) => api.listKnowledgeBasesV2() },
  { name: "get", method: "get", url: root + "/5285", status: 200, list: false, version: 1,
    payload: singleResponse, value: knowledgeBaseV1, invoke: (api: KnowledgeBasesApiClient) => api.getKnowledgeBase(5285) },
  { name: "create", method: "post", url: root, status: 201, list: false, version: 1, body: createInput,
    payload: singleResponse, value: knowledgeBaseV1, invoke: (api: KnowledgeBasesApiClient) => api.createKnowledgeBase(createInput) },
  { name: "update", method: "patch", url: root + "/5285", status: 200, list: false, version: 1, body: updateInput,
    payload: singleResponse, value: knowledgeBaseV1, invoke: (api: KnowledgeBasesApiClient) => api.updateKnowledgeBase(5285, updateInput) },
] as const;
function response(config: InternalAxiosRequestConfig, data: unknown, status: number): AxiosResponse {
  return { config, data, status, statusText: "offline", headers: { "content-type": "application/json" } };
}
function assertSafe(error: unknown, kind = "invalid_response"): asserts error is ServerException {
  assert.ok(error instanceof ServerException);
  assert.equal(error.kind, kind);
  assert.equal(error.outcome, "unknown");
  assert.ok(![error.message, error.stack, JSON.stringify(error), inspect(error)].join(" ").includes(secret));
}

test("local knowledge base OpenAPI names and versioned fixtures agree", () => {
  const spec = JSON.parse(readFileSync(path.join(process.env.TIMEWEB_TEST_ROOT!, "specs/openapi.json"), "utf8"));
  for (const op of operations) {
    const endpoint = op.name === "get" || op.name === "update" ? root + "/{id}" : op.url;
    const shape = spec.paths[endpoint][op.method].responses[String(op.status)].content["application/json"].schema.allOf[0];
    const key = op.list ? "knowledge_bases" : "knowledge_base";
    assert.ok(Object.hasOwn(shape.properties, key)); assert.ok(shape.required.includes(key));
    assert.ok(!Object.hasOwn(shape.properties, op.list ? "knowledgebases" : "knowledgebase"));
  }
  for (const [name, fixture] of [["knowledgebase", knowledgeBaseV1], ["knowledgebase-v2", knowledgeBaseV2]] as const) {
    const schema = spec.components.schemas[name];
    for (const key of schema.required) assert.ok(Object.hasOwn(fixture, key), `${name}.${key}`);
    assert.equal(schema.properties.subscription_renewal_date.nullable, true);
    assert.equal(schema.properties.project_id.type, "integer");
  }
});

test("knowledge base methods preserve current, legacy and equal dual envelopes with one dispatch", async t => {
  for (const op of operations) await t.test(op.name, async () => {
    const current = op.list ? "knowledge_bases" : "knowledge_base";
    const legacy = op.list ? "knowledgebases" : "knowledgebase";
    for (const payload of [op.payload, { [legacy]: op.value }, { [current]: op.value, [legacy]: structuredClone(op.value) }]) {
      const before = structuredClone(payload);
      const journal: InternalAxiosRequestConfig[] = [];
      const api = new KnowledgeBasesApiClient({ token: "offline", adapter: async config => {
        journal.push(config); return response(config, payload, op.status);
      } });
      const result = await op.invoke(api);
      assert.deepEqual(result, op.value);
      assert.deepEqual(payload, before);
      assert.equal(journal.length, 1);
      assert.equal(journal[0].method, op.method); assert.equal(journal[0].url, op.url);
      assert.deepEqual(journal[0].data === undefined ? undefined : JSON.parse(journal[0].data), "body" in op ? op.body : undefined);
    }
  });
});

test("knowledge base list versions preserve empty arrays and historical optional fields", async () => {
  for (const op of operations.filter(item => item.list)) {
    for (const key of ["knowledge_bases", "knowledgebases"]) {
      const api = new KnowledgeBasesApiClient({ token: "offline", adapter: async config => response(config, { [key]: [] }, 200) });
      assert.deepEqual(await op.invoke(api), []);
    }
  }
  const { description: _description, last_sync: _sync, ...old } = knowledgeBaseV1;
  assert.deepEqual(parseKnowledgeBaseResponse({ knowledgebase: old }, 1, false, false), old);
  assert.throws(() => parseKnowledgeBaseResponse({ knowledge_base: old }, 1, false, false), error => { assertSafe(error); return true; });
  const extra = { ...knowledgeBaseV1, id: 0, created_at: "provider-date", subscription_renewal_date: "provider-date" };
  assert.deepEqual(parseKnowledgeBaseResponse({ knowledge_base: extra }, 1, false, false), extra);
});

test("all five knowledge base methods reject malformed or conflicting 2xx without retry or payload leaks", async () => {
  for (const op of operations) {
    const current = op.list ? "knowledge_bases" : "knowledge_base";
    const legacy = op.list ? "knowledgebases" : "knowledgebase";
    const invalid = [undefined, null, false, 0, secret, [], {},
      ...[undefined, null, false, 0, secret, op.list ? {} : []].map(value => ({ [current]: value })),
      { [current]: op.value, [legacy]: null }, { [current]: null, [legacy]: op.value },
      { [current]: op.value, [legacy]: op.list ? [] : { ...knowledgeBaseV1, name: "other" } },
      { [current]: op.list ? [null] : { id: 1 } },
      { [current]: op.list ? [{ id: 1 }] : { ...knowledgeBaseV1, documents: null } }];
    for (const payload of invalid) {
      let calls = 0;
      const api = new KnowledgeBasesApiClient({ token: secret, adapter: async config => {
        calls++; return response(config, payload, op.status);
      } });
      await assert.rejects(runRequestContext<unknown>(operationName(op.name)!, undefined, () => op.invoke(api)), error => {
        assertSafe(error);
        assert.equal(error.failure.semantics, op.method === "get" ? "read" : "mutation");
        assert.equal(error.failure.operation, operationName(op.name)!);
        assert.equal(error.failure.automaticRetry, false);
        assert.equal(error.failure.recommendation, op.method === "get" ? "safe_read" : "reconcile_before_repeat");
        return true;
      });
      assert.equal(calls, 1);
    }
  }
});

test("knowledge base schemas enforce required primitive fields and preserve unknown fields", () => {
  for (const version of [1, 2] as const) {
    const base = version === 1 ? knowledgeBaseV1 : knowledgeBaseV2;
    const required = ["id", "name", "description", "dbaas_id", "status", "last_sync", "total_tokens", "used_tokens",
      "remaining_tokens", "token_package_id", "subscription_renewal_date", "agents_ids", "created_at",
      version === 1 ? "documents" : "documents_count"];
    for (const key of required) {
      const missing: Record<string, unknown> = { ...base }; delete missing[key];
      for (const invalid of [missing, { ...base, [key]: { token: secret } }]) {
        assert.throws(() => parseKnowledgeBaseResponse({ knowledge_bases: [invalid] }, version, true), error => { assertSafe(error); return true; });
      }
    }
    for (const invalid of [{ ...base, id: 1.5 }, { ...base, project_id: null }, { ...base, agents_ids: [secret] },
      { ...base, status: "unexpected" }, ...(version === 1 ? [{ ...base, documents: [null] }] : [{ ...base, documents_count: 1.5 }])]) {
      assert.throws(() => parseKnowledgeBaseResponse({ knowledge_bases: [invalid] }, version, true), error => { assertSafe(error); return true; });
    }
    assert.deepEqual(parseKnowledgeBaseResponse({ knowledge_bases: [base] }, version, true), [base]);
    const conflictingExtra = { ...base, provider_extension: { preserved: false } };
    assert.ok(!isDeepStrictEqual(base, conflictingExtra));
    assert.throws(() => parseKnowledgeBaseResponse({ knowledge_bases: [base], knowledgebases: [conflictingExtra] }, version, true));
  }
  assert.throws(() => parseKnowledgeBaseResponse(Object.create({ knowledge_base: knowledgeBaseV1 }), 1, false, false));
  const getter = { get knowledge_base() { throw new Error(secret, { cause: secret }); } };
  assert.throws(() => parseKnowledgeBaseResponse(getter, 1, false, true), error => { assertSafe(error); return true; });
});

test("knowledge base HTTP errors retain classification and never retry any method", async () => {
  for (const op of operations) {
    let calls = 0;
    const api = new KnowledgeBasesApiClient({ token: secret, adapter: async config => {
      calls++; throw new AxiosError(secret, "ERR_BAD_RESPONSE", config, { body: secret }, response(config, { message: secret }, 503));
    } });
    await assert.rejects(op.invoke(api), error => { assertSafe(error, "server"); assert.equal(error.status, 503); return true; });
    assert.equal(calls, 1);
  }
});

test("knowledge base cancellation preserves context, releases listeners and isolates a sibling", async () => {
  for (const op of operations) {
    let start!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    const controller = new AbortController();
    let calls = 0;
    const api = new KnowledgeBasesApiClient({ token: "offline", adapter: async config => {
      calls++;
      if (calls === 1) { start(); return new Promise<never>(() => {}); }
      return response(config, op.payload, op.status);
    } });
    const pending = assert.rejects(runRequestContext<unknown>(operationName(op.name)!, controller.signal, () => op.invoke(api)), error => {
      assertSafe(error, "cancelled"); assert.equal(error.failure.operation, operationName(op.name)!); return true;
    });
    await started;
    const sibling = runRequestContext<unknown>(ToolNames.GET_KNOWLEDGE_BASE, undefined, () => op.invoke(api));
    controller.abort(secret); await pending;
    assert.deepEqual(await sibling, op.value);
    assert.equal(calls, 2);
    assert.equal(getEventListeners(controller.signal, "abort").length, 0);
    await assert.rejects(runRequestContext<unknown>(operationName(op.name)!, controller.signal, () => op.invoke(api)),
      error => error instanceof ServerException && error.kind === "cancelled" && error.outcome === "not_sent");
    assert.equal(calls, 2);
  }
});
