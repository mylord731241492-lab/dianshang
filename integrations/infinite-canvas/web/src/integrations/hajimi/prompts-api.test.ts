import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    PROMPT_LIBRARY_COPY_SYSTEM_PATH,
    PROMPT_LIBRARY_SYSTEM_PATH,
    PROMPT_LIBRARY_USER_PATH,
    buildPromptInsertReference,
    createPromptsApi,
    readCloudPrompt,
    readCloudPromptList,
} from "./prompts-api.ts";

// 记录调用的假客户端，断言提示词 API 的请求方法、路径与请求体。
type RecordedCall = { method: string; path: string; body?: unknown };

function createFakeClient(handler: (call: RecordedCall) => unknown) {
    const calls: RecordedCall[] = [];
    const invoke = async (method: string, path: string, body?: unknown) => {
        const call: RecordedCall = { method, path, body };
        calls.push(call);
        return handler(call);
    };
    const client = {
        get: <T>(path: string): Promise<T> => invoke("GET", path) as Promise<T>,
        post: <T>(path: string, body?: unknown): Promise<T> => invoke("POST", path, body) as Promise<T>,
        put: <T>(path: string, body?: unknown): Promise<T> => invoke("PUT", path, body) as Promise<T>,
        delete: <T>(path: string): Promise<T> => invoke("DELETE", path) as Promise<T>,
    };
    return { client, calls };
}

const sampleSystemPrompt = {
    id: "prompt_sys_1",
    scope: "system",
    title: "白底商品主图",
    content: "保持产品结构不变……",
    category: "电商主图",
    tags: ["白底", "产品"],
    isFavorite: false,
    version: 3,
    status: "published",
    sortOrder: 20,
    createdAt: "2026-07-27 08:00:00",
    updatedAt: "2026-07-27 09:00:00",
};

const sampleUserPrompt = {
    id: "prompt_usr_1",
    scope: "user",
    title: "我的私有提示词",
    content: "私有正文",
    category: "营销文案",
    tags: ["私有"],
    isFavorite: true,
    createdAt: "2026-07-27 08:00:00",
    updatedAt: "2026-07-27 09:00:00",
};

test("系统提示词只从 /api/prompts/system 获取，带 q/category/tag/cursor/limit", async () => {
    const { client, calls } = createFakeClient(() => ({ success: true, items: [sampleSystemPrompt], nextCursor: "cursor-2" }));
    const api = createPromptsApi(client);
    const page = await api.listSystem({ q: "白底", category: "电商主图", tag: "产品", cursor: "cursor-1", limit: 12 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "GET");
    const path = calls[0]!.path;
    assert.ok(path.startsWith(`${PROMPT_LIBRARY_SYSTEM_PATH}?`), `系统提示词列表路径异常：${path}`);
    assert.ok(!path.startsWith(PROMPT_LIBRARY_USER_PATH), "系统提示词不得走我的提示词接口");
    const search = new URLSearchParams(path.slice(PROMPT_LIBRARY_SYSTEM_PATH.length + 1));
    assert.equal(search.get("q"), "白底");
    assert.equal(search.get("category"), "电商主图");
    assert.equal(search.get("tag"), "产品");
    assert.equal(search.get("cursor"), "cursor-1");
    assert.equal(search.get("limit"), "12");
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]!.scope, "system");
    assert.equal(page.items[0]!.version, 3);
    assert.equal(page.items[0]!.status, "published");
    assert.equal(page.items[0]!.sortOrder, 20);
    assert.equal(page.nextCursor, "cursor-2");
});

test("我的提示词只从 /api/user/prompts 获取，favorite 序列化为 1，limit 收敛上限", async () => {
    const { client, calls } = createFakeClient(() => ({ success: true, items: [sampleUserPrompt], nextCursor: null }));
    const api = createPromptsApi(client);
    const page = await api.listUser({ q: "私有", favorite: true, limit: 9999 });
    const path = calls[0]!.path;
    assert.ok(path.startsWith(`${PROMPT_LIBRARY_USER_PATH}?`), `我的提示词列表路径异常：${path}`);
    assert.ok(!path.startsWith(PROMPT_LIBRARY_SYSTEM_PATH), "我的提示词不得走系统提示词接口");
    const search = new URLSearchParams(path.slice(PROMPT_LIBRARY_USER_PATH.length + 1));
    assert.equal(search.get("favorite"), "1");
    assert.equal(search.get("limit"), "100", "limit 必须收敛到契约上限 100");
    assert.equal(page.items[0]!.scope, "user");
    assert.equal(page.items[0]!.isFavorite, true);
    // favorite=false/缺省不得发送 favorite 参数（后端语义是只看收藏）
    await api.listUser({});
    const search2 = new URLSearchParams(calls[1]!.path.split("?")[1]);
    assert.equal(search2.get("favorite"), null);
});

test("创建/详情/编辑/删除走 /api/user/prompts*，方法路径请求体符合契约", async () => {
    const { client, calls } = createFakeClient((call) =>
        call.method === "DELETE" ? { success: true, deleted: true } : { success: true, item: sampleUserPrompt },
    );
    const api = createPromptsApi(client);

    await api.create({ title: "新提示词", content: "正文", category: "电商主图", tags: ["白底"], isFavorite: true });
    assert.deepEqual(calls[0], {
        method: "POST",
        path: PROMPT_LIBRARY_USER_PATH,
        body: { title: "新提示词", content: "正文", category: "电商主图", tags: ["白底"], isFavorite: true },
    });

    await api.get("prompt_usr_1");
    assert.deepEqual(calls[1], { method: "GET", path: `${PROMPT_LIBRARY_USER_PATH}/prompt_usr_1`, body: undefined });

    await api.update("prompt_usr_1", { isFavorite: false, tags: ["新"] });
    assert.deepEqual(calls[2], { method: "PUT", path: `${PROMPT_LIBRARY_USER_PATH}/prompt_usr_1`, body: { isFavorite: false, tags: ["新"] } });

    await api.remove("prompt_usr_1");
    assert.deepEqual(calls[3], { method: "DELETE", path: `${PROMPT_LIBRARY_USER_PATH}/prompt_usr_1`, body: undefined });
});

test("复制系统提示词走 copy-system，请求体只含 systemPromptId", async () => {
    const { client, calls } = createFakeClient(() => ({ success: true, item: { ...sampleUserPrompt, id: "prompt_copy_1" } }));
    const api = createPromptsApi(client);
    const copy = await api.copySystem("prompt_sys_1");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { method: "POST", path: PROMPT_LIBRARY_COPY_SYSTEM_PATH, body: { systemPromptId: "prompt_sys_1" } });
    assert.equal(copy.scope, "user", "副本必须归属我的提示词");
});

test("插入引用保存 scope + promptId + version + contentSnapshot", () => {
    const systemRef = buildPromptInsertReference(readCloudPrompt(sampleSystemPrompt)!);
    assert.deepEqual(systemRef, {
        scope: "system",
        promptId: "prompt_sys_1",
        version: 3,
        contentSnapshot: "保持产品结构不变……",
    });
    const userRef = buildPromptInsertReference(readCloudPrompt(sampleUserPrompt)!);
    assert.deepEqual(userRef, {
        scope: "user",
        promptId: "prompt_usr_1",
        contentSnapshot: "私有正文",
    });
});

test("实体解析兼容 { item } 包裹与顶层形态，异常载荷返回空", () => {
    const wrapped = readCloudPrompt({ success: true, item: sampleSystemPrompt });
    const flat = readCloudPrompt(sampleSystemPrompt);
    assert.equal(wrapped!.id, "prompt_sys_1");
    assert.equal(flat!.id, "prompt_sys_1");
    assert.equal(readCloudPrompt(null), null);
    assert.equal(readCloudPrompt({ success: true }), null);
    assert.deepEqual(readCloudPromptList(null), { items: [], nextCursor: null });
    assert.deepEqual(readCloudPromptList({ success: true }), { items: [], nextCursor: null });
});

test("契约层不触碰 localStorage/IndexedDB/localforage：提示词权威副本只在服务端", () => {
    const source = readFileSync(new URL("./prompts-api.ts", import.meta.url), "utf8");
    // 先剥离注释（文件头边界说明允许出现这些词），再断言代码本体不读写浏览器存储。
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.ok(!/localforage/i.test(code), "prompts-api 不得 import localforage");
    assert.ok(!/localStorage|indexedDB/i.test(code), "prompts-api 不得直接读写浏览器存储");
});
