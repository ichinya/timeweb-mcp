import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { deleteSubdomainAction } from "../actions/delete-subdomain.action";

const inputSchema = {
  fqdn: z
    .string()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - полное имя основного домена"),
  subdomain_fqdn: z
    .string()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - полное имя удаляемого поддомена"),
};

const handler = async (params: { fqdn: string; subdomain_fqdn: string }) => {
  try {
    await deleteSubdomainAction(params.fqdn, params.subdomain_fqdn);
    return createToolResponse(
      `✅ Поддомен ${params.subdomain_fqdn} удалён для домена ${params.fqdn}.`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const deleteSubdomainTool = {
  name: ToolNames.DELETE_SUBDOMAIN,
  title: "Удаление поддомена",
  description:
    "Удаляет поддомен по его FQDN из указанного основного домена.",
  inputSchema,
  handler,
};
