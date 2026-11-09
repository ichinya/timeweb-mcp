import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listProjectBucketsAction } from "../actions/list-project-buckets.action";

const inputSchema = {
  project_id: z.number().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID проекта"),
};

const handler = async (params: { project_id: number }) => {
  try {
    const items = await listProjectBucketsAction(params.project_id);
    if (items.length === 0) {
      return createToolResponse(
        `Хранилищ в проекте ${params.project_id} нет.`
      );
    }
    const lines = items.map(
      (b: any) =>
        `• ID ${b.id} — ${b.name ?? "без имени"}, тип: ${b.type ?? "—"}, статус: ${b.status ?? "—"}`
    );
    return createToolResponse(
      `Хранилища (S3) проекта ${params.project_id} (${items.length}):\n${lines.join("\n")}`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const listProjectBucketsTool = {
  name: ToolNames.LIST_PROJECT_BUCKETS,
  title: "Хранилища проекта",
  description: "Список S3-хранилищ в указанном проекте.",
  inputSchema,
  handler,
};
