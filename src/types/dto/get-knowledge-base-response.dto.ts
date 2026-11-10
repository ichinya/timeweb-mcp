import { KnowledgeBase } from "../knowledge-base.type";

export type GetKnowledgeBaseResponseDto = ({
  knowledge_base: KnowledgeBase;
} | {
  /** Historical wire contract, accepted explicitly by the response parser. */
  knowledgebase: KnowledgeBase;
}) & {
  response_id?: string;
};
