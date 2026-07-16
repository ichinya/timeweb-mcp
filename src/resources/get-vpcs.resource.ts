import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceNames } from "../types/resource-names.enum";
import { createResourceResponse } from "../utils";
import { getVpcsAction } from "../actions/get-vpcs.action";
import { ToolNames } from "../types/tool-names.enum";

export const getVpcsResource = {
  name: ResourceNames.GET_VPCS,
  uri: "vpc://all",
  template: new ResourceTemplate("vpc://all", { list: undefined }),
  title: "Список VPC пользователя",
  description:
    "Список виртуальных частных сетей (VPC) пользователя в Timeweb Cloud",
  handler: async (uri: URL) => {
    try {
      const result = await getVpcsAction();

      if (!result || result.length === 0) {
        return createResourceResponse(uri.href, `Нет доступных VPC. Создайте первую VPC с помощью tool ${ToolNames.CREATE_VPC}`);
      }

      return createResourceResponse(uri.href, JSON.stringify(result, null, 2));
    } catch (error: unknown) {
      if (error instanceof Error) {
        return createResourceResponse(
          uri.href,
          `Не удалось получить список VPC. Причина: ${error.message}`
        );
      }

      return createResourceResponse(uri.href, `Не удалось получить список VPC`);
    }
  },
};
