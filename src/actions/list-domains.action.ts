import { domainsApiClient } from "../api";
import { Domain } from "../types/domain.type";
import { PageParams } from "../pagination";

export const listDomainsAction = async (): Promise<Domain[]> => {
  return await domainsApiClient.listDomains();
};

export const listDomainsPageAction = async (params?: PageParams,
  client: Pick<typeof domainsApiClient, "listDomainsPage"> = domainsApiClient) => client.listDomainsPage(params);
