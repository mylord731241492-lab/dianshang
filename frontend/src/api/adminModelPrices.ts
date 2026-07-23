import { http } from './http';

export interface AdminModelPriceModel {
  id: string;
  routeId?: string;
  routeKey?: string;
  routeName?: string;
  modelId?: string;
  modelKey?: string;
  realName?: string;
  displayName?: string;
  modelType?: string;
  type?: string;
  group?: string;
  category?: string;
  price?: number;
  pointCost?: number;
  pricePoints?: number;
  baseCredits?: number;
  enabled?: boolean;
  status?: string;
  qualities?: string[];
}

export interface AdminModelPriceRoute {
  id: string;
  routeId?: string;
  lineId?: string;
  key?: string;
  routeKey?: string;
  lineKey?: string;
  name?: string;
  displayName?: string;
  routeName?: string;
  routeDisplayName?: string;
  group?: string;
  type?: string;
  category?: string;
  modelType?: string;
  enabled?: boolean;
  disabled?: boolean;
  status?: string;
  priority?: number;
  isDefault?: boolean;
  models?: AdminModelPriceModel[];
}

export interface AdminModelPriceListParams {
  page?: number;
  pageSize?: number;
}

export interface AdminModelPriceListResponse {
  success?: boolean;
  items: AdminModelPriceRoute[];
  routes: AdminModelPriceRoute[];
  providers?: AdminModelPriceRoute[];
  list?: AdminModelPriceRoute[];
  data?: AdminModelPriceRoute[];
  models: AdminModelPriceModel[];
  prices?: AdminModelPriceModel[];
  rows?: AdminModelPriceModel[];
  total: number;
  totalModels: number;
  page: number;
  pageSize: number;
}

interface RawAdminModelPriceListResponse {
  success?: boolean;
  items?: AdminModelPriceRoute[];
  routes?: AdminModelPriceRoute[];
  providers?: AdminModelPriceRoute[];
  list?: AdminModelPriceRoute[];
  data?: AdminModelPriceRoute[];
  models?: AdminModelPriceModel[];
  prices?: AdminModelPriceModel[];
  rows?: AdminModelPriceModel[];
  total?: number;
  totalModels?: number;
  page?: number;
  pageSize?: number;
}

export interface AdminModelPricePayload {
  modelKey?: string;
  displayName?: string;
  realName?: string;
  price?: number;
  pricePoints?: number;
  baseCredits?: number;
  enabled?: boolean;
  qualities?: string[];
}

function flattenModels(routes: AdminModelPriceRoute[]) {
  return routes.flatMap((route) =>
    (route.models || []).map((model) => ({
      ...model,
      routeId: model.routeId || route.routeId || route.id,
      routeKey: model.routeKey || route.routeKey || route.lineKey || route.key,
      routeName: model.routeName || route.routeDisplayName || route.displayName || route.routeName || route.name
    }))
  );
}

export async function getAdminModelPrices(
  params: AdminModelPriceListParams = {}
): Promise<AdminModelPriceListResponse> {
  const response = await http.get<RawAdminModelPriceListResponse>('/api/admin/model-prices', { params });
  const data = response.data;
  const routes = data.items || data.routes || data.providers || data.list || data.data || [];
  const models = data.models || data.prices || data.rows || flattenModels(routes);
  return {
    ...data,
    items: routes,
    routes,
    models,
    total: Number(data.total ?? routes.length),
    totalModels: Number(data.totalModels ?? models.length),
    page: Number(data.page ?? params.page ?? 1),
    pageSize: Number(data.pageSize ?? params.pageSize ?? (routes.length || 10))
  };
}

export async function createAdminRouteModel(routeId: string, payload: AdminModelPricePayload) {
  const response = await http.post<{ success: boolean; item: AdminModelPriceModel }>(
    `/api/admin/routes/${encodeURIComponent(routeId)}/models`,
    payload
  );
  return response.data;
}

export async function updateAdminRouteModel(id: string, payload: AdminModelPricePayload) {
  const response = await http.patch<{ success: boolean; item: AdminModelPriceModel }>(
    `/api/admin/route-models/${encodeURIComponent(id)}`,
    payload
  );
  return response.data;
}

export async function setAdminRouteModelEnabled(id: string, enabled: boolean) {
  const response = await http.patch<{ success: boolean; id: string; enabled: boolean }>(
    `/api/admin/route-models/${encodeURIComponent(id)}/enabled`,
    { enabled }
  );
  return response.data;
}

export async function deleteAdminRouteModel(id: string) {
  const response = await http.delete<{ success: boolean; id: string }>(
    `/api/admin/route-models/${encodeURIComponent(id)}`
  );
  return response.data;
}
