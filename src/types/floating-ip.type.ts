import { AvailabilityZones } from "./availability-zones.enum";

export interface FloatingIp {
  id: string;
  ip: string;
  is_ddos_guard: boolean;
  availability_zone: AvailabilityZones;
  comment: string;
  created_at: string;
}
