import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { deleteDatabaseClusterAction } from "../actions/delete-database-cluster.action";

const inputSchema = {
  db_cluster_id: z
    .number()
    .int()
    .positive()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID кластера для удаления"),
  hash: z
    .string()
    .optional()
    .describe(
      "НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - хеш для 2FA (возвращается после первого запроса для аккаунтов с 2FA)"
    ),
  code: z
    .string()
    .optional()
    .describe("НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - код авторизации для 2FA"),
};

export const deleteDatabaseClusterHandler = (remove = deleteDatabaseClusterAction) => async (params: {
  db_cluster_id: number;
  hash?: string;
  code?: string;
}) => {
  try {
    const result = await remove(
      params.db_cluster_id,
      params.hash,
      params.code
    );

    if (result.kind === "challenge") {
      return createToolResponse(
        `⚠️ Требуется 2FA. Повторите запрос с hash="${result.hash}" и code из приложения-аутентификатора.`
      );
    }

    return createToolResponse(
      `Запрос удаления кластера ${params.db_cluster_id} обработан без подтверждающего тела. Проверьте состояние кластера перед повтором; удаление не подтверждено.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const deleteDatabaseClusterTool = {
  name: ToolNames.DELETE_DATABASE_CLUSTER,
  title: "Удаление кластера базы данных",
  description:
    "Удаляет кластер баз данных (`DELETE /api/v1/databases/{db_cluster_id}`). Для аккаунтов с 2FA в ответе вернётся hash — повторите запрос с ним и с code из аутентификатора.",
  inputSchema,
  handler: deleteDatabaseClusterHandler(),
};
