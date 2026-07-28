import { http } from './http';

export type AdminSystemPromptStatus = 'draft' | 'published' | 'disabled';

export interface AdminSystemPrompt {
  id: string;
  scope: 'system';
  title: string;
  content: string;
  category: string;
  tags: string[];
  isFavorite: boolean;
  version: number;
  status: AdminSystemPromptStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSystemPromptListParams {
  q?: string;
  status?: AdminSystemPromptStatus | '';
  category?: string;
  cursor?: string;
  limit?: number;
}

export interface AdminSystemPromptListResponse {
  success: boolean;
  items: AdminSystemPrompt[];
  nextCursor: string | null;
}

export interface AdminSystemPromptPayload {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  status?: AdminSystemPromptStatus;
  sortOrder?: number;
}

interface RawAdminSystemPromptListResponse {
  success?: boolean;
  items?: AdminSystemPrompt[];
  nextCursor?: string | null;
}

// 列表为 cursor 分页（与后端契约一致），不支持跳页。
export async function getAdminSystemPrompts(
  params: AdminSystemPromptListParams = {}
): Promise<AdminSystemPromptListResponse> {
  const query: Record<string, string | number> = {};
  if (params.q && params.q.trim()) query.q = params.q.trim();
  if (params.status) query.status = params.status;
  if (params.category && params.category.trim()) query.category = params.category.trim();
  if (params.cursor) query.cursor = params.cursor;
  query.limit = Math.max(1, Math.min(Number(params.limit) || 10, 100));
  const response = await http.get<RawAdminSystemPromptListResponse>('/api/admin/system-prompts', { params: query });
  const data = response.data;
  return {
    success: data.success !== false,
    items: Array.isArray(data.items) ? data.items : [],
    nextCursor: typeof data.nextCursor === 'string' && data.nextCursor ? data.nextCursor : null
  };
}

export async function createAdminSystemPrompt(payload: AdminSystemPromptPayload): Promise<AdminSystemPrompt> {
  const response = await http.post<{ success?: boolean; item: AdminSystemPrompt }>('/api/admin/system-prompts', payload);
  return response.data.item;
}

export async function updateAdminSystemPrompt(id: string, payload: Partial<AdminSystemPromptPayload>): Promise<AdminSystemPrompt> {
  const response = await http.put<{ success?: boolean; item: AdminSystemPrompt }>(`/api/admin/system-prompts/${encodeURIComponent(id)}`, payload);
  return response.data.item;
}

export async function deleteAdminSystemPrompt(id: string): Promise<{ success?: boolean }> {
  const response = await http.delete<{ success?: boolean }>(`/api/admin/system-prompts/${encodeURIComponent(id)}`);
  return response.data;
}
