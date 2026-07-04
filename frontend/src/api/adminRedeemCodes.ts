import { http } from './http';

export interface AdminRedeemCode {
  code: string;
  amount?: number;
  points?: number;
  max_uses?: number;
  maxUses?: number;
  totalCount?: number;
  perUserLimit?: number;
  used_count?: number;
  usedCount?: number;
  remainingCount?: number;
  enabled?: boolean;
  status?: string;
  expiresAt?: string;
}

export interface AdminRedeemCodeListParams {
  page?: number;
  pageSize?: number;
}

export interface AdminRedeemCodeCreatePayload {
  code?: string;
  amount?: number;
  points?: number;
  maxUses?: number;
  max_uses?: number;
  totalCount?: number;
  enabled?: boolean;
  status?: string;
}

export interface AdminRedeemCodeListResponse {
  success?: boolean;
  items: AdminRedeemCode[];
  codes: AdminRedeemCode[];
  list?: AdminRedeemCode[];
  data?: AdminRedeemCode[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawAdminRedeemCodeListResponse {
  success?: boolean;
  items?: AdminRedeemCode[];
  codes?: AdminRedeemCode[];
  list?: AdminRedeemCode[];
  data?: AdminRedeemCode[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export async function getAdminRedeemCodes(
  params: AdminRedeemCodeListParams = {}
): Promise<AdminRedeemCodeListResponse> {
  const response = await http.get<RawAdminRedeemCodeListResponse>('/api/admin/redeem-codes', { params });
  const data = response.data;
  const codes = data.items || data.list || data.data || data.codes || [];
  return {
    ...data,
    items: codes,
    codes,
    total: Number(data.total ?? codes.length),
    page: Number(data.page ?? params.page ?? 1),
    pageSize: Number(data.pageSize ?? params.pageSize ?? (codes.length || 10))
  };
}

export async function createAdminRedeemCode(payload: AdminRedeemCodeCreatePayload): Promise<AdminRedeemCode> {
  const response = await http.post<AdminRedeemCode & { success?: boolean }>('/api/admin/redeem-codes', payload);
  return response.data;
}

export async function deleteAdminRedeemCode(code: string): Promise<{ success?: boolean }> {
  const response = await http.delete<{ success?: boolean }>(`/api/admin/redeem-codes/${encodeURIComponent(code)}`);
  return response.data;
}
