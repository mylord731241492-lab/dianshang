// 认证引导：加载 /canvas* 时的主站会话接入。
// 无 token 跳登录；有 token 拉取 /api/user/profile 写入候选用户内存态；
// 401 清理并跳登录；其他错误返回可重试错误（不假装未登录）。

import {
    ApiError,
    AUTH_TOKEN_KEY,
    AUTH_USER_KEY,
    createHttpClient,
    loginRedirectUrl,
    type FetchLike,
    type NavigateLike,
    type StorageLike,
} from "./http.ts";

export type CanvasUser = {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    balance: number;
};

export type AuthBootstrapDeps = {
    storage: StorageLike;
    navigate: NavigateLike;
    currentPath: () => string;
    setUser: (user: CanvasUser) => void;
    clearUser: () => void;
    fetchImpl?: FetchLike;
};

export type AuthBootstrapResult =
    | { status: "authenticated"; user: CanvasUser }
    | { status: "unauthenticated" }
    | { status: "error"; message: string };

type ProfilePayload = {
    user?: {
        id?: unknown;
        username?: unknown;
        balance?: unknown;
        credits?: unknown;
        avatarUrl?: unknown;
        avatar_url?: unknown;
    };
};

export function mapProfileToUser(payload: ProfilePayload): CanvasUser {
    const raw = payload.user;
    if (!raw || typeof raw.id !== "string" || !raw.id) {
        throw new ApiError(500, "用户信息格式异常");
    }
    const username = typeof raw.username === "string" ? raw.username : "";
    const avatarUrl =
        typeof raw.avatarUrl === "string" ? raw.avatarUrl : typeof raw.avatar_url === "string" ? raw.avatar_url : "";
    const balanceValue =
        typeof raw.balance === "number"
            ? raw.balance
            : typeof raw.credits === "number"
              ? raw.credits
              : Number(raw.balance ?? 0);
    return {
        id: raw.id,
        username,
        displayName: username,
        avatarUrl,
        balance: Number.isFinite(balanceValue) ? balanceValue : 0,
    };
}

export async function bootstrapAuth(deps: AuthBootstrapDeps): Promise<AuthBootstrapResult> {
    const token = deps.storage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
        deps.navigate(loginRedirectUrl(deps.currentPath()));
        return { status: "unauthenticated" };
    }
    const client = createHttpClient({
        storage: deps.storage,
        navigate: deps.navigate,
        currentPath: deps.currentPath,
        onSessionCleared: deps.clearUser,
        fetchImpl: deps.fetchImpl,
    });
    try {
        const payload = await client.get<ProfilePayload>("/api/user/profile");
        const user = mapProfileToUser(payload);
        deps.setUser(user);
        return { status: "authenticated", user };
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            // HTTP 客户端已完成清理与跳登录。
            return { status: "unauthenticated" };
        }
        const message = error instanceof Error ? error.message : "加载用户信息失败";
        return { status: "error", message };
    }
}

export function logout(deps: Pick<AuthBootstrapDeps, "storage" | "navigate" | "clearUser">): void {
    deps.storage.removeItem(AUTH_TOKEN_KEY);
    deps.storage.removeItem(AUTH_USER_KEY);
    deps.clearUser();
    deps.navigate("/login");
}
