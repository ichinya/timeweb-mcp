import { CreateAppRequestDto } from "./dto/create-app-request.dto";

export interface CreateAppParams extends CreateAppRequestDto {
  repository_url: string;
}
