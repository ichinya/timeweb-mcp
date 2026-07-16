import { VcsProviders } from "../vcs-providers.enum";

export interface AddVcsProviderRequestDto {
  provider_type: VcsProviders;
  url: string;
  login?: string;
  password?: string;
}
