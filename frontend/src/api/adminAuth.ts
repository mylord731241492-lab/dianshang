import type { AuthResponse } from './auth';
import { http } from './http';

export async function adminLogin(username: string, password: string) {
  const response = await http.post<AuthResponse>('/api/admin/login', { username, password });
  return response.data;
}
