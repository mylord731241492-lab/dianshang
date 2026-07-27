// 同源 HTTP 客户端：baseURL 为空字符串，只请求当前 origin。
// 自动携带主站 JWT（localStorage.auth_token），401 统一清理会话并跳登录。
// 禁止在本模块打印 token、图片 Base64、完整提示词或响应正文。

export const AUTH_TOKEN_KEY = "auth_token";
export const AUTH_USER_KEY = "auth_user";
export const DEFAULT_TIMEOUT_MS = 120_000;

export type StorageLike = {
    getItem: (key: string) => string | null;
    removeItem: (key: string) => void;
};

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type NavigateLike = (url: string) => void;

export class ApiError extends Error {
    readonly status: number;
    readonly code: string | undefined;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
    }
}

export type HttpClientConfig = {
    storage: StorageLike;
    navigate: NavigateLike;
    currentPath: () => string;
    onSessionCleared?: () => void;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
};

export type RequestOptions = {
    method?: string;
    body?: unknown;
};

export function loginRedirectUrl(currentPath: string): string {
    return `/login?redirect=${encodeURIComponent(currentPath)}`;
}

export function clearSessionAndRedirect(
    config: Pick<HttpClientConfig, "storage" | "navigate" | "currentPath" | "onSessionCleared">,
): void {
    config.storage.removeItem(AUTH_TOKEN_KEY);
    config.storage.removeItem(AUTH_USER_KEY);
    config.onSessionCleared?.();
    config.navigate(loginRedirectUrl(config.currentPath()));
}

async function toApiError(response: Response): Promise<ApiError> {
    let payload: { message?: unknown; code?: unknown } | null = null;
    try {
        payload = (await response.json()) as { message?: unknown; code?: unknown };
    } catch {
        payload = null;
    }
    const message =
        typeof payload?.message === "string" && payload.message ? payload.message : `请求失败（HTTP ${response.status}）`;
    const code = typeof payload?.code === "string" && payload.code ? payload.code : undefined;
    return new ApiError(response.status, message, code);
}

export function createHttpClient(config: HttpClientConfig) {
    const fetchImpl: FetchLike = config.fetchImpl ?? ((input, init) => fetch(input, init));
    const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
        if (!path.startsWith("/") || path.startsWith("//")) {
            throw new Error(`只允许同源相对路径请求：${path}`);
        }
        const token = config.storage.getItem(AUTH_TOKEN_KEY);
        const headers: Record<string, string> = { Accept: "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (options.body !== undefined) headers["Content-Type"] = "application/json";

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response;
        try {
            response = await fetchImpl(path, {
                method: options.method ?? "GET",
                headers,
                body: options.body === undefined ? undefined : JSON.stringify(options.body),
                signal: controller.signal,
            });
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                throw new ApiError(0, "请求超时，请稍后重试");
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }

        if (response.status === 401) {
            const error = await toApiError(response);
            clearSessionAndRedirect(config);
            throw error;
        }
        if (!response.ok) throw await toApiError(response);
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
    }

    return {
        request,
        get: <T>(path: string): Promise<T> => request<T>(path),
        post: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: "POST", body }),
        put: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: "PUT", body }),
        delete: <T>(path: string): Promise<T> => request<T>(path, { method: "DELETE" }),
    };
}
