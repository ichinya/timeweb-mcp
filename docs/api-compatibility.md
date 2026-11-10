# Сверка API: issue #27

Источник: [официальный OpenAPI](https://timeweb.cloud/api-docs-data/bundle.json).
Дата загрузки, SHA-256 исходных байтов и нормализованного файла, исходный HEAD,
счётчики и список изменений операций записаны в `specs/openapi-source.json`.
Исходные байты сохранены в supporting artifacts текущего чата по указанному там пути;
этот локальный artifact не входит в распространяемый пакет или git-коммит исходников.
Canonical API host — `https://api.timeweb.cloud`. Автоматического fallback на другой
host или endpoint нет. Вызов клиента выполняет один HTTP dispatch.

## Матрица исключений

Машиночитаемый перечень — `specs/api-route-exceptions.json`: каждый элемент содержит
файл, метод клиента, HTTP-метод, путь, action, tool, источник, дату, причину и live-статус.

| Клиент / методы | HTTP и путь | MCP | Решение |
| --- | --- | --- | --- |
| Auth: listApiKeys, createApiKey | GET / POST `/api/v1/auth/api-keys` | listApiKeysTool / createApiKeyTool | Недокументированный legacy, сохранить |
| Auth: editApiKey, refreshApiKey, deleteApiKey | PATCH / PUT / DELETE `/api/v1/auth/api-keys/{id}` | editApiKeyTool / refreshApiKeyTool / deleteApiKeyTool | Недокументированный legacy, сохранить |
| Dbaas: listDatabases | GET `/api/v1/dbs` | Нет | Legacy action, сохранить |
| Dbaas: getDatabase, updateDatabase, deleteDatabase | GET / PATCH / DELETE `/api/v1/dbs/{id}` | Нет | Legacy actions, сохранить |
| KnowledgeBases: getKnowledgeBaseStatistic | GET `/api/v1/cloud-ai/knowledge-bases/{id}/statistic` | Нет | Удалён из опубликованной спецификации, сохранить с ограничением |

Первые девять операций отсутствовали и в прежнем локальном OpenAPI. Равноценная
документированная замена API-ключам и статистике базы знаний не найдена. `/databases`
описывает cluster-модели и уже используется отдельными методами; это не прямая замена
legacy `/dbs`. Статистика агента и AI Gateway относится к другим сущностям.
Отсутствие маршрута в спецификации не доказывает HTTP 404. Все десять live-статусов — UNKNOWN.

`node scripts/check-api-routes.mjs` выводит воспроизводимую матрицу. AST-анализ
учитывает HTTP-метод, параметры пути, query, endpoint-переменные и обе ветви условных
выражений. Распознаются явные литералы/шаблоны, конкатенация, параметры метода,
encodeURIComponent и существующий helper buildQuery, возвращающий query suffix.
Неизвестные выражения, новые несовпадения и неиспользованные исключения завершают
проверку ошибкой. Проверка включена в `validate:openapi`, следовательно и в `verify`.
Повторные и затенённые имена переменных консервативно считаются неоднозначными:
они дают UNKNOWN вместо выбора одной из привязок. Вызовы внутри вложенных функций
не разрешаются через переменные внешнего метода и также остаются UNKNOWN.
Анализ маршрутов не проверяет все поля request/response и не доказывает live-совместимость.

## Удаление кластера и 2FA

Нормализация выполняется в action через специализированный parser. Официальное
`database_delete.hash` и прежний верхнеуровневый `hash` превращаются в challenge.
Каждый присутствующий вариант проверяется; конфликт или неверный hash даёт безопасный
`invalid_response`, `outcome: unknown`, `semantics: mutation`, без повторного DELETE.
Challenge остаётся запросом 2FA даже после передачи code. Передача hash/code происходит
только при следующем явно запрошенном вызове, автоматической отправки нет.

Shared HTTP client возвращает только data и не сохраняет status в результате.
Ответ без тела (`undefined` или пустая строка) поэтому получает консервативный результат
unconfirmed: инструмент предлагает проверить состояние и не утверждает удаление.
`null`, `{}` и неожиданные непустые envelopes считаются некорректными ответами.

## Проверки и ограничения

Fixtures 2FA составлены по официальной схеме; legacy fixtures описывают только прежний
локальный контракт. Fake Axios adapter и сетевой запрет проверяют URL, Authorization
с фиктивным токеном, query/body, один dispatch, ошибки, отмену и production-регистрацию MCP.
Состав регистрации сохраняется: 245 tools, 5 статических ресурсов и 1 template.

`node --test scripts/openapi.test.mjs` проверяет нормализацию, ссылки, идемпотентность,
AST-анализ и provenance. Повторный `npm run normalize:openapi` не должен менять SHA-256.
При следующем обновлении OpenAPI provenance необходимо обновить после нормализации.
Hash нормализованного файла относится к UTF-8/LF output штатного скрипта; проверка
provenance канонизирует JSON тем же способом, учитывая CRLF-конверсию checkout на Windows.
API-клиенты поддерживаются вручную; совпадение пути не означает полное покрытие API.
Новые сервисы перечислены в [отдельном backlog](api-services-backlog.md).

Авторизованный Timeweb API — NOTRUN. Production и фактическая работоспособность legacy
маршрутов — UNKNOWN. Offline PASS эти ограничения не снимает.
