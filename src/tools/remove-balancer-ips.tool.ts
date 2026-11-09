import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { removeBalancerIpsAction } from "../actions/remove-balancer-ips.action";

const inputSchema = {
  balancer_id: z
    .number()
    .int()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID балансировщика"),
  ips: z
    .array(z.string())
    .min(1)
    .describe(
      "ОБЯЗАТЕЛЬНОЕ ПОЛЕ - массив backend IP-адресов для удаления"
    ),
};

const handler = async (params: { balancer_id: number; ips: string[] }) => {
  try {
    await removeBalancerIpsAction(params.balancer_id, params.ips);

    return createToolResponse(
      `✅ Удалено IP у балансировщика ${params.balancer_id} (${params.ips.length}):\n${params.ips.map((i) => `• ${i}`).join("\n")}`
    );
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const removeBalancerIpsTool = {
  name: ToolNames.REMOVE_BALANCER_IPS,
  title: "Удаление IP у балансировщика",
  description:
    "Удаляет backend IP-адреса у балансировщика (снимает их из распределения трафика).",
  inputSchema,
  handler,
};
