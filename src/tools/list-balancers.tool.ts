import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listBalancersAction } from "../actions/list-balancers.action";

const inputSchema = {
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Лимит (опц.) — количество элементов на страницу"),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Смещение (опц.) — с какого элемента начать"),
};

const handler = async (params: { limit?: number; offset?: number }) => {
  try {
    const balancers = await listBalancersAction(params.limit, params.offset);

    if (balancers.length === 0) {
      return createToolResponse("На аккаунте нет балансировщиков.");
    }

    const lines = balancers.map(
      (b) =>
        `• ID ${b.id} — ${b.name}\n  статус: ${b.status}, протокол: ${b.proto}, порт: ${b.port}, алгоритм: ${b.algo}\n  IP: ${b.ip ?? "—"}, локация: ${b.location}, зона: ${b.availability_zone}\n  правил: ${b.rules?.length ?? 0}, привязанных IP: ${b.ips?.length ?? 0}`
    );

    return createToolResponse(
      `Балансировщики (${balancers.length}):\n\n${lines.join("\n\n")}`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const listBalancersTool = {
  name: ToolNames.LIST_BALANCERS,
  title: "Список балансировщиков",
  description:
    "Возвращает все балансировщики нагрузки аккаунта с ключевыми параметрами: ID, имя, статус, протокол, порт, алгоритм, IP, локация. Используй перед любыми операциями над балансировщиком, чтобы получить его ID.",
  inputSchema,
  handler,
};
