import { SshKey } from "../ssh-key.type";

export interface GetSshKeyResponseDto {
  ssh_key?: SshKey;
  "ssh-key"?: SshKey;
  meta: { total: number };
}
