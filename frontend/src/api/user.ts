import { http } from './http';
import type { AuthUser } from './auth';

export interface BalanceLog {
  id?: string | number;
  type?: string;
  change_amount?: number;
  changeAmount?: number;
  before_balance?: number;
  after_balance?: number;
  remark?: string;
  created_at?: string;
  createdAt?: string;
}

export interface ApiStatus {
  success?: boolean;
  status?: string;
  mode?: string;
  mock?: boolean;
  provider?: {
    name?: string;
    displayName?: string;
    defaultImageModel?: string;
    supportsChat?: boolean;
    supportsImage?: boolean;
  };
}

export async function getUserProfile() {
  const response = await http.get<{ user: AuthUser }>('/api/user/profile');
  return response.data.user;
}

export async function getBalanceLogs() {
  const response = await http.get<{ items?: BalanceLog[]; data?: BalanceLog[] }>('/api/user/balance-logs');
  return response.data.items || response.data.data || [];
}

export async function getUserApiStatus() {
  const response = await http.get<ApiStatus>('/api/user/api-status');
  return response.data;
}

export async function redeemCode(code: string) {
  const response = await http.post<{ success: boolean; balance: number; amount: number }>('/api/user/redeem', { code });
  return response.data;
}
