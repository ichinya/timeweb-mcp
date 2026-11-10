import { dbaasApiClient } from "../api";
import { DatabaseClusterDeleteResult, parseDatabaseClusterDeleteResponse } from "../api/database-cluster-delete-response";

export const deleteDatabaseClusterAction = async (
  clusterId: number,
  hash?: string,
  code?: string
): Promise<DatabaseClusterDeleteResult> => {
  return parseDatabaseClusterDeleteResponse(await dbaasApiClient.deleteDatabaseCluster(clusterId, hash, code));
};
