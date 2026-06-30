import { http } from './http';
import type { AdminModelPriceModel } from './adminModelPrices';
import { GPT_5_5_REQUEST_EXAMPLES, GPT_IMAGE_2_REQUEST_EXAMPLES } from '../config/providerCapabilities';

export interface AdminApiProviderRequestExample {
  label: string;
  endpoint: string;
  method?: string;
  contentType?: string;
  requestFormat?: string;
  body: Record<string, unknown>;
}

export interface AdminApiProvider {
  id: string;
  routeId?: string;
  lineId?: string;
  rk?: string;
  key?: string;
  code?: string;
  routeCode?: string;
  routeKey?: string;
  lineKey?: string;
  name?: string;
  dn?: string;
  displayName?: string;
  routeName?: string;
  routeDisplayName?: string;
  label?: string;
  group?: string;
  type?: string;
  category?: string;
  modelType?: string;
  enabled?: boolean;
  disabled?: boolean;
  status?: string;
  priority?: number;
  pri?: number;
  isDefault?: boolean;
  def?: boolean;
  defaultModelId?: string;
  defaultModelKey?: string;
  defaultModelRealName?: string;
  defaultModelDisplayName?: string;
  baseUrl?: string;
  apiKey?: string;
  modelCount?: number;
  supportsChat?: boolean;
  supportsImage?: boolean;
  apiFormat?: string;
  requestFormat?: string;
  endpoint?: string;
  requestPath?: string;
  requestBodyExample?: Record<string, unknown> | null;
  requestExamples?: AdminApiProviderRequestExample[];
  models?: AdminModelPriceModel[];
  chatEndpoint?: string;
  imageEndpoint?: string;
  imageEditEndpoint?: string;
  videoEndpoint?: string;
  defaultTextModel?: string;
  defaultImageModel?: string;
  defaultVideoModel?: string;
  multiplier?: number;
  rate?: number;
  remark?: string;
  note?: string;
}

export type AdminApiProviderPayload = Partial<AdminApiProvider> & {
  routeKey?: string;
  displayName?: string;
  baseUrl?: string;
  apiKey?: string;
};

export interface AdminApiProviderListParams {
  page?: number;
  pageSize?: number;
}

export interface AdminApiProviderListResponse {
  success?: boolean;
  items: AdminApiProvider[];
  providers: AdminApiProvider[];
  routes: AdminApiProvider[];
  list?: AdminApiProvider[];
  data?: AdminApiProvider[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawAdminApiProviderListResponse {
  success?: boolean;
  items?: AdminApiProvider[];
  providers?: AdminApiProvider[];
  routes?: AdminApiProvider[];
  list?: AdminApiProvider[];
  data?: AdminApiProvider[];
  total?: number;
  page?: number;
  pageSize?: number;
}

interface RawAdminApiProviderMutationResponse extends RawAdminApiProviderListResponse {
  item?: AdminApiProvider;
  provider?: AdminApiProvider;
  route?: AdminApiProvider;
  id?: string;
  deleted?: boolean;
  defaultRouteId?: string;
  message?: string;
  latencyMs?: number;
}

export const OFFICIAL_DUAL_API_PROVIDERS: AdminApiProvider[] = [
  {
    id: 'pub_route_openai_gpt_image_2',
    routeKey: 'route_openai_gpt_image_2',
    name: 'GPT Image 2',
    displayName: 'GPT Image 2',
    type: 'image',
    category: 'image',
    group: 'image',
    enabled: true,
    status: 'active',
    priority: 10,
    isDefault: true,
    defaultModelKey: 'gpt-image-2',
    defaultModelRealName: 'gpt-image-2',
    defaultModelDisplayName: 'GPT Image 2',
    apiFormat: 'openai-images',
    requestFormat: 'packy-openai-images-generations',
    endpoint: '/images/generations',
    requestPath: '/images/generations',
    imageEndpoint: '/v1/images/generations',
    imageEditEndpoint: '/v1/images/edits',
    requestExamples: GPT_IMAGE_2_REQUEST_EXAMPLES,
    requestBodyExample: {
      model: 'gpt-image-2',
      prompt: 'string',
      size: '1024x1024',
      quality: 'auto',
      output_format: 'png',
      response_format: 'url',
      n: 1
    }
  },
  {
    id: 'pub_route_openai_gpt_5_5',
    routeKey: 'route_openai_gpt_5_5',
    name: 'GPT 5.5',
    displayName: 'GPT 5.5',
    type: 'text',
    category: 'text',
    group: 'text',
    enabled: true,
    status: 'active',
    priority: 9,
    defaultModelKey: 'gpt-5.5',
    defaultModelRealName: 'gpt-5.5',
    defaultModelDisplayName: 'GPT 5.5',
    apiFormat: 'openai-responses',
    requestFormat: 'openai-responses',
    endpoint: '/responses',
    requestPath: '/responses',
    requestExamples: GPT_5_5_REQUEST_EXAMPLES,
    requestBodyExample: {
      model: 'gpt-5.5',
      input: 'string'
    }
  }
];

export async function getAdminApiProviders(
  params: AdminApiProviderListParams = {}
): Promise<AdminApiProviderListResponse> {
  const response = await http.get<RawAdminApiProviderListResponse>('/api/admin/api-providers', { params });
  const data = response.data;
  const providers = data.items || data.providers || data.routes || data.list || data.data || [];
  return {
    ...data,
    items: providers,
    providers,
    routes: providers,
    total: Number(data.total ?? providers.length),
    page: Number(data.page ?? params.page ?? 1),
    pageSize: Number(data.pageSize ?? params.pageSize ?? (providers.length || 10))
  };
}

function normalizeListResponse(
  data: RawAdminApiProviderListResponse,
  fallbackParams: AdminApiProviderListParams = {}
): AdminApiProviderListResponse {
  const providers = data.items || data.providers || data.routes || data.list || data.data || [];
  return {
    ...data,
    items: providers,
    providers,
    routes: providers,
    total: Number(data.total ?? providers.length),
    page: Number(data.page ?? fallbackParams.page ?? 1),
    pageSize: Number(data.pageSize ?? fallbackParams.pageSize ?? (providers.length || 10))
  };
}

function normalizeMutationItem(data: RawAdminApiProviderMutationResponse): AdminApiProvider {
  const item = data.item || data.provider || data.route || data.items?.[0] || data.providers?.[0] || data.routes?.[0];
  if (!item) {
    throw new Error('后端未返回 API 线路数据');
  }
  return item;
}

export async function replaceAdminApiProviders(
  routes: AdminApiProvider[] = OFFICIAL_DUAL_API_PROVIDERS
): Promise<AdminApiProviderListResponse> {
  const response = await http.put<RawAdminApiProviderListResponse>('/api/admin/api-providers', { routes });
  return normalizeListResponse(response.data);
}

export async function createAdminApiProvider(payload: AdminApiProviderPayload): Promise<AdminApiProvider> {
  const response = await http.post<RawAdminApiProviderMutationResponse>('/api/admin/api-providers', payload);
  return normalizeMutationItem(response.data);
}

export async function updateAdminApiProvider(id: string, payload: AdminApiProviderPayload): Promise<AdminApiProvider> {
  const response = await http.put<RawAdminApiProviderMutationResponse>(
    `/api/admin/api-providers/${encodeURIComponent(id)}`,
    payload
  );
  return normalizeMutationItem(response.data);
}

export async function deleteAdminApiProvider(id: string): Promise<RawAdminApiProviderMutationResponse> {
  const response = await http.delete<RawAdminApiProviderMutationResponse>(
    `/api/admin/api-providers/${encodeURIComponent(id)}`
  );
  return response.data;
}

export async function testAdminApiProvider(id: string): Promise<RawAdminApiProviderMutationResponse> {
  const response = await http.post<RawAdminApiProviderMutationResponse>(
    `/api/admin/api-providers/${encodeURIComponent(id)}/test`
  );
  return response.data;
}

export async function fetchAdminApiProviderModels(id: string): Promise<AdminModelPriceModel[]> {
  const response = await http.post<{ success?: boolean; items?: AdminModelPriceModel[]; models?: AdminModelPriceModel[] }>(
    `/api/admin/api-providers/${encodeURIComponent(id)}/fetch-models`
  );
  return response.data.items || response.data.models || [];
}

export async function setDefaultAdminApiProvider(id: string): Promise<RawAdminApiProviderMutationResponse> {
  const response = await http.post<RawAdminApiProviderMutationResponse>(
    `/api/admin/api-providers/${encodeURIComponent(id)}/set-default`
  );
  return response.data;
}
