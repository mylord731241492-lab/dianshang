import type { AuthResponse, AuthUser } from './auth';
import { http } from './http';

const ADMIN_AUTH_TOKEN_KEY = 'admin_auth_token';
const ADMIN_AUTH_USER_KEY = 'admin_auth_user';
const LEGACY_AUTH_TOKEN_KEY = 'auth_token';
const LEGACY_AUTH_USER_KEY = 'auth_user';

export async function adminLogin(username: string, password: string) {
  const response = await http.post<AuthResponse>('/api/admin/login', { username, password });
  return response.data;
}

export function saveAdminAuthSession(data: AuthResponse) {
  window.localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, data.token);
  window.localStorage.setItem(ADMIN_AUTH_USER_KEY, JSON.stringify(data.user));
}

export function readAdminAuthUser() {
  try {
    const raw = window.localStorage.getItem(ADMIN_AUTH_USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function migrateLegacyAdminSession() {
  try {
    const existingAdminToken = window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);
    const existingAdminUser = readAdminAuthUser();
    if (existingAdminToken && existingAdminUser?.role === 'admin') return existingAdminUser;

    const legacyToken = window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
    const rawLegacyUser = window.localStorage.getItem(LEGACY_AUTH_USER_KEY);
    const legacyUser = rawLegacyUser ? (JSON.parse(rawLegacyUser) as AuthUser) : null;
    if (!legacyToken || legacyUser?.role !== 'admin') return null;

    window.localStorage.setItem(ADMIN_AUTH_TOKEN_KEY, legacyToken);
    window.localStorage.setItem(ADMIN_AUTH_USER_KEY, JSON.stringify(legacyUser));
    return legacyUser;
  } catch {
    return null;
  }
}

export function clearAdminAuthSession() {
  window.localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
  window.localStorage.removeItem(ADMIN_AUTH_USER_KEY);
}
