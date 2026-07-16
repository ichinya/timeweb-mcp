export interface DeploySettingsDto {
  framework: string;
  build_cmd: string;
  index_dir: string;
  run_cmd?: string;
}

export interface GetDeploySettingsResponseDto {
  default_deploy_settings: DeploySettingsDto[];
}
