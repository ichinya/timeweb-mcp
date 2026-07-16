import { dbaasApiClient } from "../api";
import { FloatingIp } from "../types/floating-ip.type";
import { AvailabilityZones } from "../types/availability-zones.enum";

export const createFloatingIpAction = async (
  availabilityZone: AvailabilityZones,
  isDdosGuard: boolean = false
): Promise<FloatingIp> => {
  return await dbaasApiClient.createFloatingIp(availabilityZone, isDdosGuard);
};
