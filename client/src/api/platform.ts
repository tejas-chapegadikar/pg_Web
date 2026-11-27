import apiClient from '@/lib/apiClient';
import type { PlatformMode } from './admin';

export interface PublicPlatform {
  mode: PlatformMode;
  announcement: string;
  waitlistMessage: string;
  maintenanceMessage: string;
  propertyTypes: { pg: boolean; flat: boolean };
  cities: string[];
}

export const platformApi = {
  get: async (): Promise<PublicPlatform> => (await apiClient.get('/platform')).data.data,
};
