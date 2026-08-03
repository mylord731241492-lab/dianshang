import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, createHttpClient, type FetchLike } from "./http.ts";
import {
    createClientRequestId,
    createGenerationApi,
    isTerminalTaskStatus,
    readGenerationTask,
    taskFailureKind,
    taskStageLabel,
} from "./generation-api.ts";

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

const successTaskPayload = {
    success: true,
    taskId: "task_1",
    id: "task_1",
    status: "success",
    stage: "done",
    progress: 100,
    prompt: "一只猫",
    modelKey: "gpt-image-2",
    images: [{ url: "/uploads/generated/a.png", assetId: "asset_1", accessUrl: "/api/asset-content/asset_1?expires=1790000000&sig=deadbeef" }],
    assetId: "asset_1",
    accessUrl: "/api/asset-content/asset_1?expires=1790000000&sig=deadbeef",
    billingStatus: "settled",
    reservedCost: 15,
    settledCost: 15,
    canCancel: false,
    request: {},
};

test("提交创建任务：同源 POST /api/generate/tasks，携带生成的 clientRequestId 幂等键", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({
        status: 202,
        body: { success: true, accepted: true, taskId: "task_1", id: "task_1", status: "pending", stage: "queued", queuePosition: 1, reservedCost: 30, billingStatus: "reserved", replayed: false, canCancel: true, request: {} },
    }));
    const api = createGenerationApi(createTestClient(fetchImpl));
    const clientRequestId = createClientRequestId();
    const task = await api.submit({
        prompt: "一只猫",
        modelKey: "gpt-image-2",
        routeId: "pub_route_openai_gpt_image_2",
        ratio: "1:1",
        quality: "2K",
        imageCount: 2,
        clientRequestId,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/generate/tasks");
    assert.equal(calls[0]!.method, "POST");
    const body = calls[0]!.body as Record<string, unknown>;
    assert.equal(body.prompt, "一只猫");
    assert.equal(body.modelKey, "gpt-image-2");
    assert.equal(body.routeId, "pub_route_openai_gpt_image_2");
    assert.equal(body.ratio, "1:1");
    assert.equal(body.quality, "2K");
    assert.equal(body.imageCount, 2);
    assert.equal(body.clientRequestId, clientRequestId, "幂等键必须随请求体提交");
    assert.match(clientRequestId, /^cr_/, "幂等键由前端生成并带 cr_ 前缀");
    assert.equal(task.taskId, "task_1");
    assert.equal(task.status, "pending");
    assert.equal(task.queuePosition, 1);
    assert.equal(task.replayed, false);
    assert.equal(task.canCancel, true);
    assertSameOriginApiUrls(calls);
});

test("浏览器 blob URL 不得跨边界提交给服务端", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({
        status: 202,
        body: { success: true, accepted: true, taskId: "task_blob", id: "task_blob", status: "pending", stage: "queued", queuePosition: 1, reservedCost: 15, billingStatus: "reserved", replayed: false, canCancel: true, request: {} },
    }));
    const api = createGenerationApi(createTestClient(fetchImpl));

    await assert.rejects(
        () =>
            api.submit({
                prompt: "参考图生图",
                modelKey: "gpt-image-2",
                imageCount: 1,
                clientRequestId: createClientRequestId(),
                referenceImages: [{ name: "reference.png", type: "image/png", url: "blob:http://127.0.0.1:3466/test-reference" }],
            }),
        (error) => error instanceof ApiError && error.code === "GENERATION_REFERENCE_BLOB_URL_UNSUPPORTED",
    );
    assert.equal(calls.length, 0, "blob URL 应在浏览器边界被拒绝，不得发送 HTTP 请求");
});

test("同一用户同一操作只提交一次：复用同一幂等键，重放返回原 taskId", async () => {
    let submitCount = 0;
    const { fetchImpl, calls } = createFakeFetch(() => {
        submitCount += 1;
        return {
            status: 202,
            body: { success: true, accepted: true, taskId: "task_1", id: "task_1", status: "pending", stage: "queued", queuePosition: 1, reservedCost: 15, billingStatus: "reserved", replayed: submitCount > 1, canCancel: true, request: {} },
        };
    });
    const api = createGenerationApi(createTestClient(fetchImpl));
    const clientRequestId = createClientRequestId();
    const input = { prompt: "一只猫", modelKey: "gpt-image-2", imageCount: 1, clientRequestId };
    const first = await api.submit(input);
    const second = await api.submit(input);
    assert.equal(calls.length, 2, "网络重试会重发请求，但必须携带同一幂等键");
    const keys = calls.map((call) => (call.body as Record<string, unknown>).clientRequestId);
    assert.deepEqual(keys, [clientRequestId, clientRequestId], "同一操作必须复用同一幂等键");
    assert.equal(first.taskId, "task_1");
    assert.equal(second.taskId, "task_1", "重放必须返回原任务，不创建第二个 Provider 任务");
    assert.equal(second.replayed, true);
    assertSameOriginApiUrls(calls);
});

test("202 后轮询到 success：waitForTask 退避轮询直至终态并解析 assetId + 短时 accessUrl", async () => {
    const pollBodies = [
        { taskId: "task_1", id: "task_1", status: "pending", stage: "queued", progress: 10, queuePosition: 1, billingStatus: "reserved", canCancel: true, request: {} },
        { taskId: "task_1", id: "task_1", status: "running", stage: "connecting", progress: 35, queuePosition: 0, billingStatus: "reserved", canCancel: true, request: {} },
        { taskId: "task_1", id: "task_1", status: "running", stage: "awaiting_provider", progress: 55, queuePosition: 0, billingStatus: "reserved", canCancel: true, request: {} },
        successTaskPayload,
    ];
    const { fetchImpl, calls } = createFakeFetch((call) => {
        if (call.method === "POST") {
            return { status: 202, body: { success: true, accepted: true, taskId: "task_1", id: "task_1", status: "pending", stage: "queued", queuePosition: 1, reservedCost: 15, billingStatus: "reserved", replayed: false, canCancel: true, request: {} } };
        }
        return { body: pollBodies.shift() ?? successTaskPayload };
    });
    const api = createGenerationApi(createTestClient(fetchImpl));
    const submitted = await api.submit({ prompt: "一只猫", modelKey: "gpt-image-2", imageCount: 1, clientRequestId: createClientRequestId() });
    const updates: string[] = [];
    const final = await api.waitForTask(submitted.taskId, {
        sleep: async () => {},
        onUpdate: (task) => updates.push(`${task.status}:${task.stage}`),
    });
    assert.equal(final.status, "success");
    assert.equal(final.assetId, "asset_1", "成功结果必须返回云端 assetId");
    assert.ok(final.images[0]!.accessUrl?.startsWith("/api/asset-content/"), "成功结果必须返回短时同源 accessUrl");
    assert.deepEqual(updates, ["pending:queued", "running:connecting", "running:awaiting_provider"]);
    const pollUrls = calls.filter((call) => call.method === "GET").map((call) => call.url);
    assert.ok(pollUrls.length >= 3, "必须多轮轮询");
    pollUrls.forEach((url) => assert.equal(url, "/api/generate/tasks/task_1"));
    assertSameOriginApiUrls(calls);
});

test("pending/running/failed/cancelled/partial 均有明确状态映射与阶段文案", () => {
    const pending = readGenerationTask({ taskId: "t", status: "pending", stage: "queued", request: {} });
    assert.equal(pending.status, "pending");
    assert.equal(isTerminalTaskStatus(pending.status), false);
    assert.equal(taskStageLabel(pending.stage), "排队中");

    const running = readGenerationTask({ taskId: "t", status: "running", stage: "awaiting_provider", request: {} });
    assert.equal(isTerminalTaskStatus(running.status), false);
    assert.equal(taskStageLabel(running.stage), "上游生成中");
    assert.equal(taskStageLabel("persisting"), "保存结果中");
    assert.equal(taskStageLabel("provider_degraded"), "线路冷却，等待重试");

    const failed = readGenerationTask({ taskId: "t", status: "failed", stage: "failed", errorCode: "PROVIDER_IMAGE_FAILED", errorMessage: "失败", billingStatus: "refunded", request: {} });
    assert.equal(isTerminalTaskStatus(failed.status), true);
    assert.equal(failed.errorCode, "PROVIDER_IMAGE_FAILED");

    const cancelled = readGenerationTask({ taskId: "t", status: "cancelled", stage: "cancelled", billingStatus: "refunded", request: {} });
    assert.equal(isTerminalTaskStatus(cancelled.status), true);

    const partial = readGenerationTask({ taskId: "t", status: "success", stage: "done", partial: true, warnings: ["部分图片生成失败"], billingStatus: "partially_settled", request: { partial: true, warnings: ["部分图片生成失败"] } });
    assert.equal(partial.status, "success");
    assert.equal(partial.partial, true, "局部成功必须有 partial 标记");
    assert.deepEqual(partial.warnings, ["部分图片生成失败"]);
    assert.equal(partial.billingStatus, "partially_settled");

    assert.throws(() => readGenerationTask(null), /格式/);
    assert.throws(() => readGenerationTask({ status: "success" }), /格式/);
});

test("429 限流解析 Retry-After", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({
        status: 429,
        headers: { "Retry-After": "7" },
        body: { success: false, code: "GENERATION_QUEUE_FULL", message: "图片生成队列已满，请稍后重试" },
    }));
    const api = createGenerationApi(createTestClient(fetchImpl));
    await assert.rejects(
        api.submit({ prompt: "一只猫", modelKey: "gpt-image-2", imageCount: 1, clientRequestId: createClientRequestId() }),
        (error: unknown) => {
            assert.ok(error instanceof ApiError);
            assert.equal(error.status, 429);
            assert.equal(error.code, "GENERATION_QUEUE_FULL");
            assert.equal(error.retryAfterSeconds, 7, "必须解析 Retry-After 响应头");
            return true;
        },
    );
    assertSameOriginApiUrls(calls);
});

test("失败区分本地已退款与上游计费未知", () => {
    const refunded = readGenerationTask({
        taskId: "t",
        status: "failed",
        billingStatus: "refunded",
        errorMessage: "上游 400",
        request: { providerBillingStatus: "not_charged" },
    });
    assert.equal(taskFailureKind(refunded), "refunded", "本地已退款应明确标识");

    const ambiguous = readGenerationTask({
        taskId: "t",
        status: "failed",
        billingStatus: "refunded",
        errorMessage: "保存结果失败",
        request: { providerBillingStatus: "unknown", upstreamBillingAmbiguous: true, billingAuditRequired: true },
    });
    assert.equal(taskFailureKind(ambiguous), "billing-unknown", "上游计费未知必须与已退款区分");
    assert.equal(ambiguous.providerBillingStatus, "unknown");
    assert.equal(ambiguous.upstreamBillingAmbiguous, true);

    const cancelledAmbiguous = readGenerationTask({
        taskId: "t",
        status: "cancelled",
        billingStatus: "refunded",
        request: { providerBillingStatus: "unknown", upstreamBillingAmbiguous: true },
    });
    assert.equal(taskFailureKind(cancelledAmbiguous), "billing-unknown");

    const ok = readGenerationTask(successTaskPayload);
    assert.equal(taskFailureKind(ok), "none");
});

test("取消只调用一次：并发与重复取消合并为一次请求", async () => {
    let cancelCalls = 0;
    const cancelledPayload = { success: true, taskId: "task_1", id: "task_1", status: "cancelled", stage: "cancelled", billingStatus: "refunded", canCancel: false, request: { providerBillingStatus: "not_charged" } };
    const { fetchImpl, calls } = createFakeFetch(() => {
        cancelCalls += 1;
        return { body: cancelledPayload };
    });
    const api = createGenerationApi(createTestClient(fetchImpl));
    const [first, second] = await Promise.all([api.cancel("task_1"), api.cancel("task_1")]);
    const third = await api.cancel("task_1");
    assert.equal(cancelCalls, 1, "同一任务的取消必须只调用一次");
    assert.equal(first.status, "cancelled");
    assert.equal(second.status, "cancelled");
    assert.equal(third.status, "cancelled");
    assert.equal(calls[0]!.url, "/api/generate/tasks/task_1/cancel");
    assert.equal(calls[0]!.method, "POST");
    assertSameOriginApiUrls(calls);
});

test("人工重试：POST /:id/retry 返回全新任务，不复用旧幂等键", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({
        status: 202,
        body: { success: true, accepted: true, taskId: "task_2", id: "task_2", retryOfTaskId: "task_1", status: "pending", stage: "queued", queuePosition: 1, reservedCost: 15, billingStatus: "reserved", replayed: false, canCancel: true, request: { retryOfTaskId: "task_1" } },
    }));
    const api = createGenerationApi(createTestClient(fetchImpl));
    const retried = await api.retry("task_1", { confirmUpstreamBillingRisk: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "/api/generate/tasks/task_1/retry");
    assert.equal(calls[0]!.method, "POST");
    assert.equal((calls[0]!.body as Record<string, unknown>).confirmUpstreamBillingRisk, true);
    assert.notEqual(retried.taskId, "task_1", "人工重试必须创建全新任务（服务端签发新幂等键）");
    assert.equal(retried.taskId, "task_2");
    assert.equal(retried.retryOfTaskId, "task_1");
    assertSameOriginApiUrls(calls);
});

test("waitForTask 尊重 AbortSignal：已中止信号直接拒绝且不再轮询", async () => {
    const { fetchImpl, calls } = createFakeFetch(() => ({ body: successTaskPayload }));
    const api = createGenerationApi(createTestClient(fetchImpl));
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(api.waitForTask("task_1", { signal: controller.signal, sleep: async () => {} }), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.equal(error.name, "AbortError");
        return true;
    });
    assert.equal(calls.length, 0, "信号已中止时不得发起任何轮询请求");
});
