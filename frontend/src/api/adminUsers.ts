import { http } from './http';

export interface AdminUser {
  id: string;
  username?: string;
  email?: string;
  role?: string;
  status?: string;
  balance?: number;
  credits?: number;
  avatarUrl?: string;
  createdAt?: string;
  created_at?: string;
  lastLoginAt?: string;
  last_login_at?: string;
}

export interface AdminUserListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

export interface AdminUserListResponse {
  success?: boolean;
  items: AdminUser[];
  users: AdminUser[];
  list?: AdminUser[];
  data?: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawAdminUserListResponse {
  success?: boolean;
  items?: AdminUser[];
  users?: AdminUser[];
  list?: AdminUser[];
  data?: AdminUser[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export async function getAdminUsers(params: AdminUserListParams = {}): Promise<AdminUserListResponse> {
  const response = await http.get<RawAdminUserListResponse>('/api/admin/users', { params });
  const data = response.data;
  const users = data.users || data.items || data.list || data.data || [];
  return {
    ...data,
    items: users,
    users,
    total: Number(data.total ?? users.length),
    page: Number(data.page ?? params.page ?? 1),
    pageSize: Number(data.pageSize ?? params.pageSize ?? (users.length || 10))
  };
}
