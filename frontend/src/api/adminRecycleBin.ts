import { http } from './http';
import type { AdminUser } from './adminUsers';

export interface AdminRecycleBinParams {
  page?: number;
  pageSize?: number;
}

export interface AdminRecycleBinResponse {
  success?: boolean;
  items: AdminUser[];
  users: AdminUser[];
  list?: AdminUser[];
  data?: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawAdminRecycleBinResponse {
  success?: boolean;
  items?: AdminUser[];
  users?: AdminUser[];
  list?: AdminUser[];
  data?: AdminUser[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export async function getAdminRecycleBin(
  params: AdminRecycleBinParams = {}
): Promise<AdminRecycleBinResponse> {
  const response = await http.get<RawAdminRecycleBinResponse>('/api/admin/recycle-bin/users', { params });
  const data = response.data;
  const users = data.items || data.users || data.list || data.data || [];
  return {
    ...data,
    items: users,
    users,
    total: Number(data.total ?? users.length),
    page: Number(data.page ?? params.page ?? 1),
    pageSize: Number(data.pageSize ?? params.pageSize ?? 20)
  };
}
