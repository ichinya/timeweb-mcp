import { appsApiClient } from "../api";

export const getVcsProvidersAction = async (client: Pick<typeof appsApiClient, "getVcsProviders"> = appsApiClient) => {
    const response = await client.getVcsProviders();

    return response.providers;
};
