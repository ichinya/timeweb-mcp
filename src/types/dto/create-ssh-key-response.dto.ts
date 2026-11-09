import { SshKey } from "../ssh-key.type";

export interface CreateSshKeyResponseDto {
  ssh_key?: SshKey;
  "ssh-key"?: SshKey;
}
