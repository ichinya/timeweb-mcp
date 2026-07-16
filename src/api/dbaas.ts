import { BaseApiClient } from "./client";
import { CreateFloatingIpRequestDto } from "../types/dto/create-floating-ip-request.dto";
import { CreateFloatingIpResponseDto } from "../types/dto/create-floating-ip-response.dto";
import { CreateVpcRequestDto } from "../types/dto/create-vpc-request.dto";
import { CreateVpcResponseDto } from "../types/dto/create-vpc-response.dto";
import { CreateDatabaseRequestDto } from "../types/dto/create-database-request.dto";
import { CreateDatabaseResponseDto } from "../types/dto/create-database-response.dto";
import { Database } from "../types/database.type";
import {
  DatabasePreset,
  DatabasePresetsResponse,
} from "../types/database-preset.type";
import { AvailabilityZones } from "../types/availability-zones.enum";
import { CreateDbParams } from "../types/create-db-params.type";
import { Vpc } from "../types/vpc.type";
import { FloatingIp } from "../types/floating-ip.type";
import { GetVpcsResponseDto } from "../types/dto/get-vpcs-response.dto";

export class DbaasApiClient extends BaseApiClient {
  /**
   * Создает новый floating IP адрес
   */
  async createFloatingIp(
    availabilityZone: AvailabilityZones,
    isDdosGuard: boolean = false
  ): Promise<FloatingIp> {
    const requestData: CreateFloatingIpRequestDto = {
      availability_zone: availabilityZone,
      is_ddos_guard: isDdosGuard,
    };

    const response = await this.post<CreateFloatingIpResponseDto>(
      "/api/v1/floating-ips",
      requestData
    );
    return response.ip;
  }

  /**
   * Получить список VPC пользователя
   */
  async getVpcs(): Promise<GetVpcsResponseDto> {
    return this.get<GetVpcsResponseDto>("/api/v2/vpcs");
  }

  /**
   * Создает новую виртуальную приватную сеть (VPC)
   */
  async createVpc(
    availabilityZone: AvailabilityZones,
    name: string,
    subnetV4: string
  ): Promise<Vpc> {
    const requestData: CreateVpcRequestDto = {
      availability_zone: availabilityZone,
      name: name,
      subnet_v4: subnetV4,
    };

    const response = await this.post<CreateVpcResponseDto>(
      "/api/v2/vpcs",
      requestData
    );
    return response.vpc;
  }

  /**
   * Создает новую базу данных
   */
  async createDatabase({
    name,
    type,
    presetId,
    availabilityZone,
    adminPassword,
    floatingIp,
    vpcId,
    hashType,
  }: CreateDbParams): Promise<Database> {
    const requestData: CreateDatabaseRequestDto = {
      admin: {
        password: adminPassword,
        for_all: false,
      },
      name: name,
      type: type,
      preset_id: presetId,
      availability_zone: availabilityZone,
      hash_type: hashType,
      auto_backups: {
        copy_count: 1,
        creation_start_at: new Date().toISOString(),
        interval: "day",
        day_of_week: 5,
      },
      network: {
        floating_ip: floatingIp,
        id: vpcId,
      },
    };

    const response = await this.post<CreateDatabaseResponseDto>(
      "/api/v1/databases",
      requestData
    );
    return response.db;
  }

  /**
   * Получает список пресетов баз данных
   */
  async getDatabasePresets(): Promise<DatabasePreset[]> {
    const response = await this.get<DatabasePresetsResponse>(
      "/api/v2/presets/dbs"
    );
    return response.databases_presets;
  }
}

export const dbaasApiClient: DbaasApiClient = new DbaasApiClient();
