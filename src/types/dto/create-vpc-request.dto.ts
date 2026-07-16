import { AvailabilityZones } from "../availability-zones.enum";

export interface CreateVpcRequestDto {
  availability_zone: AvailabilityZones;
  name: string;
  subnet_v4: string;
}
