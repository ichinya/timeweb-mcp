import { VcsProviders } from "./vcs-providers.enum";

export interface VcsProvider {
  provider: VcsProviders;
  provider_id: string;
  login: string;
}
