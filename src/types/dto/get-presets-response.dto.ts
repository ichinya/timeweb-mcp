export interface GetPresetsResponseDto {
    backend_presets: [
      {
        id: number;
        description: string;
        description_short: string;
        price: number;
        cpu: number;
        ram: number;
        disk: number;
        location: string;
        cpu_frequency: string;
      }
    ];
    frontend_presets: [
      {
        id: number;
        description: string;
        description_short: string;
        price: number;
        location: string;
        requests: number;
        disk: number;
      }
    ];
  }