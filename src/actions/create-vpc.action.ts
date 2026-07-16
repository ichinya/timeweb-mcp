import { dbaasApiClient } from "../api";
import { AvailabilityZones } from "../types/availability-zones.enum";
import { Vpc } from "../types/vpc.type";

export const createVpcAction = async (
  availabilityZone: AvailabilityZones,
  name: string,
  subnetV4: string
): Promise<Vpc> => {
  return await dbaasApiClient.createVpc(availabilityZone, name, subnetV4);
};
