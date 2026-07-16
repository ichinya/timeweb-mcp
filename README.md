# Timeweb Cloud MCP Server

MCP-сервер для управления инфраструктурой Timeweb Cloud из Cursor, VS Code и других клиентов, поддерживающих [Model Context Protocol](https://modelcontextprotocol.io/).

Сервер работает через `stdio`, принимает вызовы MCP-инструментов и выполняет соответствующие запросы к API Timeweb Cloud.

> [!WARNING]
> Проект находится в активной экспериментальной разработке и развивается независимо от Timeweb Cloud. Некоторые возможности API могут быть реализованы не полностью или меняться между версиями.

## Возможности

Текущая сборка регистрирует:

| Возможность MCP | Количество |
| --------------- | ---------: |
| Инструменты     |        245 |
| Ресурсы         |          6 |
| Промпты         |          2 |

Инструменты охватывают основные операции со следующими сервисами:

- приложения App Platform и VCS-провайдеры;
- облачные и выделенные серверы, диски, резервные копии и образы;
- проекты, VPC, плавающие IP, сетевые диски и Firewall;
- Kubernetes, балансировщики и реестры контейнеров;
- базы данных;
- S3-хранилища;
- домены, DNS и почта;
- SSH-ключи и API-ключи;
- AI-агенты;
- аккаунт, платежная информация, тарифы и локации.

Доступные MCP-ресурсы:

- `allowed_presets`;
- `vcs_providers`;
- `vcs_provider_repositories`;
- `deploy_settings`;
- `database_presets`;
- `get_vpcs`.

Доступные промпты:

- `create_app_prompt`;
- `add_vcs_provider_prompt`.

Полный список фактически зарегистрированных инструментов находится в [`src/tools/index.ts`](src/tools/index.ts).

> [!NOTE]
> Официальная OpenAPI-спецификация содержит 341 операцию в 23 группах. Это не означает, что каждая операция уже представлена отдельным MCP-инструментом.

## Требования

- Node.js 20 или новее;
- npm;
- MCP-клиент с поддержкой локальных `stdio`-серверов;
- API-токен Timeweb Cloud.

## Получение API-токена

Создайте токен в панели Timeweb Cloud в разделе «API и Terraform». Официальная инструкция: [Токены API и Terraform](https://timeweb.cloud/docs/account-management/token).

Проект ожидает токен в переменной окружения:

```text
TIMEWEB_TOKEN
```

Не путайте её с `TIMEWEB_CLOUD_TOKEN`, которая используется в некоторых других инструментах Timeweb Cloud.

По возможности выпускайте токен с ограниченными правами и сроком действия. Не сохраняйте настоящий токен в Git.

## Быстрый старт

Пакет не требует глобальной установки:

```bash
npx -y timeweb-mcp
```

Обычно сервер запускает MCP-клиент, передавая `TIMEWEB_TOKEN` через свою конфигурацию.

## Подключение MCP-клиента

### Cursor

Добавьте сервер в `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "timeweb-cloud": {
      "command": "npx",
      "args": ["-y", "timeweb-mcp"],
      "env": {
        "TIMEWEB_TOKEN": "your-timeweb-token"
      }
    }
  }
}
```

Не добавляйте конфигурацию с настоящим токеном в публичный репозиторий.

### VS Code

VS Code хранит конфигурацию рабочего пространства в `.vscode/mcp.json`. Токен можно запрашивать через защищённое поле ввода:

```json
{
  "inputs": [
    {
      "type": "promptString",
      "id": "timeweb-token",
      "description": "Timeweb Cloud API token",
      "password": true
    }
  ],
  "servers": {
    "timeweb-cloud": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "timeweb-mcp"],
      "env": {
        "TIMEWEB_TOKEN": "${input:timeweb-token}"
      }
    }
  }
}
```

Управлять сервером можно через команды `MCP: List Servers` и `MCP: Open Workspace Folder MCP Configuration`.

### Другие MCP-клиенты

Для клиентов, использующих формат `mcpServers`, базовая конфигурация выглядит так:

```json
{
  "mcpServers": {
    "timeweb-cloud": {
      "command": "npx",
      "args": ["-y", "timeweb-mcp"],
      "env": {
        "TIMEWEB_TOKEN": "your-timeweb-token"
      }
    }
  }
}
```

Название корневого поля и способ безопасного хранения секретов зависят от конкретного MCP-клиента.

## Локальная разработка

Клонируйте репозиторий и установите зависимости:

```bash
git clone https://github.com/ichinya/timeweb-mcp.git
cd timeweb-mcp
npm ci
```

Создайте локальный файл `.env`:

```dotenv
TIMEWEB_TOKEN=your-timeweb-token
```

Проверьте типы и соберите сервер:

```bash
npm run type-check
npm run build
```

Запустите локальную сборку:

```bash
npm run start
```

## MCP Inspector

[MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector) позволяет просматривать инструменты, ресурсы и промпты, а также выполнять тестовые вызовы:

```bash
npm run inspect
```

Перед запуском добавьте `TIMEWEB_TOKEN` в `.env`.

## Команды разработки

| Команда                     | Назначение                                                             | Совместимость         |
| --------------------------- | ---------------------------------------------------------------------- | --------------------- |
| `npm run type-check`        | Проверка TypeScript без генерации файлов                               | Windows, macOS, Linux |
| `npm run build`             | Сборка проекта                                                         | Windows, macOS, Linux |
| `npm run test:release`      | Проверка логики определения новой версии и релизного тега              | Windows, macOS, Linux |
| `npm run smoke`             | Проверка запуска собранного MCP-сервера и чистоты `stdout`             | Windows, macOS, Linux |
| `npm run verify`            | Полная проверка OpenAPI, релизной логики, TypeScript, сборки и запуска | Windows, macOS, Linux |
| `npm run start`             | Запуск `dist/index.js` с загрузкой `.env`                              | Windows, macOS, Linux |
| `npm run inspect`           | Запуск MCP Inspector                                                   | Windows, macOS, Linux |
| `npm run clean`             | Удаление `dist`                                                        | Windows, macOS, Linux |
| `npm run normalize:openapi` | Нормализация конфликтующих имён схем                                   | Windows, macOS, Linux |
| `npm run validate:openapi`  | Проверка локальной OpenAPI-спецификации                                | Windows, macOS, Linux |

## Выпуск новой версии

Пакет публикуется автоматически из GitHub Actions через npm Trusted Publishing. Постоянный `NPM_TOKEN` в репозитории не используется.

1. Обновите версию одновременно в `package.json` и `package-lock.json`:

   ```bash
   npm version patch --no-git-tag-version
   ```

   Вместо `patch` можно использовать `minor`, `major` или указать точную версию.

2. Закоммитьте и отправьте изменения в `main`.
3. Workflow [`.github/workflows/publish.yml`](.github/workflows/publish.yml) сравнит новую версию с версией предыдущего коммита.
4. Если версия увеличилась, workflow проверит проект, создаст тег `vX.Y.Z`, опубликует пакет с той же версией в npm и создаст GitHub Release.

Создавать тег или GitHub Release вручную не нужно. Изменение других полей `package.json` без повышения версии не запускает выпуск. Понижение версии считается ошибкой.

Trusted Publisher в настройках npm должен быть связан со следующими значениями:

- GitHub user: `ichinya`;
- repository: `timeweb-mcp`;
- workflow filename: `publish.yml`;
- allowed action: `npm publish`;
- environment: не задан.

Публикация выполняется на GitHub-hosted runner через OIDC и автоматически получает npm provenance.

## OpenAPI-спецификация

Официальные источники:

- [интерактивная документация API](https://timeweb.cloud/api-docs);
- [OpenAPI JSON](https://timeweb.cloud/api-docs-data/bundle.json).

Локальная копия находится в [`specs/openapi.json`](specs/openapi.json).

Текущая спецификация содержит:

- OpenAPI `3.0.0`;
- 212 путей;
- 341 операцию;
- 23 группы;
- 283 схемы компонентов.

### Обновление спецификации

PowerShell:

```powershell
Invoke-WebRequest `
  -Uri "https://timeweb.cloud/api-docs-data/bundle.json" `
  -OutFile "specs/openapi.json"

npm run normalize:openapi
npm run validate:openapi
```

macOS или Linux:

```bash
curl -fsSL \
  https://timeweb.cloud/api-docs-data/bundle.json \
  -o specs/openapi.json

npm run normalize:openapi
npm run validate:openapi
```

Нормализация переименовывает только конфликтующие ключи в `components.schemas` и соответствующие внутренние `$ref`:

| Официальное имя          | Локальное имя             |
| ------------------------ | ------------------------- |
| `meta`                   | `CollectionMeta`          |
| `Meta`                   | `RequiredCollectionMeta`  |
| `location`               | `ServiceLocation`         |
| `Location`               | `ImageLocation`           |
| `autoreply-is-enabled`   | `MailV2AutoReplyEnabled`  |
| `autoreply-is-disabled`  | `MailV2AutoReplyDisabled` |
| `auto-reply-is-enabled`  | `MailV1AutoReplyEnabled`  |
| `auto-reply-is-disabled` | `MailV1AutoReplyDisabled` |

Это устраняет коллизии имён файлов и TypeScript-моделей на файловых системах без учёта регистра. Названия полей запросов и ответов, пути API и wire-формат данных не изменяются.

Скрипт проверки контролирует:

- версию OpenAPI;
- наличие и уникальность `operationId`;
- разрешение внутренних `$ref`;
- отсутствие коллизий генерируемых TypeScript-имён моделей.

## Структура проекта

```text
src/
  actions/      вызовы API и прикладные операции
  api/          клиенты сервисов Timeweb Cloud
  prompts/      MCP-промпты
  resources/    MCP-ресурсы
  tools/        определения и схемы MCP-инструментов
  types/        типы и DTO
scripts/
  normalize-openapi.mjs
  validate-openapi.mjs
specs/
  openapi.json
```

API-клиенты в `src/api` поддерживаются вручную. Код сервера пока не генерируется автоматически из `specs/openapi.json`.

## Безопасность

Инструменты выполняют операции над реальной инфраструктурой и могут создавать платные ресурсы, менять конфигурацию или удалять данные.

- Проверяйте имя инструмента и все аргументы перед подтверждением вызова.
- Используйте отдельный API-токен с минимально необходимыми правами.
- Не передавайте токен в сообщения модели и не сохраняйте его в Git.
- Сначала проверяйте опасные сценарии на тестовых ресурсах.
- Не полагайтесь только на MCP-аннотации: сейчас инструменты регистрируются с одинаковыми подсказками и не всегда корректно обозначают операции удаления или изменения данных.

Локальные MCP-серверы выполняются на машине пользователя с правами запустившего их процесса. Подключайте только доверенный код и проверяйте изменения перед обновлением.

## Известные ограничения

- Проект находится в экспериментальном состоянии.
- MCP-покрытие не равно полному покрытию официальной OpenAPI-спецификации.
- API-клиенты и DTO поддерживаются вручную и могут отставать от API.
- Автоматические тесты и отдельный CI-workflow пока не настроены; GitHub Actions используется только для публикации релизов в npm.

## Ссылки

- Репозиторий: [ichinya/timeweb-mcp](https://github.com/ichinya/timeweb-mcp)
- npm: [timeweb-mcp](https://www.npmjs.com/package/timeweb-mcp)
- Официальная документация Timeweb Cloud: [timeweb.cloud/docs](https://timeweb.cloud/docs)
- Официальная документация API: [timeweb.cloud/api-docs](https://timeweb.cloud/api-docs)

## Лицензия

В `package.json` указано `UNLICENSED`, отдельный файл лицензии отсутствует. Не предполагайте разрешение на распространение или повторное лицензирование кода без согласования с правообладателем.
