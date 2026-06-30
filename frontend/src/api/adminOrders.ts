import { http } from './http';

export interface AdminOrder {
  id: string;
  orderNo?: string;
  userId?: string;
  username?: string;
  email?: string;
  amount?: number;
  credits?: number;
  payMethod?: string;
  status?: string;
  createdAt?: string;
  paidAt?: string;
}

export interface AdminOrderListParams {
  page?: number;
  pageSize?: number;
}

export interface AdminOrderListResponse {
  success?: boolean;
  items: AdminOrder[];
  orders: AdminOrder[];
  list?: AdminOrder[];
  data?: AdminOrder[];
  total: number;
  page: number;
  pageSize: number;
}

interface RawAdminOrderListResponse {
  success?: boolean;
  items?: AdminOrder[];
  orders?: AdminOrder[];
  list?: AdminOrder[];
  data?: AdminOrder[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export async function getAdminOrders(params: AdminOrderListParams = {}): Promise<AdminOrderListResponse> {
  const response = await http.get<RawAdminOrderListResponse>('/api/admin/orders', { params });
  const data = response.data;
  const orders = data.items || data.list || data.data || data.orders || [];
  return {
    ...data,
    items: orders,
    orders,
    total: Number(data.total ?? orders.length),
    page: Number(data.page ?? params.page ?? 1),
    pageSize: Number(data.pageSize ?? params.pageSize ?? (orders.length || 10))
  };
}
