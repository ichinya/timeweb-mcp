import { appsApiClient } from "../api/apps";
import { normalizeRepositoryUrl, parseVcsProviders, parseVcsRepositories } from "../vcs-repository";
import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { AppTypes } from "../types/app-types.enum";
import {
  FrameworksBackend,
  FrameworksFrontend,
} from "../types/app-frameworks.type";
import { ToolNames } from "../types/tool-names.enum";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { createAppAction } from "../actions/create-app.action";
import { CreateAppParams } from "../types/create-app-params.type";
import { getVcsProvidersAction } from "../actions/get-vcs-providers.action";
import { getAllowedPresetsAction } from "../actions/get-allowed-presets.action";
import { ResourceNames } from "../types/resource-names.enum";
import { getDeploySettingsAction } from "../actions/get-deploy-settings.action";

const frameworks = [
  ...Object.values(FrameworksFrontend),
  ...Object.values(FrameworksBackend),
];

const inputSchema = {
  type: z
    .nativeEnum(AppTypes).describe(`Тип приложения (frontend/backend). АВТОМАТИЧЕСКИ определить по структуре проекта`)
    .describe(
      "ОБЯЗАТЕЛЬНОЕ ПОЛЕ - тип приложения должен быть определен (frontend или backend)"
    ),

  provider_id: z
    .string().describe(`ID выбранного подключенного VCS провайдера. Получить через ${ToolNames.GET_VCS_PROVIDERS} или ${ToolNames.GET_VCS_PROVIDER_BY_REPOSITORY_URL}. ID сохраняется без автоматической замены.`)
    .uuid("ID провайдера должен быть валидным UUID")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID VCS провайдера"),

  repository_id: z
    .string().describe(`ID репозитория выбранного провайдера. Получить через ${ToolNames.GET_VCS_PROVIDER_REPOSITORIES} и проверить полный URL. Не создавать новый репозиторий автоматически.`)
    .uuid("ID репозитория должен быть валидным UUID")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID репозитория"),

  repository_url: z
    .string().describe("URL подключенного репозитория. АВТОМАТИЧЕСКИ достать из папки .git/refs/remotes/origin/, не запуская команды в терминале. URL должен быть в формате https://github.com/user/repo")
    .refine(value => normalizeRepositoryUrl(value) !== undefined, "Некорректный URL Git-репозитория")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - URL репозитория"),

  preset_id: z
    .number().describe(`ID пресета приложения в timeweb cloud. АВТОМАТИЧЕСКИ запросить с помощью ресурса ${ResourceNames.ALLOWED_PRESETS} доступные пресеты, и выбрать первый подходящий для определенного типа приложения и фреймворка`)
    .int("ID пресета должен быть целым числом")
    .positive("ID пресета должен быть положительным числом")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID пресета"),

  framework: z
    .union(
      [z.nativeEnum(FrameworksFrontend), z.nativeEnum(FrameworksBackend)]).describe("Фреймворк приложения. АВТОМАТИЧЕСКИ определить по структуре проекта, анализируя package.json, конфигурационные файлы и структуру директорий. Если в структуре проекта есть файлы Dockerfile или docker-compose, то это backend приложение с типом docker или docker-compose. Если определить не получается, запросить у пользователя")
    .describe(
      "ОБЯЗАТЕЛЬНОЕ ПОЛЕ - фреймворк приложения (React, Vue, Angular, Next.js, Django, Express, Laravel, Docker и др.). Если в структуре проекта есть файлы Dockerfile или docker-compose, то это backend приложение с типом docker или docker-compose."
    )
    .refine((framework) => frameworks.includes(framework), {
      message:
        "Фреймворк должен быть одним из следующих: " + frameworks.join(", "),
    }),

  commit_sha: z
    .string().describe("SHA коммита активной удаленной ветки. АВТОМАТИЧЕСКИ достать из .git/refs/remotes/origin/HEAD или соответствующей ветки, НЕ запуская команды в терминале. Должен быть полный SHA (40 символов)")
    .min(40, "SHA должен быть полный, не сокращенный")
    .max(40, "SHA должен быть ровно 40 символов")
    .regex(
      /^[a-f0-9]{40}$/i,
      "SHA должен содержать только шестнадцатеричные символы (a-f, 0-9)"
    )
    .refine((sha) => sha.trim().length === 40, {
      message: "SHA коммита должен быть ровно 40 символов (не считая пробелы)",
    })
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - SHA коммита (40 символов)"),

  branch_name: z
    .string().describe("Активная ветка. АВТОМАТИЧЕСКИ достать из .git/HEAD, не запуская команды в терминале.")
    .refine((branch) => branch.trim().length > 0, {
      message: "Некорректное название ветки",
    })
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - название ветки"),

  name: z
    .string().describe("Название приложения (2-3 слова).")
    .min(3, "Название должно содержать минимум 3 символа")
    .max(80, "Название слишком длинное (максимум 80 символов)")
    .regex(
      /^[a-zA-Zа-яА-Я0-9\s\-_]+$/,
      "Название может содержать только буквы, цифры, пробелы, дефисы и подчеркивания"
    )
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - название приложения"),

  build_cmd: z
    .string().describe(`Команда для сборки. АВТОМАТИЧЕСКИ определить в зависимости от фреймворка и структуры проекта. МОЖНО использовать ресурс ${ResourceNames.DEPLOY_SETTINGS} для получения настроек по умолчанию для конкретного фреймворка. ОБЯЗАТЕЛЬНО для всех приложений`)
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - команда сборки"),

  envs: z
    .record(z.string(), z.string()).describe("Это критически важная информация, которая влияет на работу приложения. Пользователь должен предоставить все переменные окружения.")
    .describe(
      "ОБЯЗАТЕЛЬНОЕ ПОЛЕ - переменные окружения. Пользователь должен указать их самостоятельно"
    )
    .default({}),

  comment: z
    .string().describe("Комментарий к приложению")
    .max(200, "Комментарий слишком длинный")
    .refine((comment) => comment.trim().length > 0, {
      message: "Комментарий не может состоять только из пробелов",
    })
    .default("Приложение создано через MCP сервер")
    .describe("НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - комментарий"),

  index_dir: z
    .string().describe(`Директория с index файлом (ТОЛЬКО для frontend приложений). Использовать ресурс ${ResourceNames.DEPLOY_SETTINGS} для получения настроек по умолчанию для конкретного фреймворка.`)
    .describe("ТОЛЬКО для frontend приложений - директория с index файлом")
    .optional(),

  run_cmd: z
    .string().describe(`Команда для запуска. Использовать ресурс ${ResourceNames.DEPLOY_SETTINGS} для получения настроек по умолчанию для конкретного фреймворка. ОБЯЗАТЕЛЬНО для backend приложений`)
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ для backend приложений - команда запуска"),

  system_dependencies: z
    .array(z.string()).describe("Системные зависимости. АВТОМАТИЧЕСКИ определить по фреймворку и структуре проекта, если нужно.")
    .describe("НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - системные зависимости (если нужно)")
    .default([]),

  is_auto_deploy: z
    .literal(false).describe("ВСЕГДА false при создании через MCP сервер")
    .default(false)
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - всегда false"),
};

type AppClient = Pick<typeof appsApiClient, "getVcsProviders" | "getVcsProviderRepositories" | "getAllowedPresets" | "getDeploySettings" | "createApp">;
const selectionSchema = z.object({ provider_id: inputSchema.provider_id, repository_id: inputSchema.repository_id,
  repository_url: inputSchema.repository_url, preset_id: inputSchema.preset_id, type: inputSchema.type });

export const createAppHandler = (client: AppClient = appsApiClient) => async (params: CreateAppParams) => {
  try {
    if (!selectionSchema.safeParse(params).success) {
      return createToolErrorResponse("❌ Некорректные параметры выбора провайдера, репозитория или тарифа.");
    }
    const [providerResponse, presets, deploySettings] = await Promise.all([
      getVcsProvidersAction(client), getAllowedPresetsAction(client), getDeploySettingsAction(client),
    ]);
    const providers = parseVcsProviders(providerResponse);
    const provider = providers.find(item => item.provider_id === params.provider_id);
    if (!provider) {
      return createToolErrorResponse("❌ Указанный VCS провайдер недоступен. Выберите подключенный provider_id.");
    }
    const repositoryResponse = await client.getVcsProviderRepositories(params.provider_id);
    const repositories = parseVcsRepositories(repositoryResponse?.repositories);
    const repository = repositories.find(item => item.id === params.repository_id);
    if (!repository || normalizeRepositoryUrl(repository.url) !== normalizeRepositoryUrl(params.repository_url)) {
      return createToolErrorResponse("❌ Репозиторий с указанными ID и URL недоступен у выбранного VCS провайдера.");
    }

    if (!presets) {
      return createToolErrorResponse(
        `❌ Не удалось получить список пресетов для создания приложения "${params.name}" в Timeweb Cloud`
      );
    }

    const presetType =
      params.type === AppTypes.FRONTEND
        ? "frontend_presets"
        : "backend_presets";
    const selectedPresets: unknown = presets[presetType];
    if (!Array.isArray(selectedPresets) || selectedPresets.some(item =>
      !item || typeof item !== "object" || !Number.isInteger(item.id) || item.id <= 0)) {
      return createToolErrorResponse("❌ Не удалось проверить тарифы: некорректный ответ API. Создание не отправлено.");
    }
    const preset = selectedPresets.find(item => item.id === params.preset_id);
    if (!preset) {
      return createToolErrorResponse(
        `❌ Не корректный ID пресета для создания приложения "${params.name}" в Timeweb Cloud. Используйте ресурс ${ResourceNames.ALLOWED_PRESETS}, чтобы получить список доступных пресетов`
      );
    }

    const deploySetting = deploySettings?.find(
      (setting) => setting.framework === params.framework
    );
    // Explicit values, including "", take priority; defaults only fill undefined.
    const appParams = {
      ...params,
      preset_id: params.preset_id,
      provider_id: params.provider_id,
      build_cmd: params.build_cmd !== undefined ? params.build_cmd : deploySetting?.build_cmd,
      run_cmd: params.run_cmd !== undefined ? params.run_cmd : deploySetting?.run_cmd,
      index_dir: params.index_dir !== undefined ? params.index_dir : deploySetting?.index_dir,
    };

    const app = await createAppAction(appParams, client);

    if (!app) {
      return createToolErrorResponse(
        `❌ Не удалось создать приложение "${params.name}" в Timeweb Cloud`
      );
    }

    return createToolResponse(`✅ Приложение "${
      app.name
    }" успешно создано в Timeweb Cloud!

📋 Детали созданного приложения:
• Название: ${app.name}
• Тип: ${app.type}
• Фреймворк: ${app.framework}
• Ветка: ${app.branch}
• IP: ${app.ip}
${
  app.domains.length > 0
    ? `• Приложение будет доступно по адресу: ${app.domains[0].fqdn}`
    : ""
}
• Пресет: ${app.preset_id}
${
  app.configuration
    ? `• Конфигурация: ${JSON.stringify(app.configuration)}`
    : ""
}
ОБЯЗАТЕЛЬНО УВЕДОМИ ПОЛЬЗОВАТЕЛЯ, что перед использованием приложения необходимо вручную настроить переменные окружения в панели управления Timeweb Cloud, так как у чатбота нет доступа к файлу .env вашего проекта.
🎉 Приложение скоро будет готово к использованию!`);
  } catch (error: unknown) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const createAppTool = {
  name: ToolNames.CREATE_TIMEWEB_APP,
  title: "Создание приложения в Timeweb Cloud",
  description: `Создает приложение в Timeweb Cloud с автоматическим определением параметров проекта.`,
  inputSchema,
  handler: createAppHandler(),
};
