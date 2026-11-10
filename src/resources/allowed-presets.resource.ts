import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllowedPresetsAction } from "../actions/get-allowed-presets.action";
import { ResourceNames } from "../types/resource-names.enum";
import { jsonResourceHandler, invalidResourceResult } from "../resource-handler";

export const allowedPresetsHandler = (load: () => Promise<unknown> = getAllowedPresetsAction) =>
  jsonResourceHandler(() => load(), value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw invalidResourceResult();
    const presets = value as Record<string, unknown>;
    if (!Array.isArray(presets.frontend_presets) || !Array.isArray(presets.backend_presets)) throw invalidResourceResult();
    return value;
  });

export const allowedPresetsResource = {
  name: ResourceNames.ALLOWED_PRESETS,
  uri: "allowed-presets://all",
  template: new ResourceTemplate("allowed-presets://all", { list: undefined }),
  title: "Список доступных пресетов",
  description: "Список доступных пресетов для создания приложений в Timeweb Cloud",
  mimeType: "application/json" as const,
  handler: allowedPresetsHandler(),
};
