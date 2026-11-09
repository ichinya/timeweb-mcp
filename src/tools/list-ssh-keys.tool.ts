import { formatRequestError } from "../exceptions/server.exception";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { listSshKeysAction } from "../actions/list-ssh-keys.action";

const inputSchema = {};

export const listSshKeysHandler = (list = listSshKeysAction) => async () => {
  try {
    const keys = await list();

    if (keys.length === 0) {
      return createToolResponse("На аккаунте нет SSH-ключей.");
    }

    const lines = keys.map((k) => {
      const usedBy =
        k.used_by && k.used_by.length > 0
          ? k.used_by.map((s) => `${s.name} (ID ${s.id})`).join(", ")
          : "—";
      const isDefault = k.is_default ? " (по умолчанию)" : "";
      return `• ID ${k.id} — ${k.name}${isDefault}\n  создан: ${new Date(k.created_at).toLocaleString("ru-RU")}\n  используется на серверах: ${usedBy}`;
    });

    return createToolResponse(
      `SSH-ключи (${keys.length}):\n\n${lines.join("\n\n")}`
    );
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const listSshKeysTool = {
  name: ToolNames.LIST_SSH_KEYS,
  title: "Список SSH-ключей",
  description:
    "Возвращает список всех SSH-ключей аккаунта: ID, имя, дата создания, флаг is_default и список серверов, на которых ключ используется. Используй перед операциями с SSH-ключами чтобы получить их ID.",
  inputSchema,
  handler: listSshKeysHandler(),
};
