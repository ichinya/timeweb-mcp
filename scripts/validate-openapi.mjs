import { readFile } from 'node:fs/promises';

const specPath = new URL('../specs/openapi.json', import.meta.url);
const spec = JSON.parse(await readFile(specPath, 'utf8'));
const errors = [];

const operationMethods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

function generatedModelName(schemaName) {
  return schemaName
    .split(/[^A-Za-z0-9]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function resolveJsonPointer(root, pointer) {
  return pointer
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((value, part) => value?.[part], root);
}

function visit(value, visitor, path = '#') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visit(item, visitor, `${path}/${index}`));
    return;
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  visitor(value, path);
  for (const [key, child] of Object.entries(value)) {
    visit(child, visitor, `${path}/${key}`);
  }
}

if (spec.openapi !== '3.0.0') {
  errors.push(`expected OpenAPI 3.0.0, received ${String(spec.openapi)}`);
}

const operationIds = new Map();
let operationCount = 0;

for (const [pathName, pathItem] of Object.entries(spec.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!operationMethods.has(method.toLowerCase())) {
      continue;
    }

    operationCount += 1;
    if (!operation.operationId) {
      errors.push(`${method.toUpperCase()} ${pathName} has no operationId`);
      continue;
    }

    const previous = operationIds.get(operation.operationId);
    if (previous) {
      errors.push(
        `duplicate operationId ${operation.operationId}: ${previous} and ${method.toUpperCase()} ${pathName}`,
      );
    } else {
      operationIds.set(operation.operationId, `${method.toUpperCase()} ${pathName}`);
    }
  }
}

const modelNames = new Map();
for (const schemaName of Object.keys(spec.components?.schemas ?? {})) {
  const generatedName = generatedModelName(schemaName);
  const collisionKey = generatedName.toLowerCase();
  const names = modelNames.get(collisionKey) ?? [];
  names.push({ schemaName, generatedName });
  modelNames.set(collisionKey, names);
}

for (const names of modelNames.values()) {
  if (names.length > 1) {
    errors.push(
      `generated model name collision: ${names
        .map(({ schemaName, generatedName }) => `${schemaName} -> ${generatedName}`)
        .join(', ')}`,
    );
  }
}

let internalRefCount = 0;
visit(spec, (value, path) => {
  if (typeof value.$ref !== 'string' || !value.$ref.startsWith('#/')) {
    return;
  }

  internalRefCount += 1;
  if (resolveJsonPointer(spec, value.$ref) === undefined) {
    errors.push(`unresolved internal reference at ${path}: ${value.$ref}`);
  }
});

const summary = [
  `${Object.keys(spec.paths ?? {}).length} paths`,
  `${operationCount} operations`,
  `${spec.tags?.length ?? 0} tags`,
  `${Object.keys(spec.components?.schemas ?? {}).length} schemas`,
  `${internalRefCount} internal references`,
].join(', ');

if (errors.length > 0) {
  console.error(`OpenAPI validation failed (${summary}):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`OpenAPI validation passed: ${summary}`);
}
