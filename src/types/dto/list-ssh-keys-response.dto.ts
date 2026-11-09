import { SshKey } from "../ssh-key.type";

export interface ListSshKeysResponseDto {
  ssh_keys?: SshKey[];
  "ssh-keys"?: SshKey[];
  meta: { total: number };
}
