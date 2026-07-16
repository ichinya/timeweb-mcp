import { appsApiClient } from "../api";

export const getVcsProvidersAction = async () => {
    const response = await appsApiClient.getVcsProviders();

    return response.providers;
};
