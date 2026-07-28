import assert from "node:assert/strict";
import test from "node:test";

import { createHttpClient, type FetchLike } from "./http.ts";
import { IMAGE_TOOL_MASK_CONTRACT, createImageToolsApi } from "./image-tools-api.ts";

// 假 fetch：记录每次调用的 URL/方法/请求体，handler 决定响应。
// 断言所有请求只指向同源 /api/*，绝不接触上游 Provider 地址。
type RecordedCall = { url: string; method: string; body?: unknown };
type FakeResponse = { status?: number; body?: unknown; headers?: Record<string, string> };

function createFakeFetch(handler: (call: RecordedCall) => FakeResponse) {
    const calls: RecordedCall[] = [];
    const fetchImpl: FetchLike = async (input, init) => {
        const call: RecordedCall = {
            url: input,
            method: init?.method ?? "GET",
            body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
        };
        calls.push(call);
        const result = handler(call);
        const status = result.status ?? 200;
        const headers = result.headers ?? {};
        return {
            status,
            ok: status >= 200 && status < 300,
            headers: { get: (name: string) => headers[name] ?? headers[name.toLowerCase()] ?? null },
            json: async () => result.body,
        } as unknown as Response;
    };
    return { fetchImpl, calls };
}

function createTestClient(fetchImpl: FetchLike) {
    return createHttpClient({
        storage: { getItem: () => "test-token", removeItem: () => {} },
        navigate: () => {},
        currentPath: () => "/canvas/proj_test",
        fetchImpl,
    });
}

function assertSameOriginApiUrls(calls: RecordedCall[]) {
    assert.ok(calls.length > 0, "应当至少产生一次请求");
    calls.forEach((call) => {
        assert.ok(call.url.startsWith("/api/"), `请求必须指向同源 /api/*，实际 ${call.url}`);
        assert.ok(!/^https?:\/\//i.test(call.url), `不得请求外部地址：${call.url}`);
    });
}

const ORIGINAL_IMAGE_URL = "/api/asset-content/asset_src?expires=1790000000&sig=source";
// 1x1 透明 PNG：模拟 buildEditMask 输出（涂抹区 alpha=0，未涂抹区白色不透明）。
const MASK_DATA_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const editSuccessPayload = {
    success: true,
    taskId: "inpaint_1",
    id: "inpaint_1",
    status: "success",
    mock: true,
    imageUrl: "/uploads/generated/edit-result.png",
    url: "/uploads/generated/edit-result.png",
    assetId: "asset_tool_1",
    accessUrl: "/api/asset-content/asset_tool_1?expires=1790000000&sig=deadbeef",
    accessUrlExpiresAt: "2026-07-28T04:00:00.000Z",
    images: [{ url: "/uploads/generated/edit-result.png", assetId: "asset_tool_1", accessUrl: "/api/asset-content/asset_tool_1?expires=1790000000&sig=deadbeef" }],
};

test("局部重绘：原图 + PNG mask + prompt 发送到 /api/image-tools/inpaint，结果带 assetId 与短时 accessUrl", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({ body: editSuccessPayload }));
    const api = createImageToolsApi(createTestClient(fetchImpl));
    const result = await api.inpaint({
        imageUrl: ORIGINAL_IMAGE_URL,
        maskDataUrl: MASK_DATA_URL,
        prompt: "把涂抹区域改成金属材质",
        width: 1024,
        height: 768,
    });
    assert.equal(calls.length, 1, "一次按钮操作只能产生一次请求");
    assert.equal(calls[0]!.url, "/api/image-tools/inpaint");
    assert.equal(calls[0]!.method, "POST");
    const body = calls[0]!.body as Record<string, unknown>;
    assert.equal(body.imageUrl, ORIGINAL_IMAGE_URL, "必须发送原图");
    assert.equal(typeof body.mask, "string", "必须发送 mask");
    assert.ok(String(body.mask).startsWith("data:image/png;base64,"), "mask 必须是 PNG data URL");
    assert.equal(body.prompt, "把涂抹区域改成金属材质");
    assert.equal(body.imageNaturalWidth, 1024);
    assert.equal(body.imageNaturalHeight, 768);
    assert.equal(result.operation, "inpaint");
    assert.equal(result.image.url, "/uploads/generated/edit-result.png");
    assert.equal(result.assetId, "asset_tool_1", "成功结果必须带云端资产 ID");
    assert.ok(result.accessUrl?.startsWith("/api/asset-content/"), "accessUrl 必须是同源短时签名路径");
    assertSameOriginApiUrls(calls);
});

test("mask 语义契约：涂抹区透明=重绘区，未涂抹区白色不透明=保留区，与后端提示词语义一致", async () => {
    assert.equal(IMAGE_TOOL_MASK_CONTRACT.format, "image/png");
    assert.equal(IMAGE_TOOL_MASK_CONTRACT.paintedRegion, "transparent", "涂抹区 alpha=0（透明）为需要重绘的区域");
    assert.equal(IMAGE_TOOL_MASK_CONTRACT.keptRegion, "opaque-white", "未涂抹区白色不透明的区域必须保持不变");

    const { fetchImpl, calls } = createFakeFetch(() => ({ body: editSuccessPayload }));
    const api = createImageToolsApi(createTestClient(fetchImpl));
    await assert.rejects(
        () => api.inpaint({ imageUrl: ORIGINAL_IMAGE_URL, maskDataUrl: "data:image/jpeg;base64,/9j/4AAQ", prompt: "x" }),
        /mask/i,
        "非 PNG mask 必须在提交前被拒绝",
    );
    assert.equal(calls.length, 0, "mask 校验失败不得发出请求");
});

test("智能擦除：原图 + mask 发送到 /api/image-tools/erase，一次操作一次请求", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({ body: { ...editSuccessPayload, taskId: "erase_1", operation: "erase" } }));
    const api = createImageToolsApi(createTestClient(fetchImpl));
    const result = await api.erase({ imageUrl: ORIGINAL_IMAGE_URL, maskDataUrl: MASK_DATA_URL });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/image-tools/erase");
    assert.equal(calls[0]!.method, "POST");
    const body = calls[0]!.body as Record<string, unknown>;
    assert.equal(body.imageUrl, ORIGINAL_IMAGE_URL);
    assert.ok(String(body.mask).startsWith("data:image/png;base64,"));
    assert.equal(result.operation, "erase");
    assert.equal(result.assetId, "asset_tool_1");
    assertSameOriginApiUrls(calls);
});

test("扩图：原图 + 目标比例 + 布局参数发送到 /api/image-tools/outpaint", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({ body: { ...editSuccessPayload, taskId: "outpaint_1", operation: "outpaint" } }));
    const api = createImageToolsApi(createTestClient(fetchImpl));
    const result = await api.outpaint({
        imageUrl: ORIGINAL_IMAGE_URL,
        prompt: "自然扩展背景",
        ratio: "16:9",
        anchor: "center",
        width: 800,
        height: 600,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/image-tools/outpaint");
    const body = calls[0]!.body as Record<string, unknown>;
    assert.equal(body.imageUrl, ORIGINAL_IMAGE_URL);
    assert.equal(body.ratio, "16:9", "必须发送目标比例");
    const layout = body.layout as Record<string, unknown>;
    assert.ok(layout && typeof layout === "object", "必须发送布局参数");
    assert.equal(layout.anchor, "center");
    assert.equal(result.operation, "outpaint");
    assert.equal(result.assetId, "asset_tool_1");
    assertSameOriginApiUrls(calls);
});

test("反推提示词：只调用 /api/image-tools/reverse-prompt，返回文本不落资产", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({
        body: { success: true, mock: true, prompt: "白底电商产品图，商品居中，柔和棚拍光线。", text: "白底电商产品图，商品居中，柔和棚拍光线。" },
    }));
    const api = createImageToolsApi(createTestClient(fetchImpl));
    const result = await api.reversePrompt({ imageUrl: ORIGINAL_IMAGE_URL });
    assert.equal(calls.length, 1, "一次按钮操作只能产生一次请求");
    assert.equal(calls[0]!.url, "/api/image-tools/reverse-prompt");
    const body = calls[0]!.body as Record<string, unknown>;
    assert.equal(body.imageUrl, ORIGINAL_IMAGE_URL);
    assert.ok(result.prompt.includes("白底电商产品图"));
    assertSameOriginApiUrls(calls);
});

test("AI 扩写：只调用 /api/canvas/enhance-prompt 回填文本，不触发任何生图请求", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({
        body: { success: true, mock: true, free: true, costPoints: 0, prompt: "扩写后的详细提示词", text: "扩写后的详细提示词" },
    }));
    const api = createImageToolsApi(createTestClient(fetchImpl));
    const result = await api.enhancePrompt({ prompt: "白底产品图" });
    assert.equal(calls.length, 1, "扩写只产生一次请求，不得触发生图");
    assert.equal(calls[0]!.url, "/api/canvas/enhance-prompt");
    const body = calls[0]!.body as Record<string, unknown>;
    assert.equal(body.currentPrompt, "白底产品图");
    assert.equal(result.prompt, "扩写后的详细提示词", "成功结果用于回填文本");
    assert.equal(result.free, true);
    assert.equal(result.costPoints, 0);
    assertSameOriginApiUrls(calls);
});

test("工具响应缺少结果图或资产 URL 为外链时抛错", async () => {
    const { fetchImpl: fetchNoImage, calls: noImageCalls } = createFakeFetch(() => ({ body: { success: true, mock: true } }));
    const apiNoImage = createImageToolsApi(createTestClient(fetchNoImage));
    await assert.rejects(() => apiNoImage.erase({ imageUrl: ORIGINAL_IMAGE_URL, maskDataUrl: MASK_DATA_URL }), /结果/);
    assert.equal(noImageCalls.length, 1);

    const { fetchImpl: fetchExternal } = createFakeFetch(() => ({
        body: { ...editSuccessPayload, accessUrl: "https://evil.example.com/asset.png" },
    }));
    const apiExternal = createImageToolsApi(createTestClient(fetchExternal));
    await assert.rejects(
        () => apiExternal.inpaint({ imageUrl: ORIGINAL_IMAGE_URL, maskDataUrl: MASK_DATA_URL, prompt: "x" }),
        /同源/,
        "accessUrl 必须拒绝外链",
    );
});
