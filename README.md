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
> Официальная OpenAPI-спецификация содержит 514 операций в 31 группе. Это не означает, что каждая операция уже представлена отдельным MCP-инструментом.

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

Для установки dev-зависимостей, сборки и проверок используйте Node.js 22.18+,
24.11+ или 26+ (чётные ветки): это требование tsdown. Готовый пакет по-прежнему
собирается с target Node.js 20. Обновлённый TypeScript 7 запускается через CLI;
типы offline-тестов проверяются по `tsconfig.tests.json` до их выполнения.

| Команда                     | Назначение                                                             | Совместимость         |
| --------------------------- | ---------------------------------------------------------------------- | --------------------- |
| `npm run type-check`        | Проверка TypeScript без генерации файлов                               | Windows, macOS, Linux |
| `npm run build`             | Сборка проекта                                                         | Windows, macOS, Linux |
| `npm run test:release`      | Проверка логики определения новой версии и релизного тега              | Windows, macOS, Linux |
| `npm run test:openapi`      | Тесты нормализации OpenAPI, provenance и анализатора маршрутов         | Windows, macOS, Linux |
| `npm run test:smoke-start`  | Сценарии готовности, timeout, вывода и завершения smoke-процесса        | Windows, macOS, Linux |
| `npm run test:transport`    | Проверка типов и offline-тесты ошибок API, отмены и потерянного ответа | Windows, macOS, Linux |
| `npm run smoke`             | Проверка запуска собранного MCP-сервера и чистоты `stdout`             | Windows, macOS, Linux |
| `npm run smoke:startup-series` | Шесть запусков сервера с измерениями первого и последующих стартов | Windows, macOS, Linux |
| `npm run verify`            | OpenAPI/маршруты, все тесты, TypeScript, сборка и оба smoke-теста       | Windows, macOS, Linux |
| `npm run start`             | Запуск `dist/index.js` с загрузкой `.env`                              | Windows, macOS, Linux |
| `npm run inspect`           | Запуск MCP Inspector                                                   | Windows, macOS, Linux |
| `npm run clean`             | Удаление `dist`                                                        | Windows, macOS, Linux |
| `npm run normalize:openapi` | Нормализация конфликтующих имён схем                                   | Windows, macOS, Linux |
| `npm run validate:openapi`  | Проверка локальной OpenAPI-спецификации                                | Windows, macOS, Linux |

Обработка ошибок, неизвестный результат изменения ресурса и правила повторов описаны в
[`docs/transport-errors.md`](docs/transport-errors.md). Автоматические повторы API-запросов
не выполняются. При потере ответа изменение могло завершиться: перед повтором проверьте
состояние ресурса. Транспортные тесты не используют настоящий токен или cloud-ресурсы.

Startup smoke по умолчанию ждёт готовность 5000 мс и проверяет пустой stdout сервера.
Единственный итог содержит status, readyMs/elapsedMs, PID, exit code/signal,
счётчики вывода и результат cleanup без содержимого stdout/stderr.
`spawn_error` с EPERM означает отказ запуска процесса; `timeout` — отсутствие
готовности в срок. После остановки предусмотрены два интервала cleanup по 1000 мс.
Измерения и ограничения расследования #31: [docs/smoke-startup.md](docs/smoke-startup.md).

Для медленного окружения startup smoke и startup-series принимают
`TIMEWEB_SMOKE_START_TIMEOUT_MS`: целое количество миллисекунд от 1000 до 30000,
записанное только ASCII-цифрами. Если переменная отсутствует, используется 5000;
пустая строка, пробелы, знаки, дроби, экспоненциальная запись и значения вне диапазона
дают один `configuration_error` и ненулевой exit до запуска сервера.
Исходное ошибочное значение не выводится. Выбранный timeoutMs виден в результате
и metadata серии. Настройка не меняет API timeout, MCP handshake и сроки cleanup;
увеличенный срок автоматически в CI не задаётся.

Пример PowerShell с восстановлением прежнего окружения:

```powershell
$previousTimeout = [Environment]::GetEnvironmentVariable('TIMEWEB_SMOKE_START_TIMEOUT_MS', 'Process')
try {
  $env:TIMEWEB_SMOKE_START_TIMEOUT_MS = '10000'
  npm run smoke
} finally {
  [Environment]::SetEnvironmentVariable('TIMEWEB_SMOKE_START_TIMEOUT_MS', $previousTimeout, 'Process')
}
```

## Проверки pull requests и main

Workflow [Verify](.github/workflows/verify.yml) запускается для всех pull requests
и каждого push в `main`, включая обычные изменения кода без повышения версии.
Фильтров по путям нет: изменения tests, scripts, specs и самих workflows также проверяются.

На Ubuntu и Windows с Node.js 24 выполняются `npm ci --ignore-scripts` по lockfile,
сборка, `npm run smoke:startup-series` и затем `npm run verify`.
Серия фиксирует первый и пять последующих запусков свежих процессов Node,
время готовности/завершения и хеш сборки; холодный файловый кеш не предполагается.
Обе платформы проверяются независимо: отказ одной не отменяет другую.
Единая команда verify включает проверку OpenAPI и маршрутов, test:openapi,
release- и smoke-start-тесты, проверку типов, offline transport/API/MCP-тесты, сборку и оба smoke-теста.
В CI `TIMEWEB_TOKEN` явно пустой; cloud-токены и repository secrets не требуются.
Это offline-проверки: они не подтверждают production-совместимость Timeweb API.

После успешного `verify` на обеих платформах запускается информационный аудит
метаданных MCP через mcpunit 1.5.0 (GitHub Action закреплён на commit SHA).
Он проверяет опубликованные схемы, описания инструментов и промптов без токена Timeweb.
Отчёт появляется в job summary; JSON, SARIF и Markdown сохраняются в артефакте
`mcpunit-ubuntu-latest` или `mcpunit-windows-latest`. Загрузка SARIF в Code Scanning отключена.
Оценка и сбои аудита пока не блокируют PR; обязательные проверки `verify` сохраняются.
Аудит дополняет существующие тесты API и обработчиков.

В MCP-инструментах `create_balancer` и `update_balancer` HTTP-путь проверки
состояния backend передаётся аргументом `health_check_path` (ранее `path`).
Обновите сохранённые MCP-вызовы этих инструментов и перечитайте их схемы в клиенте.
При создании аргумент обязателен; при обновлении его можно не передавать,
чтобы сохранить текущее значение. В запросах к Timeweb API поле по-прежнему
называется `path`: преобразование выполняется обработчиками MCP.
Отчёты mcpunit публикуются без фильтрации или исключений.

Verify имеет только `contents: read`, не публикует пакет и не создаёт теги/releases.
Новые запуски отменяют устаревшие проверки того же PR/ref, не затрагивая релизный workflow.
Проверка сама по себе не делает status check обязательным для merge:
branch protection/rulesets настраиваются отдельно. Настройки GitHub этим workflow не меняются.

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

Canonical API host: `https://api.timeweb.cloud`. Источник, дата UTC и SHA-256 загрузки
и нормализованного файла записаны в [`specs/openapi-source.json`](specs/openapi-source.json).
Матрица legacy-исключений и ограничения проверки описаны в
[`docs/api-compatibility.md`](docs/api-compatibility.md); новые сервисы — в
[`docs/api-services-backlog.md`](docs/api-services-backlog.md).

Текущая спецификация содержит:

- OpenAPI `3.0.0`;
- 336 путей;
- 514 операций;
- 31 группу;
- 466 схем компонентов.

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

`npm run validate:openapi` также проверяет маршруты клиентов. Полная матрица доступна
через `node scripts/check-api-routes.mjs`; тесты нормализации и provenance — через
`node --test scripts/openapi.test.mjs`. После обновления и нормализации спецификации
обновляйте дату и hashes в provenance-файле. Наличие маршрута в OpenAPI не подтверждает
совместимость всех полей или фактическую доступность legacy API.

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

Проект распространяется по лицензии [MIT](LICENSE).
Copyright (c) 2026 ichinya.
