import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllowedPresetsAction } from "../actions/get-allowed-presets.action";
import { ResourceNames } from "../types/resource-names.enum";
import { createResourceResponse } from "../utils";

export const allowedPresetsResource = {
  name: ResourceNames.ALLOWED_PRESETS,
  uri: "allowed-presets://all",
  template: new ResourceTemplate("allowed-presets://all", { list: undefined }),
  title: "Список доступных пресетов",
  description:
    "Список доступных пресетов для создания приложений в Timeweb Cloud",
  handler: async (uri: URL) => {
    try {
      const result = await getAllowedPresetsAction();

      if (!result) {
        return createResourceResponse(uri.href, "Нет доступных пресетов");
      }

      return createResourceResponse(uri.href, JSON.stringify(result, null, 2));
    } catch (error: unknown) {
      if (error instanceof Error) {
        return createResourceResponse(
          uri.href,
          `Не удалось получить список пресетов. Причина: ${error.message}`
        );
      }

      return createResourceResponse(
        uri.href,
        `Не удалось получить список пресетов`
      );
    }
  },
};
