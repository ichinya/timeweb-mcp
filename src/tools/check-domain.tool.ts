import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { checkDomainAction } from "../actions/check-domain.action";

const inputSchema = {
  fqdn: z
    .string()
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - полное имя домена для проверки доступности"),
};

const handler = async (params: { fqdn: string }) => {
  try {
    const available = await checkDomainAction(params.fqdn);
    if (available) {
      return createToolResponse(
        `✅ Домен ${params.fqdn} свободен и доступен для регистрации.`
      );
    }
    return createToolResponse(
      `⚠️ Домен ${params.fqdn} уже занят — зарегистрировать нельзя.`
    );
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const checkDomainTool = {
  name: ToolNames.CHECK_DOMAIN,
  title: "Проверка доступности домена для регистрации",
  description:
    "Проверяет, свободен ли домен и можно ли его зарегистрировать. Возвращает булево значение.",
  inputSchema,
  handler,
};
