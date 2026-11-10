// Constructed from the official schemas/examples, not captured live responses.
// Source: https://timeweb.cloud/api-docs-data/bundle.json, checked 2026-11-10.
// v1 uses documents; v2 replaces documents with documents_count.
export const knowledgeBaseV1 = {
  id: 5285, name: "Документация продукта", description: null, project_id: 2265605,
  dbaas_id: 4212285, status: "active", last_sync: null,
  total_tokens: 10000000, used_tokens: 74520, remaining_tokens: 9925480,
  token_package_id: 111, subscription_renewal_date: null,
  documents: [{ id: 1, name: "guide.txt", size: 10, status: "indexed", type: "file",
    indexing_schedule: null, indexing_version: null, status_info: null,
    created_at: "2026-09-22T09:03:27.000Z", updated_at: "2026-09-22T09:03:27.000Z",
    provider_extension: { preserved: true } }],
  agents_ids: [101, 102], created_at: "2026-09-22T09:03:27.000Z",
  provider_extension: { preserved: true },
};
const { documents: _documents, project_id: _project, ...common } = knowledgeBaseV1;
export const knowledgeBaseV2 = { ...common, documents_count: 3 };
export const knowledgeBaseResponseId = "94608d15-8672-4eed-8ab6-28bd6fa3cdf7";
export const listV1Response = { knowledge_bases: [knowledgeBaseV1], meta: { total: 1 }, response_id: knowledgeBaseResponseId };
export const listV2Response = { knowledge_bases: [knowledgeBaseV2], meta: { total: 1 }, response_id: knowledgeBaseResponseId };
export const singleResponse = { knowledge_base: knowledgeBaseV1, response_id: knowledgeBaseResponseId };
