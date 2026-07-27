import assert from "node:assert/strict";
import test from "node:test";

import { bootstrapAuth, logout } from "./auth.ts";
import { ApiError, createHttpClient } from "./http.ts";

// 记录所有被访问键的内存 localStorage，用于断言绝不读取上游 Provider Key。
function createMemoryStorage(initial: Record<string, string> = {}) {
    const data = new Map<string, string>(Object.entries(initial));
    const accessedKeys: string[] = [];
    const storage = {
        getItem: (key: string): string | null => {
            accessedKeys.push(key);
            return data.has(key) ? data.get(key)! : null;
        },
        setItem: (key: string, value: string): void => {
            accessedKeys.push(key);
            data.set(key, value);
        },
        removeItem: (key: string): void => {
            accessedKeys.push(key);
            data.delete(key);
        },
    };
    return { storage, accessedKeys, data };
}

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

type FetchCall = { input: string; init?: RequestInit };

function createFakeFetch(handler: (call: FetchCall) => Response | Promise<Response>) {
    const calls: FetchCall[] = [];
    const fetchImpl = async (input: string, init?: RequestInit): Promise<Response> => {
        const call: FetchCall = { input, init };
        calls.push(call);
        return handler(call);
    };
    return { fetchImpl, calls };
}

function createNavigate() {
    const urls: string[] = [];
    return { navigate: (url: string) => void urls.push(url), urls };
}

test("请求只走当前 origin，并自动携带 Authorization: Bearer <token>", async () => {
    const { storage } = createMemoryStorage({ auth_token: "tok-abc" });
    const { navigate } = createNavigate();
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(200, { ok: true }));
    const client = createHttpClient({
        storage,
        navigate,
        currentPath: () => "/canvas",
        fetchImpl,
    });

    const result = await client.get<{ ok: boolean }>("/api/user/profile");

    assert.deepEqual(result, { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "/api/user/profile");
    assert.ok(!/^https?:\/\//i.test(calls[0].input), "不得请求外部 origin");
    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, "Bearer tok-abc");
});

test("无 token 时请求不携带 Authorization 头", async () => {
    const { storage } = createMemoryStorage();
    const { navigate } = createNavigate();
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(200, {}));
    const client = createHttpClient({
        storage,
        navigate,
        currentPath: () => "/canvas",
        fetchImpl,
    });

    await client.get("/api/user/profile");

    const headers = calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
});

test("401 响应清除 auth_token、auth_user 和候选用户内存态，并跳 /login?redirect=<当前路径>", async () => {
    const { storage, data } = createMemoryStorage({ auth_token: "expired", auth_user: "{\"name\":\"x\"}" });
    const { navigate, urls } = createNavigate();
    let cleared = 0;
    const { fetchImpl } = createFakeFetch(() =>
        jsonResponse(401, { success: false, code: "AUTH_INVALID", message: "Token 无效或已过期" }),
    );
    const client = createHttpClient({
        storage,
        navigate,
        currentPath: () => "/canvas/proj_1",
        onSessionCleared: () => {
            cleared += 1;
        },
        fetchImpl,
    });

    const error = await client.get("/api/user/profile").then(
        () => null,
        (err: unknown) => err,
    );

    assert.ok(error instanceof ApiError);
    assert.equal((error as ApiError).status, 401);
    assert.equal((error as ApiError).code, "AUTH_INVALID");
    assert.equal((error as ApiError).message, "Token 无效或已过期");
    assert.equal(data.has("auth_token"), false);
    assert.equal(data.has("auth_user"), false);
    assert.equal(cleared, 1);
    assert.deepEqual(urls, [`/login?redirect=${encodeURIComponent("/canvas/proj_1")}`]);
});

test("非 401 错误统一解析 { message, code }，不清理会话也不跳转", async () => {
    const { storage, data } = createMemoryStorage({ auth_token: "tok" });
    const { navigate, urls } = createNavigate();
    const { fetchImpl } = createFakeFetch(() =>
        jsonResponse(500, { success: false, code: "SERVER_ERROR", message: "服务器内部错误" }),
    );
    const client = createHttpClient({
        storage,
        navigate,
        currentPath: () => "/canvas",
        fetchImpl,
    });

    const error = await client.get("/api/user/profile").then(
        () => null,
        (err: unknown) => err,
    );

    assert.ok(error instanceof ApiError);
    assert.equal((error as ApiError).status, 500);
    assert.equal((error as ApiError).code, "SERVER_ERROR");
    assert.equal((error as ApiError).message, "服务器内部错误");
    assert.equal(data.get("auth_token"), "tok");
    assert.deepEqual(urls, []);
});

test("非 JSON 错误响应不抛解析异常，回退到通用 message", async () => {
    const { storage } = createMemoryStorage({ auth_token: "tok" });
    const { navigate } = createNavigate();
    const { fetchImpl } = createFakeFetch(() => new Response("Bad Gateway", { status: 502 }));
    const client = createHttpClient({
        storage,
        navigate,
        currentPath: () => "/canvas",
        fetchImpl,
    });

    const error = await client.get("/api/user/profile").then(
        () => null,
        (err: unknown) => err,
    );

    assert.ok(error instanceof ApiError);
    assert.equal((error as ApiError).status, 502);
    assert.ok((error as ApiError).message.length > 0);
    assert.notEqual((error as ApiError).message, "Bad Gateway");
});

test("bootstrapAuth：无 token 直接跳登录，不发起请求", async () => {
    const { storage } = createMemoryStorage();
    const { navigate, urls } = createNavigate();
    const { fetchImpl, calls } = createFakeFetch(() => jsonResponse(200, {}));

    const result = await bootstrapAuth({
        storage,
        navigate,
        currentPath: () => "/canvas",
        setUser: () => assert.fail("无 token 不得写入用户"),
        clearUser: () => {},
        fetchImpl,
    });

    assert.equal(result.status, "unauthenticated");
    assert.deepEqual(urls, [`/login?redirect=${encodeURIComponent("/canvas")}`]);
    assert.equal(calls.length, 0);
});

test("bootstrapAuth：有 token 拉取 /api/user/profile 并写入候选用户内存态", async () => {
    const { storage } = createMemoryStorage({ auth_token: "tok-abc" });
    const { navigate, urls } = createNavigate();
    const { fetchImpl, calls } = createFakeFetch(() =>
        jsonResponse(200, {
            user: { id: "user_1", username: "alice", balance: 42, avatarUrl: "https://cdn.example.com/a.png" },
        }),
    );
    let saved: unknown = null;

    const result = await bootstrapAuth({
        storage,
        navigate,
        currentPath: () => "/canvas",
        setUser: (user) => {
            saved = user;
        },
        clearUser: () => {},
        fetchImpl,
    });

    assert.equal(result.status, "authenticated");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, "/api/user/profile");
    assert.deepEqual(saved, {
        id: "user_1",
        username: "alice",
        displayName: "alice",
        avatarUrl: "https://cdn.example.com/a.png",
        balance: 42,
    });
    assert.deepEqual(result.user, saved);
    assert.deepEqual(urls, []);
});

test("bootstrapAuth：兼容 avatar_url 与 credits 字段", async () => {
    const { storage } = createMemoryStorage({ auth_token: "tok" });
    const { navigate } = createNavigate();
    const { fetchImpl } = createFakeFetch(() =>
        jsonResponse(200, { user: { id: "user_2", username: "bob", credits: 7, avatar_url: "/static/b.png" } }),
    );
    let saved: unknown = null;

    const result = await bootstrapAuth({
        storage,
        navigate,
        currentPath: () => "/canvas",
        setUser: (user) => {
            saved = user;
        },
        clearUser: () => {},
        fetchImpl,
    });

    assert.equal(result.status, "authenticated");
    assert.deepEqual(saved, {
        id: "user_2",
        username: "bob",
        displayName: "bob",
        avatarUrl: "/static/b.png",
        balance: 7,
    });
});

test("bootstrapAuth：401 清理并跳登录，返回 unauthenticated", async () => {
    const { storage, data } = createMemoryStorage({ auth_token: "expired", auth_user: "{}" });
    const { navigate, urls } = createNavigate();
    let cleared = 0;
    const { fetchImpl } = createFakeFetch(() =>
        jsonResponse(401, { success: false, code: "AUTH_REQUIRED", message: "缺少登录 token" }),
    );

    const result = await bootstrapAuth({
        storage,
        navigate,
        currentPath: () => "/canvas",
        setUser: () => assert.fail("401 不得写入用户"),
        clearUser: () => {
            cleared += 1;
        },
        fetchImpl,
    });

    assert.equal(result.status, "unauthenticated");
    assert.equal(data.has("auth_token"), false);
    assert.equal(data.has("auth_user"), false);
    assert.equal(cleared, 1);
    assert.deepEqual(urls, [`/login?redirect=${encodeURIComponent("/canvas")}`]);
});

test("bootstrapAuth：非 401 错误返回可重试错误，不清理会话、不假装未登录", async () => {
    const { storage, data } = createMemoryStorage({ auth_token: "tok" });
    const { navigate, urls } = createNavigate();
    const { fetchImpl } = createFakeFetch(() =>
        jsonResponse(500, { success: false, code: "SERVER_ERROR", message: "服务器内部错误" }),
    );

    const result = await bootstrapAuth({
        storage,
        navigate,
        currentPath: () => "/canvas",
        setUser: () => {},
        clearUser: () => {},
        fetchImpl,
    });

    assert.equal(result.status, "error");
    assert.equal(result.status === "error" ? result.message : "", "服务器内部错误");
    assert.equal(data.get("auth_token"), "tok");
    assert.deepEqual(urls, []);
});

test("logout：清除主站 token 与用户内存态并跳 /login", () => {
    const { storage, data } = createMemoryStorage({ auth_token: "tok", auth_user: "{}" });
    const { navigate, urls } = createNavigate();
    let cleared = 0;

    logout({
        storage,
        navigate,
        clearUser: () => {
            cleared += 1;
        },
    });

    assert.equal(data.has("auth_token"), false);
    assert.equal(data.has("auth_user"), false);
    assert.equal(cleared, 1);
    assert.deepEqual(urls, ["/login"]);
});

test("绝不读取 api_key、apiKey 或任何上游 Provider Key 存储键", async () => {
    const forbidden = ["api_key", "apiKey", "api-keys-by-provider"];
    const { storage, accessedKeys } = createMemoryStorage({ auth_token: "tok" });
    const { navigate } = createNavigate();
    const { fetchImpl } = createFakeFetch(() =>
        jsonResponse(200, { user: { id: "user_1", username: "alice", balance: 1, avatarUrl: "" } }),
    );

    await bootstrapAuth({
        storage,
        navigate,
        currentPath: () => "/canvas",
        setUser: () => {},
        clearUser: () => {},
        fetchImpl,
    });

    for (const key of forbidden) {
        assert.ok(!accessedKeys.includes(key), `不得访问存储键 ${key}`);
    }
});
