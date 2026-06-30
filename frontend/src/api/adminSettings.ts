import { http } from './http';

export interface AdminImageToolSetting {
  enabled?: boolean;
  routeId?: string;
  modelId?: string;
  promptTemplate?: string;
}

export interface AdminSettings {
  siteName?: string;
  registrationEnabled?: boolean;
  emailCodeEnabled?: boolean;
  canvasStorageEnabled?: boolean;
  templateImageEnabled?: boolean;
  imageHistoryEnabled?: boolean;
  mockMode?: boolean;
  maxUploadSizeMb?: number;
  defaultCredits?: number;
  registrationGiftCredits?: number;
  canvasCloudStorageEnabled?: boolean;
  canvasCloudStorageRemark?: string;
  smokeCheckedAt?: string;
  adminUiSaveEchoAt?: string;
  imageToolFeatures?: Record<string, AdminImageToolSetting>;
  [key: string]: unknown;
}

export interface AdminSettingsResponse {
  success?: boolean;
  settings: AdminSettings;
  data?: AdminSettings;
}

interface RawAdminSettingsResponse extends AdminSettings {
  success?: boolean;
  settings?: AdminSettings;
  data?: AdminSettings;
}

export async function getAdminSettings(): Promise<AdminSettingsResponse> {
  const response = await http.get<RawAdminSettingsResponse>('/api/admin/settings');
  const data = response.data;
  const settings = data.settings || data.data || data;
  return {
    success: data.success,
    settings,
    data: settings
  };
}

export async function updateAdminSettings(payload: Partial<AdminSettings>): Promise<AdminSettingsResponse> {
  const response = await http.patch<RawAdminSettingsResponse>('/api/admin/settings', payload);
  const data = response.data;
  const settings = data.settings || data.data || data;
  return {
    success: data.success,
    settings,
    data: settings
  };
}
