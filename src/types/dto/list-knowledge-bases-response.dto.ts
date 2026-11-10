import { KnowledgeBase } from "../knowledge-base.type";

export type ListKnowledgeBasesResponseDto = ({
  knowledge_bases: KnowledgeBase[];
} | {
  /** Historical wire contract, accepted explicitly by the response parser. */
  knowledgebases: KnowledgeBase[];
}) & {
  meta: { total: number };
  response_id?: string;
};
