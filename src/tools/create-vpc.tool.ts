import { formatRequestError } from "../exceptions/server.exception";
import { z } from "zod";
import { createToolResponse } from "../utils";
import { createVpcAction } from "../actions/create-vpc.action";
import { ToolNames } from "../types/tool-names.enum";
import { AvailabilityZones } from "../types/availability-zones.enum";

const inputSchema = {
  availability_zone: z
    .nativeEnum(AvailabilityZones)
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - зона доступности"),
  name: z
    .string({
      description: "Название виртуальной приватной сети",
    })
    .describe("Название VPC")
    .default(""),
  subnet_v4: z
    .string({
      description: "IPv4 подсеть в формате CIDR (например: 192.168.0.0/24)",
    })
    .regex(
      /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/,
      "Подсеть должна быть в формате CIDR (например: 192.168.0.0/24)"
    )
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - IPv4 подсеть в формате CIDR"),
};

const handler = async (params: {
  availability_zone: AvailabilityZones;
  name: string;
  subnet_v4: string;
}) => {
  try {
    const availableZones = Object.values(AvailabilityZones);

    if (!availableZones.includes(params.availability_zone)) {
      return createToolResponse(
        `❌ Неверная зона доступности: ${params.availability_zone}. Выбери из списка: ${availableZones.join(", ")}`
      );
    }

    const vpc = await createVpcAction(
      params.availability_zone,
      params.name,
      params.subnet_v4
    );

    if (!vpc) {
      return createToolResponse(
        `❌ Не удалось создать VPC "${params.name}" в зоне "${params.availability_zone}"`
      );
    }

    return createToolResponse(`✅ Виртуальная приватная сеть успешно создана!

📋 Детали созданной VPC:
• Название: ${vpc.name}
• ID: ${vpc.id}
• Зона доступности: ${vpc.availability_zone}
• Локация: ${vpc.location}
• Подсеть IPv4: ${vpc.subnet_v4}
• Тип: ${vpc.type}
• Описание: ${vpc.description || "Нет"}
• Публичный IP: ${vpc.public_ip || "Нет"}
• Создана: ${new Date(vpc.created_at).toLocaleString("ru-RU")}
• Занятые адреса: ${vpc.busy_address.join(", ")}

🎉 VPC готова к использованию!`);
  } catch (error) {
    return createToolResponse(formatRequestError(error));
  }
};

export const createVpcTool = {
  name: ToolNames.CREATE_VPC,
  title: "Создание виртуальной приватной сети (VPC)",
  description:
    "Создает новую виртуальную приватную сеть в указанной зоне доступности",
  inputSchema,
  handler,
};
