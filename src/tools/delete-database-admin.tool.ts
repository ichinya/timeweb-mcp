import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { deleteDatabaseAdminAction } from "../actions/delete-database-admin.action";

const inputSchema = {
  db_cluster_id: z
    .number()
    .int()
    .positive()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID кластера базы данных"),
  admin_id: z
    .number()
    .int()
    .positive()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID пользователя для удаления"),
};

const handler = async (params: {
  db_cluster_id: number;
  admin_id: number;
}) => {
  try {
    await deleteDatabaseAdminAction(params.db_cluster_id, params.admin_id);
    return createToolResponse(
      `✅ Пользователь ${params.admin_id} удалён из кластера ${params.db_cluster_id}.`
    );
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const deleteDatabaseAdminTool = {
  name: ToolNames.DELETE_DATABASE_ADMIN,
  title: "Удаление пользователя кластера",
  description:
    "Удаляет пользователя кластера базы данных (`DELETE /api/v1/databases/{db_cluster_id}/admins/{admin_id}`). Действие необратимо.",
  inputSchema,
  handler,
};
