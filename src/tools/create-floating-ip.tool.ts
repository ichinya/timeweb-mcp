import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse, createToolErrorResponse } from "../utils";
import { ToolNames } from "../types/tool-names.enum";
import { createFloatingIpAction } from "../actions/create-floating-ip.action";
import { AvailabilityZones } from "../types/availability-zones.enum";

const inputSchema = {
  availability_zone: z.nativeEnum(AvailabilityZones)
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - зона доступности"),
  is_ddos_guard: z
    .boolean({
      description: "Включить ли DDoS защиту для floating IP",
    })
    .default(false)
    .describe("НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - DDoS защита (по умолчанию: false)"),
};

const handler = async (params: {
  availability_zone: AvailabilityZones;
  is_ddos_guard?: boolean;
}) => {
  try {
    const availableZones = Object.values(AvailabilityZones);

    if (!availableZones.includes(params.availability_zone)) {
      return createToolErrorResponse(
        `❌ Неверная зона доступности: ${params.availability_zone}. Выбери из списка: ${availableZones.join(", ")}`
      );
    }

    const ip = await createFloatingIpAction(
      params.availability_zone,
      params.is_ddos_guard || false
    );

    if (!ip) {
      return createToolErrorResponse(
        `❌ Не удалось создать floating IP в зоне "${params.availability_zone}"`
      );
    }

    return createToolResponse(`✅ Floating IP успешно создан!

📋 Детали созданного IP:
• IP адрес: ${ip.ip}
• ID: ${ip.id}
• Зона доступности: ${ip.availability_zone}
• DDoS Guard: ${ip.is_ddos_guard ? "✅ Включен" : "❌ Отключен"}
• Комментарий: ${ip.comment || "Нет"}
• Создан: ${ip.created_at ? new Date(ip.created_at).toLocaleString("ru-RU") : "—"}

🎉 Floating IP готов к использованию!`);
  } catch (error) {
    return createToolErrorResponse(formatRequestError(error));
  }
};

export const createFloatingIpTool = {
  name: ToolNames.CREATE_FLOATING_IP,
  title: "Создание Floating IP",
  description: "Создает новый floating IP адрес в указанной зоне доступности",
  inputSchema,
  handler,
};
