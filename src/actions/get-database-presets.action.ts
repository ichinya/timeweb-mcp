import { dbaasApiClient } from "../api";
import { DatabasePreset } from "../types/database-preset.type";

export const getDatabasePresetsAction =
  async (): Promise<DatabasePreset[]> => {
    return await dbaasApiClient.getDatabasePresets();
  };
