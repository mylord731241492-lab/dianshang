import { http } from './http';

export interface GenerationItem {
  id: string;
  url?: string;
  imageUrl?: string;
  resultUrl?: string;
  result_url?: string;
  prompt?: string;
  label?: string;
  model?: string;
  modelKey?: string;
  cost?: number;
  status?: string;
  createdAt?: string;
  created_at?: string;
  size?: string;
  quality?: string;
}

export async function getGenerationHistory() {
  const response = await http.get<{ items?: GenerationItem[]; data?: GenerationItem[] }>('/api/user/generations');
  return response.data.items || response.data.data || [];
}

export async function deleteGeneration(id: string) {
  const response = await http.delete<{ success: boolean; deleted?: boolean; deletedCount?: number }>(`/api/user/generations/${id}`);
  return response.data;
}
