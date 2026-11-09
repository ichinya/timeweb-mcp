import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { updateImageAction } from "../actions/update-image.action";

const inputSchema = {
  image_id: z.string().describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID образа"),
  name: z
    .string()
    .optional()
    .describe("НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - новое имя образа"),
  description: z
    .string()
    .optional()
    .describe("НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - новое описание образа"),
};

const handler = async (params: {
  image_id: string;
  name?: string;
  description?: string;
}) => {
  try {
    if (params.name === undefined && params.description === undefined) {
      return createToolErrorResponse(
        "❌ Нужно передать хотя бы одно из полей: name или description."
      );
    }

    const image = await updateImageAction(params.image_id, {
      name: params.name,
      description: params.description,
    });

    return createToolResponse(
      `✅ Образ ${image.id} обновлён. Имя: "${image.name || "(без имени)"}", описание: "${image.description || "—"}".`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const updateImageTool = {
  name: ToolNames.UPDATE_IMAGE,
  title: "Обновление образа",
  description:
    "Обновляет имя и/или описание образа. Другие атрибуты (ОС, локация, disk_id) изменить нельзя.",
  inputSchema,
  handler,
};
