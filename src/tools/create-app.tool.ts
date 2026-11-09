import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { AppTypes } from "../types/app-types.enum";
import {
  FrameworksBackend,
  FrameworksFrontend,
} from "../types/app-frameworks.type";
import { ToolNames } from "../types/tool-names.enum";
import { createToolResponse } from "../utils";
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
    .nativeEnum(AppTypes, {
      description: `Тип приложения (frontend/backend). АВТОМАТИЧЕСКИ определить по структуре проекта`,
    })
    .describe(
      "ОБЯЗАТЕЛЬНОЕ ПОЛЕ - тип приложения должен быть определен (frontend или backend)"
    ),

  provider_id: z
    .string({
      description: `ID подключенного VCS провайдера в timeweb cloud. АВТОМАТИЧЕСКИ запросить с помощью tool ${ToolNames.GET_VCS_PROVIDER_BY_REPOSITORY_URL} подключенные провайдеры, и выбрать подходящий по названию репозитория. Если нет подходящих, создать новый репозиторий автоматически используя tool ${ToolNames.ADD_VCS_PROVIDER}.`,
    })
    .uuid("ID провайдера должен быть валидным UUID")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID VCS провайдера"),

  repository_id: z
    .string({
      description: `ID репозитория в timeweb cloud. АВТОМАТИЧЕСКИ запросить с помощью tool ${ToolNames.GET_VCS_PROVIDER_REPOSITORIES} подключенные репозитории с использованием provider_id, и выбрать подходящий по названию. Если нет подходящих, НЕ создавать новый репозиторий автоматически`,
    })
    .uuid("ID репозитория должен быть валидным UUID")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID репозитория"),

  repository_url: z
    .string({
      description:
        "URL подключенного репозитория. АВТОМАТИЧЕСКИ достать из папки .git/refs/remotes/origin/, не запуская команды в терминале. URL должен быть в формате https://github.com/user/repo",
    })
    .url("URL должен быть валидным")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - URL репозитория"),

  preset_id: z
    .number({
      description: `ID пресета приложения в timeweb cloud. АВТОМАТИЧЕСКИ запросить с помощью ресурса ${ResourceNames.ALLOWED_PRESETS} доступные пресеты, и выбрать первый подходящий для определенного типа приложения и фреймворка`,
    })
    .int("ID пресета должен быть целым числом")
    .positive("ID пресета должен быть положительным числом")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID пресета"),

  framework: z
    .union(
      [z.nativeEnum(FrameworksFrontend), z.nativeEnum(FrameworksBackend)],
      {
        description:
          "Фреймворк приложения. АВТОМАТИЧЕСКИ определить по структуре проекта, анализируя package.json, конфигурационные файлы и структуру директорий. Если в структуре проекта есть файлы Dockerfile или docker-compose, то это backend приложение с типом docker или docker-compose. Если определить не получается, запросить у пользователя",
      }
    )
    .describe(
      "ОБЯЗАТЕЛЬНОЕ ПОЛЕ - фреймворк приложения (React, Vue, Angular, Next.js, Django, Express, Laravel, Docker и др.). Если в структуре проекта есть файлы Dockerfile или docker-compose, то это backend приложение с типом docker или docker-compose."
    )
    .refine((framework) => frameworks.includes(framework), {
      message:
        "Фреймворк должен быть одним из следующих: " + frameworks.join(", "),
    }),

  commit_sha: z
    .string({
      description:
        "SHA коммита активной удаленной ветки. АВТОМАТИЧЕСКИ достать из .git/refs/remotes/origin/HEAD или соответствующей ветки, НЕ запуская команды в терминале. Должен быть полный SHA (40 символов)",
    })
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
    .string({
      description:
        "Активная ветка. АВТОМАТИЧЕСКИ достать из .git/HEAD, не запуская команды в терминале.",
    })
    .refine((branch) => branch.trim().length > 0, {
      message: "Некорректное название ветки",
    })
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - название ветки"),

  name: z
    .string({
      description: "Название приложения (2-3 слова).",
    })
    .min(3, "Название должно содержать минимум 3 символа")
    .max(80, "Название слишком длинное (максимум 80 символов)")
    .regex(
      /^[a-zA-Zа-яА-Я0-9\s\-_]+$/,
      "Название может содержать только буквы, цифры, пробелы, дефисы и подчеркивания"
    )
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - название приложения"),

  build_cmd: z
    .string({
      description: `Команда для сборки. АВТОМАТИЧЕСКИ определить в зависимости от фреймворка и структуры проекта. МОЖНО использовать ресурс ${ResourceNames.DEPLOY_SETTINGS} для получения настроек по умолчанию для конкретного фреймворка. ОБЯЗАТЕЛЬНО для всех приложений`,
    })
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - команда сборки"),

  envs: z
    .record(z.string(), {
      description:
        "Это критически важная информация, которая влияет на работу приложения. Пользователь должен предоставить все переменные окружения.",
    })
    .describe(
      "ОБЯЗАТЕЛЬНОЕ ПОЛЕ - переменные окружения. Пользователь должен указать их самостоятельно"
    )
    .default({}),

  comment: z
    .string({
      description: "Комментарий к приложению",
    })
    .max(200, "Комментарий слишком длинный")
    .refine((comment) => comment.trim().length > 0, {
      message: "Комментарий не может состоять только из пробелов",
    })
    .default("Приложение создано через MCP сервер")
    .describe("НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - комментарий"),

  index_dir: z
    .string({
      description: `Директория с index файлом (ТОЛЬКО для frontend приложений). Использовать ресурс ${ResourceNames.DEPLOY_SETTINGS} для получения настроек по умолчанию для конкретного фреймворка.`,
    })
    .describe("ТОЛЬКО для frontend приложений - директория с index файлом")
    .optional(),

  run_cmd: z
    .string({
      description: `Команда для запуска. Использовать ресурс ${ResourceNames.DEPLOY_SETTINGS} для получения настроек по умолчанию для конкретного фреймворка. ОБЯЗАТЕЛЬНО для backend приложений`,
    })
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ для backend приложений - команда запуска"),

  system_dependencies: z
    .array(z.string(), {
      description:
        "Системные зависимости. АВТОМАТИЧЕСКИ определить по фреймворку и структуре проекта, если нужно.",
    })
    .describe("НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - системные зависимости (если нужно)")
    .default([]),

  is_auto_deploy: z
    .literal(false, {
      description: "ВСЕГДА false при создании через MCP сервер",
    })
    .default(false)
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - всегда false"),
};

const handler = async (params: CreateAppParams) => {
  try {
    const [providers, presets, deploySettings] = await Promise.all([
      getVcsProvidersAction(),
      getAllowedPresetsAction(),
      getDeploySettingsAction(),
    ]);
    const repositoryName = params.repository_url
      .split("/")
      .pop()
      ?.replace(".git", "");
    const provider = providers?.find(
      (provider) => repositoryName && provider.login.includes(repositoryName)
    );

    if (!provider) {
      return createToolResponse(
        `❌ Не удалось найти VCS провайдер для репозитория "${params.repository_url}". Нужно добавить VCS провайдер с помощью tool ${ToolNames.ADD_VCS_PROVIDER}`
      );
    }

    if (!presets) {
      return createToolResponse(
        `❌ Не удалось получить список пресетов для создания приложения "${params.name}" в Timeweb Cloud`
      );
    }

    const presetType =
      params.type === AppTypes.FRONTEND
        ? "frontend_presets"
        : "backend_presets";
    let preset = presets[presetType]?.find(
      (preset) => preset.id === params.preset_id
    );

    if (!preset) {
      preset = presets[presetType]?.[0];
    }
    if (!preset) {
      return createToolResponse(
        `❌ Не корректный ID пресета для создания приложения "${params.name}" в Timeweb Cloud. Используйте ресурс ${ResourceNames.ALLOWED_PRESETS}, чтобы получить список доступных пресетов`
      );
    }

    const appParams = {
      ...params,
      preset_id: preset.id,
      provider_id: provider.provider_id,
    };

    const deploySetting = deploySettings?.find(
      (setting) => setting.framework === params.framework
    );
    if (deploySetting) {
      params.build_cmd = deploySetting.build_cmd;
      params.run_cmd = deploySetting.run_cmd;
      params.index_dir = deploySetting.index_dir;
    }

    const app = await createAppAction(appParams);

    if (!app) {
      return createToolResponse(
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
    return createToolResponse(formatRequestError(error));
  }
};

export const createAppTool = {
  name: ToolNames.CREATE_TIMEWEB_APP,
  title: "Создание приложения в Timeweb Cloud",
  description: `Создает приложение в Timeweb Cloud с автоматическим определением параметров проекта.`,
  inputSchema,
  handler,
};
