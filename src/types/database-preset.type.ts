import { PresetDatabaseTypes } from "./preset-database-types.enum";
import { ServiceLocations } from "./service-locations.enum";

export interface DatabasePreset {
  id: number;
  description: string;
  description_short: string;
  cpu: number;
  ram: number;
  disk: number;
  type: PresetDatabaseTypes;
  price: number;
  location: ServiceLocations;
  vds_node_configuration_id: number;
}

export interface DatabasePresetsMeta {
  total: number;
}

export interface DatabasePresetsResponse {
  meta: DatabasePresetsMeta;
  databases_presets: DatabasePreset[];
}
