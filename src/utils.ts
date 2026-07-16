import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { DatabaseTypes } from "./types/database-types.enum";
import { PresetDatabaseTypes } from "./types/preset-database-types.enum";

export const getVersion = (): string => {
  try {
    const packageJsonPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "package.json"
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

    return packageJson.version;
  } catch (error) {
    console.error("Failed to read package version:", error);
    return "unknown";
  }
};

export const createToolResponse = (text: string) => ({
  content: [{ type: "text" as const, text }],
});

export const createResourceResponse = (uri: string, text: string) => ({
  contents: [{ uri, text, mimeType: "application/json" }],
});

export const getPresetDatabaseType = (type: DatabaseTypes) => {
  switch (type) {
    case DatabaseTypes.MYSQL8_4:
    case DatabaseTypes.MYSQL8:
      return PresetDatabaseTypes.MYSQL;
    case DatabaseTypes.POSTGRESQL14:
    case DatabaseTypes.POSTGRESQL15:
    case DatabaseTypes.POSTGRESQL16:
    case DatabaseTypes.POSTGRESQL17:
      return PresetDatabaseTypes.POSTGRESQL;
    case DatabaseTypes.REDIS7:
    case DatabaseTypes.REDIS8_1:
      return PresetDatabaseTypes.REDIS;
    case DatabaseTypes.MONGODB7:
    case DatabaseTypes.MONGODB8_0:
      return PresetDatabaseTypes.MONGODB;
    case DatabaseTypes.OPENSEARCH:
    case DatabaseTypes.OPENSEARCH2_19:
      return PresetDatabaseTypes.OPENSEARCH;
    case DatabaseTypes.CLICKHOUSE:
    case DatabaseTypes.CLICKHOUSE24:
    case DatabaseTypes.CLICKHOUSE25:
      return PresetDatabaseTypes.CLICKHOUSE;
    case DatabaseTypes.KAFKA:
      return PresetDatabaseTypes.KAFKA;
    case DatabaseTypes.RABBITMQ:
    case DatabaseTypes.RABBITMQ4:
      return PresetDatabaseTypes.RABBITMQ;
  }
};