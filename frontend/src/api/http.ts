import axios from 'axios';

interface ApiErrorMessageOptions {
  unauthorized?: string;
  forbidden?: string;
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '',
  timeout: 180000
});

http.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function getApiErrorMessage(error: unknown, fallback: string, options: ApiErrorMessageOptions = {}) {
  const response = (error as { response?: { status?: number; data?: { message?: string; error?: string } } }).response;
  if (response?.status === 401) return options.unauthorized || '请先登录。';
  if (response?.status === 403) return options.forbidden || '当前账号无权限。';
  if (response?.data?.message) return response.data.message;
  if (response?.data?.error) return response.data.error;
  return error instanceof Error ? error.message : fallback;
}
