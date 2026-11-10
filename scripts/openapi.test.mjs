import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeOpenApi } from './normalize-openapi.mjs';
import { extractApiRoutes, checkApiRoutes, validateRouteMatrix } from './check-api-routes.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
test('normalization distinguishes compute and MCP Resource, rewrites refs and is idempotent', () => {
  const spec = JSON.parse(readFileSync(new URL('../specs/openapi.json', import.meta.url), 'utf8'));
  spec.components.schemas.Resource = spec.components.schemas.ComputeResourceCapacity;
  delete spec.components.schemas.ComputeResourceCapacity;
  spec.components.schemas.resource = spec.components.schemas.McpResource;
  delete spec.components.schemas.McpResource;
  spec.paths['/offline'] = { get: { responses: { 200: { schema: { allOf: [
    { $ref: '#/components/schemas/Resource' }, { $ref: '#/components/schemas/resource' },
  ] } } } } };
  const result = normalizeOpenApi(spec);
  assert.equal(result.renamedSchemaCount, 2); assert.equal(result.updatedRefCount, 2);
  const refs = spec.paths['/offline'].get.responses[200].schema.allOf;
  assert.deepEqual(refs.map(item => item.$ref), ['#/components/schemas/ComputeResourceCapacity', '#/components/schemas/McpResource']);
  assert.ok(spec.components.schemas.ComputeResourceCapacity.properties.capacity);
  assert.ok(spec.components.schemas.McpResource.properties.uri);
  const before = JSON.stringify(spec); assert.deepEqual(normalizeOpenApi(spec), { renamedSchemaCount: 0, updatedRefCount: 0 });
  assert.equal(JSON.stringify(spec), before);
  spec.components.schemas.Resource = {};
  assert.throws(() => normalizeOpenApi(spec), /already exists/);
  delete spec.components.schemas.Resource; delete spec.components.schemas.McpResource;
  assert.throws(() => normalizeOpenApi(spec), /cannot find source schema resource/);
});

test('AST route extraction handles endpoint variables, encoding and query without guessing unknowns', () => {
  const code = 'class Api { read(id: string, policy: boolean) { const endpoint = policy ? `/api/v1/items/${encodeURIComponent(id)}?policy=x` : `/api/v1/items/${id}`; return this.get<unknown>(endpoint); } }';
  const extracted = extractApiRoutes('probe.ts', code);
  assert.equal(extracted.unknown.length, 0);
  assert.deepEqual(extracted.routes.map(item => [item.method, item.path]), [['GET', '/api/v1/items/{}']]);
  const query = extractApiRoutes('probe.ts', 'class Api { list() { const qs = this.buildQuery({}); return this.get(`/api/v1/items${qs}`); } }');
  assert.deepEqual(query.routes.map(item => item.path), ['/api/v1/items']);
  for (const code of ['class Api { read() { return this.get(obscure()); } }',
    'class Api { read() { let endpoint = "/api/v1/items"; endpoint = obscure(); return this.get(endpoint); } }',
    'class Api { read(method) { return this[method]("/api/v1/items"); } }',
    'class Api { read = () => this.get("/api/v1/items"); }']) {
    const result = extractApiRoutes('probe.ts', code); assert.equal(result.routes.length, 0); assert.equal(result.unknown.length, 1);
  }
});

test('shadowed endpoint bindings cannot hide an undocumented route behind a documented one', () => {
  for (const source of [
    'class Api { read(flag: boolean) { const endpoint = "/api/undocumented"; if (flag) { const endpoint = "/api/v1/servers"; this.get(endpoint); } return this.get(endpoint); } }',
    'class Api { read() { const endpoint = "/api/undocumented"; { const { endpoint } = data; this.get(endpoint); } return this.get(endpoint); } }',
    'class Api { read() { const endpoint = "/api/undocumented"; try {} catch (endpoint) { this.get(endpoint); } return this.get(endpoint); } }',
    'class Api { read() { const endpoint = "/api/undocumented"; const inner = (endpoint: string) => this.get(endpoint); return this.get(endpoint); } }',
  ]) {
    const result = extractApiRoutes('shadow.ts', source);
    const gate = validateRouteMatrix(result.routes, result.unknown, { paths: { '/api/v1/servers': { get: {} } } }, []);
    assert.equal(gate.ok, false);
    assert.ok(result.unknown.length || gate.mismatches.some(route => route.path === '/api/undocumented'));
  }
});

test('all current API call sites match the snapshot or exactly ten scoped legacy exceptions', () => {
  const result = checkApiRoutes(root);
  assert.deepEqual(result.unknown, []); assert.deepEqual(result.mismatches, []); assert.deepEqual(result.staleExceptions, []);
  assert.equal(result.exceptionCount, 10); assert.ok(result.routes.length > 280); assert.equal(result.ok, true);
  assert.ok(result.routes.some(item => item.clientMethod === 'createFirewallGroup' && item.method === 'POST' && item.path === '/api/v1/firewall/groups'));
  assert.ok(result.routes.some(item => item.clientMethod === 'deleteBucket' && item.method === 'DELETE' && item.path === '/api/v1/storages/buckets/{}'));
});

test('route gate rejects a new mismatch, unknown expression, stale or incomplete exception', () => {
  const route = { file: 'src/api/probe.ts', clientMethod: 'read', method: 'GET', path: '/api/legacy/{}' };
  const exception = { ...route, path: '/api/legacy/{id}', reason: 'Legacy local contract only', source: 'official spec', checkedAt: '2026-11-10' };
  const spec = { paths: {} };
  assert.equal(validateRouteMatrix([route], [], spec, [exception]).ok, true);
  assert.equal(validateRouteMatrix([{ ...route, method: 'DELETE' }], [], spec, [exception]).ok, false);
  assert.equal(validateRouteMatrix([route], [], spec, []).mismatches.length, 1);
  assert.equal(validateRouteMatrix([route], [], spec, [{ ...exception, reason: '' }]).ok, false);
  assert.equal(validateRouteMatrix([], [], spec, [exception]).staleExceptions.length, 1);
  assert.equal(validateRouteMatrix([route], [{ file: 'unknown.ts' }], spec, [exception]).ok, false);
  assert.equal(validateRouteMatrix([route], [], spec, [exception, exception]).ok, false);
});

test('normalized specification hash matches the recorded provenance', () => {
  const provenance = JSON.parse(readFileSync(new URL('../specs/openapi-source.json', import.meta.url), 'utf8'));
  // Hash the normalizer output, independent of checkout CRLF conversion on Windows.
  const spec = JSON.parse(readFileSync(new URL('../specs/openapi.json', import.meta.url), 'utf8'));
  const normalized = JSON.stringify(spec, null, 2) + '\n';
  assert.equal(createHash('sha256').update(normalized).digest('hex'), provenance.normalizedSha256);
  assert.match(provenance.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(provenance.sourceUrl, 'https://timeweb.cloud/api-docs-data/bundle.json');
});
