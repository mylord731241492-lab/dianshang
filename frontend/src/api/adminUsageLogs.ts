import { http } from './http';

export interface AdminUsageLog {
  id: number | string;
  user_id?: string;
  userId?: string;
  username?: string;
  type?: string;
  change_amount?: number;
  changeAmount?: number;
  before_balance?: number;
  beforeBalance?: number;
  after_balance?: number;
  afterBalance?: number;
  remark?: string;
  created_at?: string;
  createdAt?: string;
}

export interface AdminUsageLogListParams {
  page?: number;
  pageSize?: number;
}

export interface AdminUsageLogListResponse {
  success?: boolean;
  items: AdminUsageLog[];
  logs: AdminUsageLog[];
  list?: AdminUsageLog[];
  data?: AdminUsageLog[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawAdminUsageLogListResponse {
  success?: boolean;
  items?: AdminUsageLog[];
  logs?: AdminUsageLog[];
  list?: AdminUsageLog[];
  data?: AdminUsageLog[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export async function getAdminUsageLogs(params: AdminUsageLogListParams = {}): Promise<AdminUsageLogListResponse> {
  const response = await http.get<RawAdminUsageLogListResponse>('/api/admin/usage-logs', { params });
  const data = response.data;
  const logs = data.items || data.list || data.data || data.logs || [];
  return {
    ...data,
    items: logs,
    logs,
    total: Number(data.total ?? logs.length),
    page: Number(data.page ?? params.page ?? 1),
    pageSize: Number(data.pageSize ?? params.pageSize ?? (logs.length || 10))
  };
}
