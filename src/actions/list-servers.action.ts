import { serversApiClient } from "../api";
import { Server } from "../types/server.type";
import { PageParams } from "../pagination";

export const listServersAction = async (): Promise<Server[]> => {
  return await serversApiClient.listServers();
};

export const listServersPageAction = async (params?: PageParams,
  client: Pick<typeof serversApiClient, "listServersPage"> = serversApiClient) => client.listServersPage(params);
