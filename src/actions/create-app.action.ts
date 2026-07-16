import { appsApiClient } from "../api";
import { AppTypes } from "../types/app-types.enum";
import { CreateAppParams } from "../types/create-app-params.type";

export const createAppAction = async ({
  run_cmd = "",
  index_dir = "",
  system_dependencies = [],
  envs = {},
  ...params
}: CreateAppParams) => {
  const appParams: CreateAppParams = { ...params };

  if (appParams.type === AppTypes.FRONTEND) {
    appParams.index_dir = index_dir;
  } else {
    appParams.run_cmd = run_cmd;
  }

  appParams.system_dependencies = system_dependencies;
  appParams.envs = envs;

  const response = await appsApiClient.createApp(appParams);

  return response?.app || null;
};
