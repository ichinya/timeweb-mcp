import { dbaasApiClient } from "../api";

export const getVpcsAction = async () => {
  const response = await dbaasApiClient.getVpcs();

  return response.vpcs;
};
