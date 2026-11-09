import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse } from "../utils";
import { getVpcsAction } from "../actions/get-vpcs.action";
import { ToolNames } from "../types/tool-names.enum";

const handler = async () => {
  try {
    const vpcs = await getVpcsAction();

    if (!vpcs || vpcs.length === 0) {
      return createToolResponse(
        `💡 VPC не найдены. Создайте первую VPC с помощью tool ${ToolNames.CREATE_VPC}`
      );
    }

    return createToolResponse(`📋 Список VPC:

    ${JSON.stringify(vpcs, null, 2)}

    💡 Всего VPC: ${vpcs.length}

    🎉 Список VPC успешно получен!`);
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const getVpcsTool = {
  name: ToolNames.GET_VPCS,
  title: "Получение списка VPC",
  description:
    "Получает список всех виртуальных частных сетей (VPC) пользователя",
  inputSchema: {},
  handler,
};
