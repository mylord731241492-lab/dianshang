import { http } from './http';

export interface AdminChatSettings {
  accessEnabled: boolean;
  textChatEnabled: boolean;
  imageToolsEnabled: boolean;
  allowedModels: string[];
  maintenanceMessage: string;
  managedAgents: AdminManagedChatAgent[];
}

export interface AdminManagedChatAgent {
  id: string;
  name: string;
  description: string;
  instructions: string;
  model: string;
  enabled: boolean;
  skillsEnabled: boolean;
  imageToolsEnabled: boolean;
}

export interface AdminChatModel {
  id: string;
  name: string;
  price: number;
}

export interface AdminChatDeployment {
  enabled: boolean;
  accessReady: boolean;
  bridgeSecretConfigured: boolean;
  realAiEnabled: boolean;
  providerMode: string;
  providerKeyConfigured: boolean;
  providerBaseConfigured: boolean;
  providerModel: string;
  ssoTtlSeconds: number;
  chatPath: string;
  apiPath: string;
  skills: {
    enabled: boolean;
    privateCreate: boolean;
    publicSharing: boolean;
  };
  mcp: {
    websiteTools: boolean;
    externalInstall: boolean;
  };
}

export interface AdminChatUsage {
  activeSsoTickets: number;
  textCharges: number;
  imageQuotes: number;
}

export interface AdminChatCheck {
  key: string;
  label: string;
  ok: boolean;
  message: string;
  status?: number;
  latencyMs?: number;
}

export interface AdminChatSettingsResponse {
  success: boolean;
  settings: AdminChatSettings;
  deployment: AdminChatDeployment;
  models: AdminChatModel[];
  usage: AdminChatUsage;
}

export interface AdminChatTestResponse extends AdminChatSettingsResponse {
  healthy: boolean;
  checkedAt: string;
  checks: AdminChatCheck[];
}

export interface AdminChatProviderTestResult {
  model: string;
  content: string;
  latencyMs: number;
  finishReason: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  providerMode: string;
  protocol: string;
  testedAt: string;
}

export interface AdminChatProviderTestResponse {
  success: boolean;
  result: AdminChatProviderTestResult;
}

export async function getAdminChatSettings() {
  const response = await http.get<AdminChatSettingsResponse>('/api/admin/chat/settings');
  return response.data;
}

export async function updateAdminChatSettings(payload: AdminChatSettings) {
  const response = await http.patch<AdminChatSettingsResponse>('/api/admin/chat/settings', payload);
  return response.data;
}

export async function testAdminChatConnection() {
  const response = await http.post<AdminChatTestResponse>('/api/admin/chat/test');
  return response.data;
}

export async function testAdminChatProvider(payload: { model: string; prompt: string }) {
  const response = await http.post<AdminChatProviderTestResponse>('/api/admin/chat/test-provider', {
    ...payload,
    confirmRealCall: true
  });
  return response.data;
}
