import { http } from './http';

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  role?: string;
  balance?: number;
  credits?: number;
  avatarUrl?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export async function login(username: string, password: string) {
  const response = await http.post<AuthResponse>('/api/auth/login', { username, password });
  return response.data;
}

export async function sendRegisterCode(email: string) {
  const response = await http.post<{ ok?: boolean; code?: string; cooldown?: number }>('/api/auth/send-email-code', {
    email,
    type: 'register'
  });
  return response.data;
}

export async function register(payload: { username: string; email: string; password: string; code?: string }) {
  const response = await http.post<AuthResponse>('/api/auth/register', payload);
  return response.data;
}

export function saveAuthSession(data: AuthResponse) {
  window.localStorage.setItem('auth_token', data.token);
  window.localStorage.setItem('auth_user', JSON.stringify(data.user));
}

export function readAuthUser() {
  try {
    const raw = window.localStorage.getItem('auth_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  window.localStorage.removeItem('auth_token');
  window.localStorage.removeItem('auth_user');
}
