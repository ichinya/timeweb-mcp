import {
  DatabaseAdmin,
  DatabaseAutoBackups,
  DatabaseNetwork,
} from "../database.type";
import { DatabaseTypes } from "../database-types.enum";
import { AvailabilityZones } from "../availability-zones.enum";

export interface CreateDatabaseRequestDto {
  admin: DatabaseAdmin;
  name: string;
  type: DatabaseTypes;
  preset_id: number;
  availability_zone: AvailabilityZones;
  hash_type: "caching_sha2";
  project_id?: number;
  auto_backups: DatabaseAutoBackups;
  network: DatabaseNetwork;
}
