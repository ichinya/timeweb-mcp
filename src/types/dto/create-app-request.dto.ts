import { AppFrameworks } from "../app-frameworks.type";
import { AppTypes } from "../app-types.enum";

export interface CreateAppRequestDto {
  type: AppTypes;
  provider_id: string;
  repository_id: string;
  preset_id: number;
  framework: AppFrameworks;
  commit_sha: string;
  branch_name: string;
  name: string;
  build_cmd?: string;
  envs?: Record<string, string>;
  is_auto_deploy?: false;
  comment?: string;
  index_dir?: string; // Only for frontend apps
  run_cmd?: string; // Only for backend apps
  system_dependencies?: string[];
}
