import assert from "node:assert/strict";
import test from "node:test";

import { createHttpClient, type FetchLike } from "./http.ts";
import { createModelsApi, readCostEstimate, readRouteModels, readUserRoutes } from "./models-api.ts";

// 假 fetch：模型、价格与能力只允许来自后端 /api/user/routes、/api/user/models、/api/generation/estimate-cost，
// 绝不读取上游本地 Provider 配置（Base URL/API Key）。
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
        return {
            status,
            ok: status >= 200 && status < 300,
            headers: { get: () => null },
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

const sampleRoute = {
    id: "pub_route_openai_gpt_image_2",
    routeId: "pub_route_openai_gpt_image_2",
    routeKey: "openai_gpt_image_2",
    displayName: "GPT Image 线路",
    group: "image",
    enabled: true,
    status: "active",
    isDefault: true,
    defaultModelKey: "gpt-image-2",
};

const sampleModel = {
    id: "pub_route_openai_gpt_image_2:gpt-image-2",
    modelKey: "gpt-image-2",
    displayName: "GPT Image 2",
    realName: "gpt-image-2",
    routeId: "pub_route_openai_gpt_image_2",
    pricePoints: 15,
    enabled: true,
};

test("线路只从 GET /api/user/routes 读取", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({ body: { success: true, items: [sampleRoute], data: [sampleRoute] } }));
    const api = createModelsApi(createTestClient(fetchImpl));
    const routes = await api.listRoutes();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "GET");
    assert.ok(calls[0]!.url.startsWith("/api/user/routes"), `线路请求路径异常：${calls[0]!.url}`);
    assert.ok(!/^https?:\/\//i.test(calls[0]!.url), "不得请求外部地址");
    const search = new URLSearchParams(calls[0]!.url.split("?")[1]);
    assert.equal(search.get("group"), "image");
    assert.equal(routes.length, 1);
    assert.equal(routes[0]!.id, "pub_route_openai_gpt_image_2");
    assert.equal(routes[0]!.displayName, "GPT Image 线路");
    assert.equal(routes[0]!.defaultModelKey, "gpt-image-2");
    assert.equal(routes[0]!.enabled, true);
});

test("模型只从 GET /api/user/models?routeId= 读取", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({ body: { success: true, items: [sampleModel], data: [sampleModel] } }));
    const api = createModelsApi(createTestClient(fetchImpl));
    const models = await api.listModels("pub_route_openai_gpt_image_2");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "GET");
    assert.ok(calls[0]!.url.startsWith("/api/user/models?"), `模型请求路径异常：${calls[0]!.url}`);
    const search = new URLSearchParams(calls[0]!.url.split("?")[1]);
    assert.equal(search.get("routeId"), "pub_route_openai_gpt_image_2");
    assert.equal(models.length, 1);
    assert.equal(models[0]!.modelKey, "gpt-image-2");
    assert.equal(models[0]!.displayName, "GPT Image 2");
    assert.equal(models[0]!.pricePoints, 15);
});

test("估费只从 POST /api/generation/estimate-cost 读取（不是 GET）", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({ body: { success: true, estimatedCost: 15, totalCost: 30, available: 100 } }));
    const api = createModelsApi(createTestClient(fetchImpl));
    const estimate = await api.estimateCost({ modelKey: "gpt-image-2", routeId: "pub_route_openai_gpt_image_2", imageCount: 2 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "POST", "estimate-cost 必须是 POST");
    assert.equal(calls[0]!.url, "/api/generation/estimate-cost");
    const body = calls[0]!.body as Record<string, unknown>;
    assert.equal(body.modelKey, "gpt-image-2");
    assert.equal(body.routeId, "pub_route_openai_gpt_image_2");
    assert.equal(body.imageCount, 2);
    assert.equal(estimate.estimatedCost, 15);
    assert.equal(estimate.totalCost, 30);
    assert.equal(estimate.available, 100);
});

test("响应解析容错与空数据", () => {
    assert.deepEqual(readUserRoutes(null), []);
    assert.deepEqual(readUserRoutes({ success: true }), []);
    assert.deepEqual(readRouteModels(null), []);
    const estimate = readCostEstimate({ estimatedCost: 15, totalCost: 15 });
    assert.equal(estimate.estimatedCost, 15);
    assert.equal(estimate.totalCost, 15);
    assert.equal(estimate.available, 0);
});
