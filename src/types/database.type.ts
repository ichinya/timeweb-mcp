import { DatabaseTypes } from "./database-types.enum";
import { ServiceLocations } from "./service-locations.enum";

export interface Database {
  id: number;
  created_at: string;
  location: ServiceLocations;
  name: string;
  type: DatabaseTypes;
  hash_type: "caching_sha2";
  avatar_link: string | null;
  port: number;
  status: string;
  preset_id: number;
  disk: any | null;
  networks: any[];
  config_parameters: Record<string, any>;
  is_enabled_public_network: boolean;
  availability_zone: string;
  is_autobackups_enabled: boolean;
  cpu: any | null;
  cpu_frequency: any | null;
  ram: any | null;
  configurator_id: any | null;
  project_id: number | null;
  replica_list: any[];
  is_secure_connection_enabled: boolean;
  domains: any[];
}

export interface DatabaseAdmin {
  password: string;
  for_all: boolean;
}

export interface DatabaseAutoBackups {
  copy_count: number;
  creation_start_at: string;
  interval: "day" | "month";
  day_of_week: number;
}

export interface DatabaseNetwork {
  floating_ip: string;
  id: string;
}
