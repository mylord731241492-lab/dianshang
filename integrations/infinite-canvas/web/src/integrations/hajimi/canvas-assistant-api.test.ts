import assert from "node:assert/strict";
import test from "node:test";

import { createHttpClient, type FetchLike } from "./http.ts";
import { createCanvasAssistantStore, type CanvasAssistantMode } from "./canvas-assistant-api.ts";

// 画布助手三模式（对话 / 快速 / 电商套图）隔离契约测试：
// - 三个模式的状态容器互不共享：消息、草稿、参考图、sessionId、生成中状态、taskId。
// - 异步完成（轮询/回调）写回任务创建时的原模式，不写入当前可见模式。
// - 各模式请求指向正确后端端点；全部同源 /api/*，零真实调用。
// - 对话分析失败不继续生图；前端不预估、不扣余额（永不请求估费/余额接口）。
// 假 fetch：记录每次调用的 URL/方法/请求体，handler 决定响应。
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

function createTestStore(handler: (call: RecordedCall) => FakeResponse) {
    const { fetchImpl, calls } = createFakeFetch(handler);
    let sessionSeq = 0;
    let messageSeq = 0;
    const store = createCanvasAssistantStore({
        client: createTestClient(fetchImpl),
        sleep: () => Promise.resolve(),
        sessionIdFactory: () => `session_${++sessionSeq}`,
        messageIdFactory: () => `msg_${++messageSeq}`,
    });
    return { store, calls };
}

function assertSameOriginApiUrls(calls: RecordedCall[]) {
    assert.ok(calls.length > 0, "应当至少产生一次请求");
    calls.forEach((call) => {
        assert.ok(call.url.startsWith("/api/"), `请求必须指向同源 /api/*，实际 ${call.url}`);
        assert.ok(!/^https?:\/\//i.test(call.url), `不得请求外部地址：${call.url}`);
    });
}

const REF_IMAGE = { name: "ref.png", type: "image/png", dataUrl: "data:image/png;base64,cmVm" };
const PRODUCT_IMAGE = { name: "product.png", type: "image/png", dataUrl: "data:image/png;base64,cHJvZHVjdA==" };

const dialogSuccessPayload = {
    success: true,
    taskId: "dlg_task_1",
    id: "dlg_task_1",
    status: "success",
    progress: 100,
    analysisSummary: "建议突出产品卖点并使用浅色背景",
    finalPrompt: "浅色背景产品图",
    images: [{ url: "/uploads/generated/dlg.png", assetId: "asset_dlg", accessUrl: "/api/asset-content/asset_dlg?expires=1790000000&sig=dlg" }],
    resultImages: [{ url: "/uploads/generated/dlg.png", assetId: "asset_dlg", accessUrl: "/api/asset-content/asset_dlg?expires=1790000000&sig=dlg" }],
};

const ecommerceConfigPayload = {
    success: true,
    enabled: true,
    sectionMode: "dynamic",
    sections: [],
    skills: [{ id: "gloria", name: "Gloria", avatarUrl: "/assets/ecommerce-suite-skills/gloria-avatar.svg", description: "大厂王牌视觉设计师" }],
    defaultSkillId: "gloria",
    defaults: { brandName: "", platform: "拼多多", country: "中国", language: "中文", ratio: "1:1", quality: "1k", imageCount: 1 },
    textModel: "gpt-5.6-terra",
    imageModel: "gpt-image-2",
    analysisCost: 3,
    estimatedImageCostPerSection: 10,
};

const ecommercePromptsPayload = {
    success: true,
    promptPlans: [{ sectionKey: "hero-visual", sectionName: "主视觉", title: "主视觉海报", prompt: "浅色背景主视觉", negativePrompt: "" }],
    analysisCost: 3,
    remainingBalance: 97,
};

const ecommerceGeneratePayload = {
    success: true,
    taskId: "suite_task_1",
    id: "suite_task_1",
    status: "success",
    progress: 100,
    images: [{ url: "/uploads/generated/suite.png", assetId: "asset_suite", accessUrl: "/api/asset-content/asset_suite?expires=1790000000&sig=suite", sectionKey: "hero-visual", sectionName: "主视觉" }],
    resultImages: [{ url: "/uploads/generated/suite.png", assetId: "asset_suite", accessUrl: "/api/asset-content/asset_suite?expires=1790000000&sig=suite" }],
};

function quickTaskPayload(status: string) {
    return {
        taskId: "task_quick_1",
        id: "task_quick_1",
        status,
        stage: status === "success" ? "done" : "queued",
        progress: status === "success" ? 100 : 10,
        prompt: "快速生图提示词",
        modelKey: "gpt-image-2",
        billingStatus: status === "success" ? "settled" : "reserved",
        images: status === "success" ? [{ url: "/uploads/generated/quick.png", assetId: "asset_quick", accessUrl: "/api/asset-content/asset_quick?expires=1790000000&sig=quick" }] : [],
        resultImages: status === "success" ? [{ url: "/uploads/generated/quick.png", assetId: "asset_quick", accessUrl: "/api/asset-content/asset_quick?expires=1790000000&sig=quick" }] : [],
    };
}

const MODES: CanvasAssistantMode[] = ["dialog", "quick", "ecommerce-suite"];

test("三模式状态容器互不共享：消息、草稿、参考图、sessionId、生成中状态、taskId", async () => {
    const { store, calls } = createTestStore(() => ({ body: dialogSuccessPayload }));
    const initial = store.getSnapshot();

    // 三个模式各自持有独立容器，sessionId 互不相同。
    const sessionIds = MODES.map((mode) => initial.modes[mode].sessionId);
    assert.equal(new Set(sessionIds).size, 3, `三个模式的 sessionId 必须互不相同，实际 ${sessionIds.join(",")}`);
    MODES.forEach((mode) => {
        assert.equal(initial.modes[mode].messages.length, 0);
        assert.equal(initial.modes[mode].draft, "");
        assert.equal(initial.modes[mode].referenceImages.length, 0);
        assert.equal(initial.modes[mode].generating, false);
        assert.equal(initial.modes[mode].taskId, "");
    });

    // 草稿与参考图按模式独立写入。
    store.updateMode("dialog", { draft: "对话草稿", referenceImages: [REF_IMAGE] });
    store.updateMode("quick", { draft: "快速草稿", referenceImages: [{ ...REF_IMAGE, name: "quick-ref.png" }] });
    store.updateMode("ecommerce-suite", { draft: "套图需求", productImages: [PRODUCT_IMAGE] });
    let snapshot = store.getSnapshot();
    assert.equal(snapshot.modes.dialog.draft, "对话草稿");
    assert.equal(snapshot.modes.quick.draft, "快速草稿");
    assert.equal(snapshot.modes["ecommerce-suite"].draft, "套图需求");
    assert.equal(snapshot.modes.dialog.referenceImages[0]?.name, "ref.png");
    assert.equal(snapshot.modes.quick.referenceImages[0]?.name, "quick-ref.png");
    assert.equal(snapshot.modes["ecommerce-suite"].referenceImages.length, 0, "电商套图的产品图不得混入参考图");
    assert.equal(snapshot.modes["ecommerce-suite"].productImages.length, 1);
    assert.equal(snapshot.modes.dialog.productImages.length, 0, "对话模式不得出现电商产品图");

    // 对话模式跑一轮：消息、生成中状态、taskId 只写对话容器，其余两个模式保持初始。
    await store.sendDialogMessage();
    snapshot = store.getSnapshot();
    assert.equal(snapshot.modes.dialog.messages.filter((item) => item.role === "user").length, 1);
    assert.equal(snapshot.modes.dialog.messages.filter((item) => item.role === "assistant").length, 1);
    assert.equal(snapshot.modes.dialog.taskId, "dlg_task_1");
    assert.equal(snapshot.modes.dialog.generating, false);
    assert.equal(snapshot.modes.dialog.draft, "", "发送后对话草稿清空");
    assert.equal(snapshot.modes.quick.messages.length, 0, "quick 容器不得出现对话消息");
    assert.equal(snapshot.modes.quick.taskId, "", "quick 容器不得出现对话 taskId");
    assert.equal(snapshot.modes.quick.draft, "快速草稿", "quick 草稿不得被对话流程清空");
    assert.equal(snapshot.modes["ecommerce-suite"].messages.length, 0, "ecommerce 容器不得出现对话消息");
    assert.equal(snapshot.modes["ecommerce-suite"].taskId, "");
    assertSameOriginApiUrls(calls);
});

test("快速模式异步轮询完成写回原模式，不写入当前可见模式", async () => {
    let pollCount = 0;
    const { store, calls } = createTestStore((call) => {
        if (call.url === "/api/generate/tasks" && call.method === "POST") return { status: 202, body: quickTaskPayload("pending") };
        if (call.url.startsWith("/api/generate/tasks/")) {
            pollCount += 1;
            return { body: quickTaskPayload(pollCount >= 2 ? "success" : "running") };
        }
        throw new Error(`未预期请求：${call.method} ${call.url}`);
    });
    store.updateMode("quick", { draft: "快速生图提示词" });

    const pending = store.submitQuick({ modelKey: "gpt-image-2" });
    // 任务已创建但尚未轮询完成：此刻切走可见模式，模拟用户切到对话 Tab。
    store.setVisibleMode("dialog");
    await pending;

    const snapshot = store.getSnapshot();
    assert.equal(snapshot.visibleMode, "dialog", "可见模式保持为用户切换后的对话模式");
    // 结果写回任务创建时的 quick 容器。
    assert.equal(snapshot.modes.quick.taskId, "task_quick_1");
    assert.equal(snapshot.modes.quick.generating, false);
    const assistantMessages = snapshot.modes.quick.messages.filter((item) => item.role === "assistant");
    assert.equal(assistantMessages.length, 1, "quick 容器应收到生成完成消息");
    assert.equal(assistantMessages[0]?.images?.[0]?.assetId, "asset_quick");
    // 当前可见的 dialog 容器不得被写入任何任务状态。
    assert.equal(snapshot.modes.dialog.messages.length, 0, "dialog 容器不得出现 quick 任务消息");
    assert.equal(snapshot.modes.dialog.taskId, "", "dialog 容器不得出现 quick taskId");
    assert.equal(snapshot.modes.dialog.generating, false);
    assertSameOriginApiUrls(calls);
});

test("对话请求进行中切换可见模式，结果仍写回对话容器", async () => {
    const { store } = createTestStore((call) => {
        assert.equal(call.url, "/api/canvas/dialog-agent-generate");
        // 服务端响应到达前，用户已切到电商套图 Tab。
        store.setVisibleMode("ecommerce-suite");
        return { body: dialogSuccessPayload };
    });
    store.updateMode("dialog", { draft: "帮我分析这张图", referenceImages: [REF_IMAGE] });
    await store.sendDialogMessage();

    const snapshot = store.getSnapshot();
    assert.equal(snapshot.visibleMode, "ecommerce-suite");
    assert.equal(snapshot.modes.dialog.taskId, "dlg_task_1");
    assert.equal(snapshot.modes.dialog.messages.filter((item) => item.role === "assistant").length, 1);
    assert.equal(snapshot.modes.dialog.messages.find((item) => item.role === "assistant")?.text, "建议突出产品卖点并使用浅色背景");
    assert.equal(snapshot.modes["ecommerce-suite"].messages.length, 0, "电商套图容器不得出现对话结果");
    assert.equal(snapshot.modes["ecommerce-suite"].taskId, "");
    assert.equal(snapshot.modes.quick.messages.length, 0);
});

test("各模式请求指向正确后端端点", async () => {
    const { store, calls } = createTestStore((call) => {
        if (call.url === "/api/canvas/dialog-agent-generate") return { body: dialogSuccessPayload };
        if (call.url === "/api/generate/tasks" && call.method === "POST") return { status: 202, body: quickTaskPayload("pending") };
        if (call.url.startsWith("/api/generate/tasks/")) return { body: quickTaskPayload("success") };
        if (call.url === "/api/canvas/ecommerce-suite/config") return { body: ecommerceConfigPayload };
        if (call.url === "/api/canvas/ecommerce-suite/prompts") return { body: ecommercePromptsPayload };
        if (call.url === "/api/canvas/ecommerce-suite/generate") return { body: ecommerceGeneratePayload };
        throw new Error(`未预期请求：${call.method} ${call.url}`);
    });

    // 对话：POST /api/canvas/dialog-agent-generate，携带需求、参考图与本模式 sessionId。
    store.updateMode("dialog", { draft: "生成一张海报", referenceImages: [REF_IMAGE] });
    const dialogSessionId = store.getSnapshot().modes.dialog.sessionId;
    await store.sendDialogMessage();
    const dialogCall = calls.find((call) => call.url === "/api/canvas/dialog-agent-generate");
    assert.ok(dialogCall, "对话模式必须请求 /api/canvas/dialog-agent-generate");
    assert.equal(dialogCall.method, "POST");
    const dialogBody = dialogCall.body as Record<string, unknown>;
    assert.equal(dialogBody.requirement, "生成一张海报");
    assert.equal(dialogBody.sessionId, dialogSessionId, "对话请求必须携带本模式 sessionId");
    assert.ok(Array.isArray(dialogBody.referenceImages) && dialogBody.referenceImages.length === 1, "对话请求必须携带参考图");

    // 快速：POST /api/generate/tasks 创建持久任务并轮询（复用 Task 8 管道）。
    store.updateMode("quick", { draft: "快速生图提示词" });
    await store.submitQuick({ modelKey: "gpt-image-2", ratio: "1:1", imageCount: 1 });
    const quickCreate = calls.find((call) => call.url === "/api/generate/tasks");
    assert.ok(quickCreate, "快速模式必须走 /api/generate/tasks 持久任务管道");
    assert.equal(quickCreate.method, "POST");
    const quickBody = quickCreate.body as Record<string, unknown>;
    assert.equal(quickBody.prompt, "快速生图提示词");
    assert.equal(quickBody.modelKey, "gpt-image-2");
    assert.equal(typeof quickBody.clientRequestId, "string", "快速模式必须携带幂等键");

    // 电商套图：config 读取、prompts 动态生成、generate 提交。
    const config = await store.loadEcommerceConfig();
    assert.equal(config.enabled, true);
    assert.equal(config.skills[0]?.id, "gloria");
    store.updateMode("ecommerce-suite", { draft: "保温杯套图", productImages: [PRODUCT_IMAGE], referenceImages: [REF_IMAGE] });
    const plans = await store.requestEcommercePrompts({ skillId: "gloria" });
    assert.equal(plans.length, 1);
    assert.equal(store.getSnapshot().modes["ecommerce-suite"].promptPlans[0]?.sectionKey, "hero-visual");
    const promptsCall = calls.find((call) => call.url === "/api/canvas/ecommerce-suite/prompts");
    assert.ok(promptsCall, "套图提示词必须请求 /api/canvas/ecommerce-suite/prompts");
    const promptsBody = promptsCall.body as Record<string, unknown>;
    assert.equal(promptsBody.skillId, "gloria");
    assert.equal(promptsBody.requirement, "保温杯套图");
    assert.ok(Array.isArray(promptsBody.productImages) && promptsBody.productImages.length === 1, "套图必须携带产品图");
    assert.ok(Array.isArray(promptsBody.referenceImages) && promptsBody.referenceImages.length === 1, "套图必须携带参考图");

    await store.generateEcommerceSuite({ skillId: "gloria" });
    const generateCall = calls.find((call) => call.url === "/api/canvas/ecommerce-suite/generate");
    assert.ok(generateCall, "套图生图必须请求 /api/canvas/ecommerce-suite/generate");
    const generateBody = generateCall.body as Record<string, unknown>;
    assert.ok(Array.isArray(generateBody.promptPlans) && (generateBody.promptPlans as unknown[]).length === 1, "generate 必须提交已生成的板块提示词");
    const suiteState = store.getSnapshot().modes["ecommerce-suite"];
    assert.equal(suiteState.taskId, "suite_task_1");
    assert.equal(suiteState.generating, false);
    assert.equal(suiteState.messages.filter((item) => item.role === "assistant").at(-1)?.images?.[0]?.assetId, "asset_suite");
    assert.equal(store.getSnapshot().modes.dialog.taskId, "dlg_task_1", "套图流程不得覆盖对话容器 taskId");
    assert.equal(store.getSnapshot().modes.quick.taskId, "task_quick_1", "套图流程不得覆盖快速容器 taskId");
    assertSameOriginApiUrls(calls);
});

test("对话分析失败不继续生图，错误写回对话容器", async () => {
    const { store, calls } = createTestStore(() => ({
        status: 502,
        body: { success: false, code: "CANVAS_DIALOG_ANALYSIS_FAILED", message: "GPT 5.6 Terra 分析失败，请稍后重试", stage: "analysis" },
    }));
    store.updateMode("dialog", { draft: "生成一张海报" });
    await store.sendDialogMessage();

    const snapshot = store.getSnapshot();
    const errorMessages = snapshot.modes.dialog.messages.filter((item) => item.role === "error");
    assert.equal(errorMessages.length, 1, "对话失败必须写入错误消息");
    assert.match(errorMessages[0]?.text || "", /分析失败/);
    assert.equal(snapshot.modes.dialog.generating, false, "失败后生成中状态必须复位");
    assert.equal(snapshot.modes.dialog.taskId, "", "失败不得留下 taskId");
    assert.equal(calls.length, 1, "分析失败不得发起任何后续请求");
    assert.equal(calls[0]?.url, "/api/canvas/dialog-agent-generate");
    assert.ok(!calls.some((call) => call.url.startsWith("/api/generate/tasks")), "分析失败不得继续走生图任务管道");
    assert.ok(!calls.some((call) => call.url.includes("ecommerce-suite/generate")), "分析失败不得触发套图生图");
});

test("计费边界：全流程不请求估费接口，前端不读取/计算余额", async () => {
    const { store, calls } = createTestStore((call) => {
        if (call.url === "/api/canvas/dialog-agent-generate") return { body: dialogSuccessPayload };
        if (call.url === "/api/generate/tasks" && call.method === "POST") return { status: 202, body: quickTaskPayload("pending") };
        if (call.url.startsWith("/api/generate/tasks/")) return { body: quickTaskPayload("success") };
        if (call.url === "/api/canvas/ecommerce-suite/config") return { body: ecommerceConfigPayload };
        if (call.url === "/api/canvas/ecommerce-suite/prompts") return { body: ecommercePromptsPayload };
        if (call.url === "/api/canvas/ecommerce-suite/generate") return { body: ecommerceGeneratePayload };
        throw new Error(`未预期请求：${call.method} ${call.url}`);
    });
    store.updateMode("dialog", { draft: "对话需求" });
    await store.sendDialogMessage();
    store.updateMode("quick", { draft: "快速需求" });
    await store.submitQuick({ modelKey: "gpt-image-2" });
    await store.loadEcommerceConfig();
    store.updateMode("ecommerce-suite", { draft: "套图需求", productImages: [PRODUCT_IMAGE] });
    await store.requestEcommercePrompts({ skillId: "gloria" });
    await store.generateEcommerceSuite({ skillId: "gloria" });

    assert.ok(calls.length >= 5, "三个模式流程都应真实发出请求");
    calls.forEach((call) => {
        assert.ok(!call.url.includes("estimate"), `前端不得预估费用：${call.url}`);
        assert.ok(!call.url.includes("balance"), `前端不得读取/扣减余额：${call.url}`);
        assert.ok(!call.url.includes("/api/user/profile"), `契约层不得主动刷新用户资料：${call.url}`);
    });
    // 状态容器中不得出现余额/估费字段（事实源在服务端，终态后由面板层刷新用户资料）。
    MODES.forEach((mode) => {
        const state = store.getSnapshot().modes[mode] as unknown as Record<string, unknown>;
        assert.ok(!("balance" in state), `${mode} 容器不得持有余额字段`);
        assert.ok(!("estimatedCost" in state), `${mode} 容器不得持有估费字段`);
    });
    assertSameOriginApiUrls(calls);
});
