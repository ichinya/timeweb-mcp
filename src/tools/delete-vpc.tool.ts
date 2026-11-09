import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { deleteVpcAction } from "../actions/delete-vpc.action";

const inputSchema = {
  vpc_id: z.string().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID VPC"),
};

const handler = async (params: { vpc_id: string }) => {
  try {
    await deleteVpcAction(params.vpc_id);
    return createToolResponse(`✅ VPC ${params.vpc_id} удалена.`);
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const deleteVpcTool = {
  name: ToolNames.DELETE_VPC,
  title: "Удаление VPC",
  description: "Удаляет виртуальную приватную сеть (VPC) по её ID",
  inputSchema,
  handler,
};
