export interface CreateAppResponseDto {
  app: {
    id: number;
    name: string;
    ip: string;
    type: string;
    domains: {
      fqdn: string;
    }[];
    framework: string;
    branch: string;
    comment: string;
    preset_id: number;
    is_auto_deploy: false;
    language: string;
    availability_zone: string;
    configuration: {
      cpu: number;
      ram: number;
      network_bandwidth: number;
      cpu_frequency: string;
      disk_type: string;
    };
  };
}
