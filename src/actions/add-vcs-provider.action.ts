import { appsApiClient } from "../api";
import { AddVcsProviderRequestDto } from "../types/dto/add-vcs-provider-request.dto";

export const addVcsProviderAction = async (
  params: AddVcsProviderRequestDto
) => {
  const response = await appsApiClient.addVcsProvider(params);

  return response?.provider || null;
};
