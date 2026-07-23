import { http } from './http';

export interface AdminDashboardSummary {
  totalUsers?: number;
  userTotal?: number;
  totalGenerations?: number;
  generationTotal?: number;
  totalCredits?: number;
  totalConsumedPoints?: number;
  totalCost?: number;
  activeUsers?: number;
  routeCount?: number;
  modelCount?: number;
  todayNewUsers?: number;
  todayGenerations?: number;
  todayOrderAmount?: number;
  apiFailures?: number;
}

export interface AdminUsageItem {
  modelKey?: string;
  modelName?: string;
  model?: string;
  usageCount?: number;
  totalCount?: number;
  totalCredits?: number;
  points?: number;
  percent?: number;
}

export interface AdminRouteUsageItem {
  routeId?: string;
  routeKey?: string;
  routeName?: string;
  totalCredits?: number;
  totalCount?: number;
  successCount?: number;
  failCount?: number;
}

export interface AdminRankingUser {
  rank?: number;
  username?: string;
  email?: string;
  consumedPoints?: number;
  totalCredits?: number;
  usageCount?: number;
  count?: number;
  lastUseAt?: string;
}

export interface AdminRecentTask {
  id?: string;
  prompt?: string;
  model?: string;
  modelKey?: string;
  status?: string;
  cost?: number;
  createdAt?: string;
  created_at?: string;
}

export interface AdminDashboardResponse {
  success?: boolean;
  summary?: AdminDashboardSummary;
  stats?: AdminDashboardSummary;
  recentTasks?: AdminRecentTask[];
  modelUsage?: {
    totalCredits?: number;
    totalCount?: number;
    list?: AdminUsageItem[];
  };
  routeUsage?: {
    available?: boolean;
    reason?: string;
    totalCredits?: number;
    totalCount?: number;
    list?: AdminRouteUsageItem[];
  };
  ranking?: {
    list?: AdminRankingUser[];
  };
  dataQuality?: {
    ordersAvailable?: boolean;
    routeUsageAvailable?: boolean;
    message?: string;
  };
}

export async function getAdminDashboard() {
  const response = await http.get<AdminDashboardResponse>('/api/admin/dashboard');
  return response.data;
}

export async function getAdminCreditRanking() {
  const response = await http.get<{ items?: AdminRankingUser[]; list?: AdminRankingUser[]; ranking?: { list?: AdminRankingUser[] } }>(
    '/api/admin/dashboard/user-credit-ranking'
  );
  const data = response.data;
  return data.items || data.list || data.ranking?.list || [];
}
