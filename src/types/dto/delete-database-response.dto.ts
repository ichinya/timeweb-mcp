import { DatabaseDeleteResponse } from "../database-cluster.type";

export type DeleteDatabaseClusterResponseDto =
  | { database_delete: { hash: string }; response_id?: string }
  | { hash: string }
  | void;

export type DeleteDatabaseResponseDto = {
  database_delete?: DatabaseDeleteResponse;
};
