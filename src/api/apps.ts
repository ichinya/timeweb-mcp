import { BaseApiClient } from "./client";
import { CreateAppRequestDto } from "../types/dto/create-app-request.dto";
import { CreateAppResponseDto } from "../types/dto/create-app-response.dto";
import { GetPresetsResponseDto } from "../types/dto/get-presets-response.dto";
import { AddVcsProviderRequestDto } from "../types/dto/add-vcs-provider-request.dto";
import { GetVcsProvidersResponseDto } from "../types/dto/get-vcs-providers-response.dto";
import { GetVcsProviderRepositoriesResponseDto } from "../types/dto/get-vcs-provider-repositories-response.dto";
import { AddVcsProviderResponseDto } from "../types/dto/add-vcs-provider-response.dto";
import { GetDeploySettingsResponseDto } from "../types/dto/get-deploy-settings-response.dto";

/**
 * API клиент для работы с приложениями Timeweb Cloud
 */
export class AppsApiClient extends BaseApiClient {
  /**
   * Создать новое приложение
   */
  async createApp(appData: CreateAppRequestDto): Promise<CreateAppResponseDto> {
    return this.post<CreateAppResponseDto>("/api/v1/apps", appData);
  }

  /**
   * Получить список доступных пресетов
   */
  async getAllowedPresets(): Promise<GetPresetsResponseDto> {
    return this.get<GetPresetsResponseDto>("/api/v1/presets/apps");
  }

  /**
   * Добавить VCS провайдер
   */
  async addVcsProvider(
    params: AddVcsProviderRequestDto
  ): Promise<AddVcsProviderResponseDto> {
    return this.post<AddVcsProviderResponseDto>("/api/v1/vcs-provider", params);
  }

  /**
   * Получить список VCS провайдеров
   */
  async getVcsProviders(): Promise<GetVcsProvidersResponseDto> {
    return this.get<GetVcsProvidersResponseDto>("/api/v1/vcs-provider");
  }

  /**
   * Получить список репозиториев VCS провайдера
   */
  async getVcsProviderRepositories(
    providerId: string
  ): Promise<GetVcsProviderRepositoriesResponseDto> {
    return this.get<GetVcsProviderRepositoriesResponseDto>(
      `/api/v1/vcs-provider/${providerId}`
    );
  }

  /**
   * Получить настройки деплоя для приложений
   */
  async getDeploySettings(): Promise<GetDeploySettingsResponseDto> {
    return this.get<GetDeploySettingsResponseDto>(
      "/api/v1/deploy-settings/apps"
    );
  }
}

export const appsApiClient: AppsApiClient = new AppsApiClient();
