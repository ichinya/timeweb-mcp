import { readFile, writeFile } from 'node:fs/promises';

const specPath = new URL('../specs/openapi.json', import.meta.url);
const schemaRenames = new Map([
  ['meta', 'CollectionMeta'],
  ['Meta', 'RequiredCollectionMeta'],
  ['location', 'ServiceLocation'],
  ['Location', 'ImageLocation'],
  ['autoreply-is-enabled', 'MailV2AutoReplyEnabled'],
  ['autoreply-is-disabled', 'MailV2AutoReplyDisabled'],
  ['auto-reply-is-enabled', 'MailV1AutoReplyEnabled'],
  ['auto-reply-is-disabled', 'MailV1AutoReplyDisabled'],
]);

const spec = JSON.parse(await readFile(specPath, 'utf8'));
const schemas = spec.components?.schemas;

if (!schemas || typeof schemas !== 'object' || Array.isArray(schemas)) {
  throw new Error('components.schemas is missing from the OpenAPI document');
}

for (const [source, target] of schemaRenames) {
  const hasSource = Object.hasOwn(schemas, source);
  const hasTarget = Object.hasOwn(schemas, target);

  if (hasSource && hasTarget) {
    throw new Error(`cannot rename ${source}: target schema ${target} already exists`);
  }

  if (!hasSource && !hasTarget) {
    throw new Error(`cannot find source schema ${source} or normalized schema ${target}`);
  }
}

let renamedSchemaCount = 0;
spec.components.schemas = Object.fromEntries(
  Object.entries(schemas).map(([name, schema]) => {
    const normalizedName = schemaRenames.get(name) ?? name;
    if (normalizedName !== name) {
      renamedSchemaCount += 1;
    }
    return [normalizedName, schema];
  }),
);

const refRenames = new Map(
  [...schemaRenames].map(([source, target]) => [
    `#/components/schemas/${source}`,
    `#/components/schemas/${target}`,
  ]),
);

let updatedRefCount = 0;

function updateReferences(value) {
  if (Array.isArray(value)) {
    value.forEach(updateReferences);
    return;
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  if (typeof value.$ref === 'string' && refRenames.has(value.$ref)) {
    value.$ref = refRenames.get(value.$ref);
    updatedRefCount += 1;
  }

  Object.values(value).forEach(updateReferences);
}

updateReferences(spec);
await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

console.log(
  `OpenAPI normalized: ${renamedSchemaCount} schemas renamed, ${updatedRefCount} references updated`,
);
