import { getDatabasePresetsAction } from "../actions/get-database-presets.action";
import { ResourceNames } from "../types/resource-names.enum";
import { jsonResourceHandler } from "../resource-handler";

export const databasePresetsHandler = (load: () => Promise<unknown> = getDatabasePresetsAction) =>
  jsonResourceHandler(() => load());

export const databasePresetsResource = {
  name: ResourceNames.DATABASE_PRESETS,
  uri: "database-presets://all",
  title: "Пресеты баз данных",
  description: "Список доступных пресетов конфигураций для создания баз данных",
  mimeType: "application/json" as const,
  handler: databasePresetsHandler(),
};
