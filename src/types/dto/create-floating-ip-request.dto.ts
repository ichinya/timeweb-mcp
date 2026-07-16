import { AvailabilityZones } from "../availability-zones.enum";

export interface CreateFloatingIpRequestDto {
  availability_zone: AvailabilityZones;
  is_ddos_guard: boolean;
}
