import axios from 'axios';

interface ApiErrorMessageOptions {
  unauthorized?: string;
  forbidden?: string;
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',
  timeout: 180000
});

const clearExpiredSession = (message?: string) => {
  try {
    window.localStorage.removeItem('auth_token');
    window.localStorage.removeItem('auth_user');
    window.localStorage.removeItem('erdandan-auth-session');
    ['api-keys-by-provider', 'api_key', 'apiKey'].forEach((key) => window.localStorage.removeItem(key));
    window.dispatchEvent(new CustomEvent('auth-session-expired', {
      detail: { message: message || '登录已过期，请重新登录。' }
    }));
  } catch {
    // localStorage may be unavailable in restricted browser modes.
  }
};

http.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = (error as { response?: { status?: number; data?: { code?: string; message?: string } } }).response;
    const code = response?.data?.code;
    if (response?.status === 401 && (code === 'AUTH_INVALID' || code === 'AUTH_REQUIRED')) {
      clearExpiredSession(response.data?.message);
    }
    return Promise.reject(error);
  }
);

export function getApiErrorMessage(error: unknown, fallback: string, options: ApiErrorMessageOptions = {}) {
  const response = (error as { response?: { status?: number; data?: { message?: string; error?: string } } }).response;
  if (response?.status === 401) return options.unauthorized || '请先登录。';
  if (response?.status === 403) return options.forbidden || '当前账号无权限。';
  if (response?.data?.message) return response.data.message;
  if (response?.data?.error) return response.data.error;
  return error instanceof Error ? error.message : fallback;
}
