import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { AddVcsProviderRequestDto } from "../types/dto/add-vcs-provider-request.dto";
import { addVcsProviderAction } from "../actions/add-vcs-provider.action";
import { ToolNames } from "../types/tool-names.enum";
import { VcsProviders } from "../types/vcs-providers.enum";

const inputSchema = {
  url: z
    .string().describe(`URL репозитория в формате HTTPS. Пример https://github.com/username/repo.git. АВТОМАТИЧЕСКИ определить из .git/config если не указано явно`)
    .url("URL должен быть валидным"),
  login: z
    .string().describe(`ЛОГИН ДЛЯ ДОСТУПА К РЕПОЗИТОРИЮ.
        🔒 ОБЯЗАТЕЛЬНО для приватных репозиториев!

        Если при добавлении провайдера возникнет ошибка авторизации:
        • Запросить логин и пароль/токен у пользователя
        • Если ошибка авторизации - ПЕРЕЗАПРОСИТЬ с новыми данными`)
    .optional(),
  password: z
    .string().describe(`ПАРОЛЬ ИЛИ ТОКЕН ДЛЯ ДОСТУПА К РЕПОЗИТОРИЮ.
        🔒 ОБЯЗАТЕЛЬНО для приватных репозиториев!

        Варианты:
        • Personal Access Token (рекомендуется)
        • Пароль аккаунта

        Если при добавлении провайдера возникнет ошибка авторизации:
        • Запросить токен/пароль у пользователя
        • Если ошибка авторизации - ПЕРЕЗАПРОСИТЬ с новыми данными`)
    .optional(),
  provider_type: z.nativeEnum(VcsProviders).describe("Тип VCS провайдера"),
};

const handler = async (params: AddVcsProviderRequestDto) => {
  try {

    if (!params.provider_type) {
      return createToolErrorResponse(
        `❌ Не указан тип VCS провайдера!`
      );
    }

    if (params.provider_type === VcsProviders.GIT) {
      await addVcsProviderAction(params);
    } else {
      return createToolErrorResponse(
        `❌ Не поддерживается тип VCS провайдера: используйте git для подключения по ссылке`
      );
    }


    return createToolResponse(`✅ VCS провайдер успешно добавлен!

📋 Детали провайдера:
• Тип: ${params.provider_type}
• URL: ${params.url}
${params.login ? `• Логин: ${params.login}` : ""}
${params.password ? `• Пароль/токен: ***` : ""}

🎉 Провайдер готов к использованию для деплоя приложений!`);
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const addVcsProviderTool = {
  name: ToolNames.ADD_VCS_PROVIDER,
  title: "Добавление VCS провайдера",
  description: `Добавляет новый VCS провайдер для подключения Git репозиториев к Timeweb Cloud`,
  inputSchema,
  handler,
};
