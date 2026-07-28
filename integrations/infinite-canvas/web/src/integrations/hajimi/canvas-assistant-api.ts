// 画布助手三模式（对话 / 快速 / 电商套图）同源 API 与状态容器（Task 10）。
// 契约以 server.js 为准：
// - 对话：POST /api/canvas/dialog-agent-generate（分析 + 生图一次完成；分析失败后端不生图，
//   前端收到错误后不得再发起任何生图请求）。
// - 快速：POST /api/generate/tasks 创建持久任务并轮询（复用 Task 8 generation-api 管道）。
// - 电商套图：GET /api/canvas/ecommerce-suite/config、POST /api/canvas/ecommerce-suite/prompts、
//   POST /api/canvas/ecommerce-suite/generate；提示词由当前 skill/产品图/参考图在服务端动态生成。
// 隔离契约：dialog / quick / ecommerce-suite 三个模式的状态容器互不共享
// （消息、草稿、参考图、sessionId、生成中状态、taskId）；
// 异步完成（轮询/回调）写回任务创建时的原模式，绝不写入当前可见模式。
// 计费边界：本模块不预估费用、不读取/扣减余额、不刷新用户资料；
// 余额事实源在服务端，任务终态后由面板层调用 refreshSessionUser()。
// 本模块必须是纯契约层：不得 import 应用源码、@/ 别名或 JSX（strip-types 契约测试直接加载）。

import { createGenerationApi, readGenerationTask, taskStageLabel, type GenerationApiClient, type GenerationTask } from "./generation-api.ts";

export type CanvasAssistantMode = "dialog" | "quick" | "ecommerce-suite";

export type AssistantReferenceImage = {
    name: string;
    type: string;
    /** data: URL 形态的原图；与 url 二选一。 */
    dataUrl?: string;
    /** 同源或可公开读取的图片地址。 */
    url?: string;
};

export type AssistantResultImage = {
    url: string;
    assetId?: string;
    accessUrl?: string;
};

export type CanvasAssistantMessage = {
    id: string;
    role: "user" | "assistant" | "error";
    text: string;
    images?: AssistantResultImage[];
};

export type EcommercePromptPlan = {
    sectionKey: string;
    sectionName: string;
    title: string;
    prompt: string;
    negativePrompt: string;
};

export type EcommerceSuiteSkill = {
    id: string;
    name: string;
    avatarUrl: string;
    description: string;
};

export type EcommerceSuiteDefaults = {
    brandName: string;
    platform: string;
    country: string;
    language: string;
    ratio: string;
    quality: string;
    imageCount: number;
};

// 注意：GET config 响应还含有 analysisCost/estimatedImageCostPerSection，
// 本类型刻意不解析这些字段——前端不预估费用，估费展示一律以后端任务终态为准。
export type EcommerceSuiteConfig = {
    enabled: boolean;
    skills: EcommerceSuiteSkill[];
    defaultSkillId: string;
    defaults: EcommerceSuiteDefaults;
};

export type CanvasAssistantModeState = {
    mode: CanvasAssistantMode;
    sessionId: string;
    draft: string;
    referenceImages: AssistantReferenceImage[];
    messages: CanvasAssistantMessage[];
    generating: boolean;
    taskId: string;
    /** 当前任务进度（0-100）与阶段文案；空闲时为 0 / 空串。 */
    progress: number;
    stageLabel: string;
    /** ecommerce-suite 专用：产品图（与参考图分桶）与已生成的板块提示词。 */
    productImages: AssistantReferenceImage[];
    promptPlans: EcommercePromptPlan[];
};

export type CanvasAssistantSnapshot = {
    visibleMode: CanvasAssistantMode;
    modes: Record<CanvasAssistantMode, CanvasAssistantModeState>;
};

export type CanvasAssistantStoreOptions = {
    client: GenerationApiClient;
    /** 测试注入的睡眠实现；默认 setTimeout。 */
    sleep?: (ms: number) => Promise<void>;
    /** 测试注入的时钟；默认 Date.now。 */
    now?: () => number;
    /** 测试注入的 sessionId 工厂；默认随机。 */
    sessionIdFactory?: () => string;
    /** 测试注入的消息 id 工厂；默认随机。 */
    messageIdFactory?: () => string;
    /** 快速模式轮询超时；默认 300000。 */
    waitTimeoutMs?: number;
};

export type EcommerceSuiteRunOptions = {
    skillId?: string;
    brandName?: string;
    platform?: string;
    country?: string;
    language?: string;
    ratio?: string;
    quality?: string;
    imageCount?: number;
};

const MAX_REFERENCE_IMAGES = 4;
const MAX_SUITE_IMAGES = 8;

function randomId(prefix: string): string {
    const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    return `${prefix}_${uuid}`;
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readResultImage(value: unknown): AssistantResultImage | null {
    const record = toRecord(value);
    if (!record) return null;
    const url = typeof record.url === "string" ? record.url : typeof record.imageUrl === "string" ? (record.imageUrl as string) : "";
    if (!url) return null;
    return {
        url,
        assetId: typeof record.assetId === "string" && record.assetId ? record.assetId : undefined,
        accessUrl: typeof record.accessUrl === "string" && record.accessUrl ? record.accessUrl : undefined,
    };
}

function readResultImages(payload: unknown): AssistantResultImage[] {
    const record = toRecord(payload) ?? {};
    const list = Array.isArray(record.images) ? record.images : Array.isArray(record.resultImages) ? (record.resultImages as unknown[]) : [];
    return list.map(readResultImage).filter((image): image is AssistantResultImage => Boolean(image));
}

function readTaskId(payload: unknown): string {
    const record = toRecord(payload) ?? {};
    return typeof record.taskId === "string" && record.taskId ? record.taskId : typeof record.id === "string" ? (record.id as string) : "";
}

function readPromptPlan(value: unknown): EcommercePromptPlan | null {
    const record = toRecord(value);
    if (!record) return null;
    const prompt = typeof record.prompt === "string" ? record.prompt.trim() : "";
    if (!prompt) return null;
    return {
        sectionKey: typeof record.sectionKey === "string" && record.sectionKey ? record.sectionKey : "section",
        sectionName: typeof record.sectionName === "string" && record.sectionName ? record.sectionName : typeof record.title === "string" ? (record.title as string) : "板块",
        title: typeof record.title === "string" && record.title ? record.title : typeof record.sectionName === "string" ? (record.sectionName as string) : "板块",
        prompt,
        negativePrompt: typeof record.negativePrompt === "string" ? record.negativePrompt : "",
    };
}

function readEcommerceConfig(payload: unknown): EcommerceSuiteConfig {
    const record = toRecord(payload) ?? {};
    const defaults = toRecord(record.defaults) ?? {};
    const skills = (Array.isArray(record.skills) ? record.skills : [])
        .map((value): EcommerceSuiteSkill | null => {
            const skill = toRecord(value);
            if (!skill) return null;
            const id = typeof skill.id === "string" ? skill.id : "";
            if (!id) return null;
            return {
                id,
                name: typeof skill.name === "string" && skill.name ? skill.name : id,
                avatarUrl: typeof skill.avatarUrl === "string" ? skill.avatarUrl : "",
                description: typeof skill.description === "string" ? skill.description : "",
            };
        })
        .filter((skill): skill is EcommerceSuiteSkill => Boolean(skill));
    return {
        enabled: record.enabled !== false,
        skills,
        defaultSkillId: typeof record.defaultSkillId === "string" ? record.defaultSkillId : skills[0]?.id || "",
        defaults: {
            brandName: typeof defaults.brandName === "string" ? defaults.brandName : "",
            platform: typeof defaults.platform === "string" && defaults.platform ? defaults.platform : "拼多多",
            country: typeof defaults.country === "string" && defaults.country ? defaults.country : "中国",
            language: typeof defaults.language === "string" && defaults.language ? defaults.language : "中文",
            ratio: typeof defaults.ratio === "string" && defaults.ratio ? defaults.ratio : "1:1",
            quality: typeof defaults.quality === "string" && defaults.quality ? defaults.quality : "1k",
            imageCount: Math.max(1, Math.min(Number(defaults.imageCount) || 1, 4)),
        },
    };
}

function errorText(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

export function createCanvasAssistantStore(options: CanvasAssistantStoreOptions) {
    const { client } = options;
    const sessionIdFactory = options.sessionIdFactory ?? (() => randomId("session"));
    const messageIdFactory = options.messageIdFactory ?? (() => randomId("msg"));
    const generationApi = createGenerationApi(client);
    const listeners = new Set<() => void>();

    function freshModeState(mode: CanvasAssistantMode): CanvasAssistantModeState {
        return {
            mode,
            sessionId: sessionIdFactory(),
            draft: "",
            referenceImages: [],
            messages: [],
            generating: false,
            taskId: "",
            progress: 0,
            stageLabel: "",
            productImages: [],
            promptPlans: [],
        };
    }

    let snapshot: CanvasAssistantSnapshot = {
        visibleMode: "dialog",
        modes: {
            dialog: freshModeState("dialog"),
            quick: freshModeState("quick"),
            "ecommerce-suite": freshModeState("ecommerce-suite"),
        },
    };

    function emit() {
        listeners.forEach((listener) => listener());
    }

    // 所有写回都以「任务创建时的模式」为键，绝不使用 snapshot.visibleMode。
    function patchMode(mode: CanvasAssistantMode, patch: Partial<CanvasAssistantModeState>) {
        snapshot = { ...snapshot, modes: { ...snapshot.modes, [mode]: { ...snapshot.modes[mode], ...patch } } };
        emit();
    }

    function appendMessage(mode: CanvasAssistantMode, message: Omit<CanvasAssistantMessage, "id">) {
        const current = snapshot.modes[mode];
        patchMode(mode, { messages: [...current.messages.slice(-120), { ...message, id: messageIdFactory() }] });
    }

    function referencePayload(images: AssistantReferenceImage[], limit: number) {
        return images.slice(0, limit).map((image) => ({
            name: image.name,
            type: image.type,
            ...(image.dataUrl ? { dataUrl: image.dataUrl } : {}),
            ...(image.url ? { url: image.url } : {}),
        }));
    }

    function suiteContextBody(mode: CanvasAssistantMode, runOptions: EcommerceSuiteRunOptions) {
        const state = snapshot.modes[mode];
        const body: Record<string, unknown> = {
            skillId: runOptions.skillId || "",
            requirement: state.draft.trim(),
            productImages: referencePayload(state.productImages, MAX_SUITE_IMAGES),
            referenceImages: referencePayload(state.referenceImages, MAX_SUITE_IMAGES),
        };
        if (runOptions.brandName) body.brandName = runOptions.brandName;
        if (runOptions.platform) body.platform = runOptions.platform;
        if (runOptions.country) body.country = runOptions.country;
        if (runOptions.language) body.language = runOptions.language;
        if (runOptions.ratio) body.ratio = runOptions.ratio;
        if (runOptions.quality) body.quality = runOptions.quality;
        if (runOptions.imageCount) body.imageCount = Math.max(1, Math.min(Number(runOptions.imageCount) || 1, 4));
        return body;
    }

    async function sendDialogMessage(): Promise<void> {
        const mode: CanvasAssistantMode = "dialog";
        const state = snapshot.modes[mode];
        const requirement = state.draft.trim();
        if (!requirement && !state.referenceImages.length) throw new Error("请输入生成需求或上传参考图");
        appendMessage(mode, { role: "user", text: requirement || "（参考图）" });
        patchMode(mode, { draft: "", generating: true, taskId: "", progress: 0, stageLabel: "分析中" });
        try {
            const payload = await client.post("/api/canvas/dialog-agent-generate", {
                requirement,
                sessionId: state.sessionId,
                referenceImages: referencePayload(state.referenceImages, MAX_REFERENCE_IMAGES),
            });
            const record = toRecord(payload) ?? {};
            const images = readResultImages(payload);
            const summary = typeof record.analysisSummary === "string" && record.analysisSummary ? record.analysisSummary : "已完成分析与生成";
            appendMessage(mode, { role: "assistant", text: summary, ...(images.length ? { images } : {}) });
            patchMode(mode, { generating: false, taskId: readTaskId(payload), progress: 100, stageLabel: "完成" });
        } catch (error) {
            // 对话分析失败：只记录错误并复位状态，不发起任何后续生图请求。
            appendMessage(mode, { role: "error", text: errorText(error, "对话分析失败，请稍后重试") });
            patchMode(mode, { generating: false, taskId: "", progress: 0, stageLabel: "" });
        }
    }

    async function submitQuick(input: { modelKey: string; routeId?: string; ratio?: string; quality?: string; imageCount?: number }): Promise<GenerationTask> {
        const mode: CanvasAssistantMode = "quick";
        const state = snapshot.modes[mode];
        const prompt = state.draft.trim();
        if (!prompt) throw new Error("请输入提示词");
        appendMessage(mode, { role: "user", text: prompt });
        patchMode(mode, { draft: "", generating: true, taskId: "", progress: 0, stageLabel: "排队中" });
        try {
            const created = await generationApi.submit({
                prompt,
                modelKey: input.modelKey,
                ...(input.routeId ? { routeId: input.routeId } : {}),
                ...(input.ratio ? { ratio: input.ratio } : {}),
                ...(input.quality ? { quality: input.quality } : {}),
                imageCount: input.imageCount ?? 1,
                referenceImages: referencePayload(state.referenceImages, MAX_REFERENCE_IMAGES).map((image) => ({ name: image.name, type: image.type, ...(image.dataUrl ? { dataUrl: image.dataUrl } : {}), ...(image.url ? { url: image.url } : {}) })),
            });
            patchMode(mode, { taskId: created.taskId, stageLabel: taskStageLabel(created.stage), progress: created.progress });
            const task = await generationApi.waitForTask(created.taskId, {
                ...(options.sleep ? { sleep: options.sleep } : {}),
                ...(options.now ? { now: options.now } : {}),
                ...(options.waitTimeoutMs ? { timeoutMs: options.waitTimeoutMs } : {}),
                onUpdate: (update) => patchMode(mode, { progress: update.progress, stageLabel: taskStageLabel(update.stage) }),
            });
            if (task.status === "success") {
                const images = task.images.map((image) => ({ url: image.url, ...(image.assetId ? { assetId: image.assetId } : {}), ...(image.accessUrl ? { accessUrl: image.accessUrl } : {}) }));
                appendMessage(mode, { role: "assistant", text: "生成完成，结果已存入云端资产库", ...(images.length ? { images } : {}) });
                patchMode(mode, { generating: false, taskId: task.taskId, progress: 100, stageLabel: "完成" });
            } else {
                appendMessage(mode, { role: "error", text: task.errorMessage || (task.status === "cancelled" ? "任务已取消" : "生成失败，请稍后重试") });
                patchMode(mode, { generating: false, progress: 0, stageLabel: "" });
            }
            return task;
        } catch (error) {
            appendMessage(mode, { role: "error", text: errorText(error, "生成失败，请稍后重试") });
            patchMode(mode, { generating: false, progress: 0, stageLabel: "" });
            throw error;
        }
    }

    async function loadEcommerceConfig(): Promise<EcommerceSuiteConfig> {
        return readEcommerceConfig(await client.get("/api/canvas/ecommerce-suite/config"));
    }

    async function requestEcommercePrompts(runOptions: EcommerceSuiteRunOptions = {}): Promise<EcommercePromptPlan[]> {
        const mode: CanvasAssistantMode = "ecommerce-suite";
        const state = snapshot.modes[mode];
        if (!state.productImages.length) throw new Error("请先上传产品图");
        patchMode(mode, { generating: true, stageLabel: "生成套图提示词中" });
        try {
            const payload = await client.post("/api/canvas/ecommerce-suite/prompts", suiteContextBody(mode, runOptions));
            const record = toRecord(payload) ?? {};
            const plans = (Array.isArray(record.promptPlans) ? record.promptPlans : []).map(readPromptPlan).filter((plan): plan is EcommercePromptPlan => Boolean(plan));
            if (!plans.length) throw new Error("套图板块生成失败，请补充产品信息后重试");
            patchMode(mode, { promptPlans: plans, generating: false, stageLabel: "" });
            return plans;
        } catch (error) {
            appendMessage(mode, { role: "error", text: errorText(error, "套图提示词生成失败，请稍后重试") });
            patchMode(mode, { generating: false, stageLabel: "" });
            throw error;
        }
    }

    async function generateEcommerceSuite(runOptions: EcommerceSuiteRunOptions = {}): Promise<void> {
        const mode: CanvasAssistantMode = "ecommerce-suite";
        const state = snapshot.modes[mode];
        if (!state.promptPlans.length) throw new Error("请先生成套图提示词");
        if (!state.productImages.length) throw new Error("请先上传产品图");
        appendMessage(mode, { role: "user", text: `按 ${state.promptPlans.length} 个板块生成套图` });
        patchMode(mode, { generating: true, taskId: "", stageLabel: "套图生成中" });
        try {
            const payload = await client.post("/api/canvas/ecommerce-suite/generate", {
                ...suiteContextBody(mode, runOptions),
                promptPlans: state.promptPlans.map((plan) => ({
                    sectionKey: plan.sectionKey,
                    sectionName: plan.sectionName,
                    title: plan.title,
                    prompt: plan.prompt,
                    negativePrompt: plan.negativePrompt,
                })),
            });
            const images = readResultImages(payload);
            appendMessage(mode, { role: "assistant", text: `已生成 ${state.promptPlans.length} 个电商套图板块`, ...(images.length ? { images } : {}) });
            patchMode(mode, { generating: false, taskId: readTaskId(payload), progress: 100, stageLabel: "完成" });
        } catch (error) {
            appendMessage(mode, { role: "error", text: errorText(error, "套图生图失败，请稍后重试") });
            patchMode(mode, { generating: false, taskId: "", stageLabel: "" });
        }
    }

    return {
        getSnapshot: (): CanvasAssistantSnapshot => snapshot,
        subscribe(listener: () => void): () => void {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        setVisibleMode(mode: CanvasAssistantMode) {
            if (snapshot.visibleMode === mode) return;
            snapshot = { ...snapshot, visibleMode: mode };
            emit();
        },
        updateMode(mode: CanvasAssistantMode, patch: Partial<Pick<CanvasAssistantModeState, "draft" | "referenceImages" | "productImages" | "promptPlans">>) {
            patchMode(mode, patch);
        },
        resetMode(mode: CanvasAssistantMode) {
            patchMode(mode, { ...freshModeState(mode), sessionId: sessionIdFactory() });
        },
        sendDialogMessage,
        submitQuick,
        loadEcommerceConfig,
        requestEcommercePrompts,
        generateEcommerceSuite,
    };
}

export type CanvasAssistantStore = ReturnType<typeof createCanvasAssistantStore>;

// 供面板层复用的响应解析（测试需要断言端点契约时直接读 payload）。
export { readGenerationTask };
