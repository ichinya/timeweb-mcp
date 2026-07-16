import { AvailabilityZones } from "./availability-zones.enum";
import { DatabaseTypes } from "./database-types.enum";

export interface CreateDbParams {
  name: string,
  type: DatabaseTypes,
  presetId: number,
  availabilityZone: AvailabilityZones,
  adminPassword: string,
  floatingIp: string,
  vpcId: string,
  hashType: "caching_sha2"
}