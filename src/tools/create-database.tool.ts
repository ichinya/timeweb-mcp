import { z } from "zod";
import { createToolResponse, getPresetDatabaseType } from "../utils";
import { createDatabaseAction } from "../actions/create-database.action";
import { ToolNames } from "../types/tool-names.enum";
import { DatabaseTypes } from "../types/database-types.enum";
import { AvailabilityZones } from "../types/availability-zones.enum";
import { dbaasApiClient } from "../api";
import { ResourceNames } from "../types/resource-names.enum";

const inputSchema = {
  name: z
    .string({
      description: "Название базы данных",
    })
    .min(3, "Название не может быть пустым")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - название базы данных"),
  type: z
    .nativeEnum(DatabaseTypes)
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - тип базы данных"),
  preset_id: z
    .number({
      description: "ID пресета конфигурации базы данных",
    })
    .int("ID пресета должен быть целым числом")
    .positive("ID пресета должен быть положительным числом")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID пресета"),
  availability_zone: z
    .nativeEnum(AvailabilityZones)
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - зона доступности"),
  admin_password: z
    .string({
      description: "Пароль администратора базы данных",
    })
    .min(8, "Пароль должен содержать минимум 8 символов")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - пароль администратора"),
  floating_ip: z
    .string({
      description: "Floating IP адрес для подключения к базе данных",
    })
    .ip({
      version: "v4",
      message: "Floating IP должен быть валидным IPv4 адресом",
    })
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - floating IP адрес"),
  vpc_id: z
    .string({
      description: `ID виртуальной приватной сети (VPC). Получить список VPC можно в ресурсах ${ResourceNames.GET_VPCS}`,
    })
    .min(1, "ID VPC не может быть пустым")
    .describe("ОБЯЗАТЕЛЬНОЕ ПОЛЕ - ID VPC"),
  hash_type: z
    .string({
      description: "Тип хеширования паролей",
    })
    .default("caching_sha2")
    .describe(
      "НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - тип хеширования (по умолчанию: caching_sha2)"
    ),
  auto_backups: z
    .boolean({
      description: "Включить ли автоматические резервные копии",
    })
    .default(true)
    .describe(
      "НЕ ОБЯЗАТЕЛЬНОЕ ПОЛЕ - автоматические резервные копии (по умолчанию: true)"
    ),
};

const handler = async (params: {
  name: string;
  type: DatabaseTypes;
  preset_id: number;
  availability_zone: AvailabilityZones;
  admin_password: string;
  floating_ip: string;
  vpc_id: string;
  hash_type?: "caching_sha2";
}) => {
  try {
    const availableZones = Object.values(AvailabilityZones);

    if (!availableZones.includes(params.availability_zone)) {
      return createToolResponse(
        `❌ Неверная зона доступности: ${params.availability_zone}. Выбери из списка: ${availableZones.join(", ")}`
      );
    }

    const availableTypes = Object.values(DatabaseTypes);

    if (!availableTypes.includes(params.type)) {
      return createToolResponse(
        `❌ Неверный тип базы данных: ${params.type}. Выбери из списка: ${availableTypes.join(", ")}`
      );
    }

    const allPresets = await dbaasApiClient.getDatabasePresets();
    const availablePresets = allPresets.filter(preset => preset.type === getPresetDatabaseType(params.type));

    if (!availablePresets || !availablePresets.length) {
      return createToolResponse(
        `❌ Не удалось получить список пресетов баз данных. Убедитесь, что тип базы данных "${params.type}" соответствует типу пресета`
      );
    }

    const preset = availablePresets.find(preset => preset.id === params.preset_id);

    if (!preset) {
      return createToolResponse(
        `❌ Не корректный ID пресета для создания базы данных "${params.name}" в Timeweb Cloud. Используй доступые пресеты для этого типа базы данных ${JSON.stringify(availablePresets, null, 2)}`
      );
    }    

    const db = await createDatabaseAction({
      name: params.name,
      type: params.type,
      presetId: params.preset_id,
      availabilityZone: params.availability_zone,
      adminPassword: params.admin_password,
      floatingIp: params.floating_ip,
      vpcId: params.vpc_id,
      hashType: params.hash_type || "caching_sha2",
    });

    if (!db) {
      return createToolResponse(
        `❌ Не удалось создать базу данных "${params.name}"`
      );
    }

    return createToolResponse(`✅ База данных успешно создана!

📋 Детали созданной базы данных:
• Название: ${db.name}
• ID: ${db.id}
• Тип: ${db.type}
• Статус: ${db.status}
• Порт: ${db.port}
• Зона доступности: ${db.availability_zone}
• Локация: ${db.location}
• Пресет: ${db.preset_id}
• Проект: ${db.project_id}
• Тип хеширования: ${db.hash_type}
• Публичная сеть: ${db.is_enabled_public_network ? "✅" : "❌"}
• Автобэкапы: ${db.is_autobackups_enabled ? "✅" : "❌"}
• Безопасное соединение: ${db.is_secure_connection_enabled ? "✅" : "❌"}
• Создана: ${new Date(db.created_at).toLocaleString("ru-RU")}
ДАННЫЕ ДЛЯ ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ БУДУТ ДОСТУПНЫ ПОСЛЕ СОЗДАНИЯ В ПАНЕЛИ УПРАВЛЕНИЯ TIMEWEB CLOUD
🎉 База данных скоро будет готова к использованию!`);
  } catch (error) {
    if (error instanceof Error) {
      return createToolResponse(
        `❌ Ошибка создания базы данных. Причина: ${error.message}`
      );
    }
    return createToolResponse(`❌ Неизвестная ошибка при создании базы данных`);
  }
};

export const createDatabaseTool = {
  name: ToolNames.CREATE_DATABASE,
  title: "Создание базы данных",
  description:
    "Создает новую базу данных в Timeweb Cloud с указанными параметрами",
  inputSchema,
  handler,
};
