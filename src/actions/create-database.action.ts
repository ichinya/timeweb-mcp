import { dbaasApiClient } from "../api";
import { Database } from "../types/database.type";
import { CreateDbParams } from "../types/create-db-params.type";

export const createDatabaseAction = async (params: CreateDbParams): Promise<Database> => {
  return await dbaasApiClient.createDatabase(params);
};
