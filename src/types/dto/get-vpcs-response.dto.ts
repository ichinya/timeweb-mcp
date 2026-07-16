import { Vpc } from "../vpc.type";

export interface GetVpcsResponseDto {
  meta: {
    total: number;
  };
  vpcs: Vpc[];
}
