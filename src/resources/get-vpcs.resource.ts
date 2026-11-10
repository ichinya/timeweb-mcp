import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVpcsAction } from "../actions/get-vpcs.action";
import { ResourceNames } from "../types/resource-names.enum";
import { jsonResourceHandler } from "../resource-handler";

export const getVpcsHandler = (load: () => Promise<unknown> = getVpcsAction) =>
  jsonResourceHandler(() => load());

export const getVpcsResource = {
  name: ResourceNames.GET_VPCS,
  uri: "vpc://all",
  template: new ResourceTemplate("vpc://all", { list: undefined }),
  title: "Список VPC пользователя",
  description: "Список виртуальных частных сетей (VPC) пользователя в Timeweb Cloud",
  mimeType: "application/json" as const,
  handler: getVpcsHandler(),
};
