import { AvailabilityZones } from "./availability-zones.enum";
import { ServiceLocations } from "./service-locations.enum";

export interface Vpc {
  id: string;
  description: string | null;
  subnet_v4: string;
  location: ServiceLocations;
  created_at: string;
  availability_zone: AvailabilityZones;
  name: string;
  public_ip: string | null;
  type: string;
  busy_address: string[];
}
