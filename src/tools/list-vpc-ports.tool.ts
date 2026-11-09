import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listVpcPortsAction } from "../actions/list-vpc-ports.action";

const inputSchema = {
  vpc_id: z.string().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID VPC"),
};

const handler = async (params: { vpc_id: string }) => {
  try {
    const ports = await listVpcPortsAction(params.vpc_id);

    if (!ports || ports.length === 0) {
      return createToolResponse(`💡 В VPC ${params.vpc_id} нет портов.`);
    }

    const lines = ports.map(
      (p) =>
        `• ${p.id} | IPv4: ${p.ipv4} | MAC: ${p.mac} | NAT: ${p.nat_mode} | сервис: ${p.service.type} "${p.service.name}" (ID ${p.service.id})`
    );

    return createToolResponse(
      `📋 Порты VPC ${params.vpc_id} (всего: ${ports.length}):\n${lines.join("\n")}`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const listVpcPortsTool = {
  name: ToolNames.LIST_VPC_PORTS,
  title: "Список портов VPC",
  description: "Возвращает список портов VPC с MAC-адресами, IPv4 и сервисами",
  inputSchema,
  handler,
};
