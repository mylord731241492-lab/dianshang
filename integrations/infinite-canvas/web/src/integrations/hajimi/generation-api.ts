// 持久生图任务同源 API 封装（Task 8）：/api/generate/tasks*。
// 契约以 server.js + docs/api-contracts.md 为准：
// - 创建 POST /api/generate/tasks 返回 HTTP 202；幂等键走请求体 clientRequestId（等价 Idempotency-Key 头）。
// - 同一用户相同幂等键 + 相同请求哈希重放返回原 taskId 且 replayed=true，不创建第二个 Provider 任务。
// - 轮询 GET /api/generate/tasks/:id；状态 pending/running/success/failed/cancelled，
//   stage 取值 queued/provider_degraded/preparing/connecting/awaiting_provider/persisting/done。
// - 429 限流必须展示 Retry-After（由 http.ts ApiError.retryAfterSeconds 解析）。
// - billingStatus：reserved/settled/partially_settled/refunded；本地已退款与上游计费未知
//   （request.providerBillingStatus='unknown' + upstreamBillingAmbiguous）必须区分（ADR-0004）。
// - 成功结果图带云端 assetId 与 15 分钟短时同源 accessUrl（/api/asset-content/...）。
// 本模块必须是纯契约层：不得 import 应用源码、@/ 别名或 JSX（strip-types 契约测试直接加载）。

import { ApiError } from "./http.ts";

export type GenerationTaskStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export type GenerationTaskImage = {
    url: string;
    assetId?: string;
    accessUrl?: string;
};

export type GenerationTask = {
    taskId: string;
    status: GenerationTaskStatus;
    stage: string;
    progress: number;
    prompt: string;
    modelKey: string;
    routeId: string;
    images: GenerationTaskImage[];
    /** 首张已落云端资产库结果图的 assetId（无资产结果时缺省）。 */
    assetId?: string;
    /** 首张已落库结果图的 15 分钟短时同源展示 URL。 */
    accessUrl?: string;
    billingStatus: string;
    providerBillingStatus?: string;
    upstreamBillingAmbiguous: boolean;
    partial: boolean;
    warnings: string[];
    errorCode: string;
    errorMessage: string;
    queuePosition: number;
    retryAfterMs: number;
    canCancel: boolean;
    reservedCost: number;
    settledCost: number;
    replayed: boolean;
    retryOfTaskId?: string;
    remainingBalance?: number;
};

export type GenerationReferenceImageInput = {
    name: string;
    type: string;
    /** data: URL 形态的原图；与 url 二选一。 */
    dataUrl?: string;
    /** 同源或可公开读取的图片地址（服务端会读取并暂存为任务文件）。 */
    url?: string;
};

export type GenerationSubmitInput = {
    prompt: string;
    modelKey: string;
    routeId?: string;
    /** 比例，冒号格式（如 1:1）；auto 表示按内容自然选择。 */
    ratio?: string;
    /** 清晰度档位（1K/2K/4K 或 low/medium/high），像素换算在后端完成。 */
    quality?: string;
    imageCount?: number;
    referenceImages?: GenerationReferenceImageInput[];
    /** 同一操作的幂等键；缺省时由 createClientRequestId 生成。重试同一操作必须复用同一个键。 */
    clientRequestId?: string;
};

export type GenerationApiClient = {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
};

export type WaitForTaskOptions = {
    signal?: AbortSignal;
    onUpdate?: (task: GenerationTask) => void;
    initialDelayMs?: number;
    maxDelayMs?: number;
    timeoutMs?: number;
    /** 测试注入的睡眠实现；默认 setTimeout。 */
    sleep?: (ms: number) => Promise<void>;
    /** 测试注入的时钟；默认 Date.now。 */
    now?: () => number;
};

const TERMINAL_STATUSES: readonly string[] = ["success", "failed", "cancelled"];
const TASK_STATUSES: readonly string[] = ["pending", "running", "success", "failed", "cancelled"];
const MAX_IMAGE_COUNT = 4;

const STAGE_LABELS: Record<string, string> = {
    queued: "排队中",
    provider_degraded: "线路冷却，等待重试",
    preparing: "准备中",
    connecting: "连接上游",
    awaiting_provider: "上游生成中",
    persisting: "保存结果中",
    done: "完成",
};

export function createClientRequestId(): string {
    const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    return `cr_${uuid}`;
}

export function isTerminalTaskStatus(status: string): boolean {
    return TERMINAL_STATUSES.includes(status);
}

export function taskStageLabel(stage: string): string {
    return STAGE_LABELS[stage] || "生成中";
}

/** 失败/取消的计费语义：上游计费未知优先于本地已退款，二者必须区分展示（ADR-0004）。 */
export function taskFailureKind(task: Pick<GenerationTask, "status" | "billingStatus" | "providerBillingStatus" | "upstreamBillingAmbiguous">): "refunded" | "billing-unknown" | "none" {
    if (task.providerBillingStatus === "unknown" || task.upstreamBillingAmbiguous) return "billing-unknown";
    if ((task.status === "failed" || task.status === "cancelled") && (task.billingStatus === "refunded" || task.billingStatus === "partially_settled")) return "refunded";
    return "none";
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toStatus(value: unknown): GenerationTaskStatus {
    const text = String(value || "");
    return TASK_STATUSES.includes(text) ? (text as GenerationTaskStatus) : "pending";
}

function readTaskImage(value: unknown): GenerationTaskImage | null {
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

// 任务实体读取：任务字段在顶层，计费歧义字段在 request 内（server.js makePersistentTaskResponse）。
export function readGenerationTask(payload: unknown): GenerationTask {
    const record = toRecord(payload);
    if (!record) throw new Error("生图任务响应格式异常");
    const taskId = typeof record.taskId === "string" && record.taskId ? record.taskId : typeof record.id === "string" ? record.id : "";
    if (!taskId) throw new Error("生图任务响应格式异常：缺少 taskId");
    const request = toRecord(record.request) ?? {};
    const images = (Array.isArray(record.images) ? record.images : Array.isArray(record.resultImages) ? (record.resultImages as unknown[]) : [])
        .map(readTaskImage)
        .filter((image): image is GenerationTaskImage => Boolean(image));
    const warnings = Array.isArray(record.warnings) ? record.warnings.map((item) => String(item)) : Array.isArray(request.warnings) ? (request.warnings as unknown[]).map((item) => String(item)) : [];
    const firstAsset = images.find((image) => image.assetId);
    return {
        taskId,
        status: toStatus(record.status),
        stage: typeof record.stage === "string" ? record.stage : "queued",
        progress: Number(record.progress) || 0,
        prompt: typeof record.prompt === "string" ? record.prompt : "",
        modelKey: typeof record.modelKey === "string" ? record.modelKey : typeof record.model === "string" ? (record.model as string) : "",
        routeId: typeof record.routeId === "string" ? record.routeId : "",
        images,
        assetId: typeof record.assetId === "string" && record.assetId ? record.assetId : firstAsset?.assetId,
        accessUrl: typeof record.accessUrl === "string" && record.accessUrl ? record.accessUrl : firstAsset?.accessUrl,
        billingStatus: typeof record.billingStatus === "string" ? record.billingStatus : "reserved",
        providerBillingStatus: typeof request.providerBillingStatus === "string" ? (request.providerBillingStatus as string) : undefined,
        upstreamBillingAmbiguous: request.upstreamBillingAmbiguous === true,
        partial: record.partial === true || request.partial === true,
        warnings,
        errorCode: typeof record.errorCode === "string" ? record.errorCode : "",
        errorMessage: typeof record.errorMessage === "string" ? record.errorMessage : "",
        queuePosition: Number(record.queuePosition) || 0,
        retryAfterMs: Number(record.retryAfterMs) || 0,
        canCancel: record.canCancel === true,
        reservedCost: Number(record.reservedCost) || 0,
        settledCost: Number(record.settledCost) || 0,
        replayed: record.replayed === true,
        retryOfTaskId: typeof record.retryOfTaskId === "string" && record.retryOfTaskId ? record.retryOfTaskId : undefined,
        remainingBalance: typeof record.remainingBalance === "number" ? record.remainingBalance : undefined,
    };
}

function defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function abortError(): Error {
    const error = new Error("请求已取消");
    error.name = "AbortError";
    return error;
}

export function createGenerationApi(client: GenerationApiClient) {
    // 同一任务的取消只调用一次：合并并发调用，终态后重复取消直接返回首次结果。
    const cancelInflight = new Map<string, Promise<GenerationTask>>();
    const cancelSettled = new Map<string, GenerationTask>();

    async function submit(input: GenerationSubmitInput): Promise<GenerationTask> {
        const blobReference = input.referenceImages?.find((image) =>
            [image.dataUrl, image.url].some((value) => typeof value === "string" && value.startsWith("blob:")),
        );
        if (blobReference) {
            throw new ApiError(
                400,
                "参考图片仍是浏览器临时地址，请等待图片上传完成后重试",
                "GENERATION_REFERENCE_BLOB_URL_UNSUPPORTED",
            );
        }
        const body: Record<string, unknown> = {
            prompt: input.prompt,
            modelKey: input.modelKey,
            imageCount: Math.max(1, Math.min(Number(input.imageCount) || 1, MAX_IMAGE_COUNT)),
            clientRequestId: input.clientRequestId || createClientRequestId(),
        };
        if (input.routeId) body.routeId = input.routeId;
        if (input.ratio) body.ratio = input.ratio;
        if (input.quality) body.quality = input.quality;
        if (input.referenceImages?.length) {
            body.referenceImages = input.referenceImages.slice(0, MAX_IMAGE_COUNT).map((image) => ({
                name: image.name,
                type: image.type,
                ...(image.dataUrl ? { dataUrl: image.dataUrl } : {}),
                ...(image.url ? { url: image.url } : {}),
            }));
        }
        return readGenerationTask(await client.post("/api/generate/tasks", body));
    }

    async function getTask(taskId: string): Promise<GenerationTask> {
        return readGenerationTask(await client.get(`/api/generate/tasks/${encodeURIComponent(taskId)}`));
    }

    function cancel(taskId: string): Promise<GenerationTask> {
        const settled = cancelSettled.get(taskId);
        if (settled) return Promise.resolve(settled);
        const inflight = cancelInflight.get(taskId);
        if (inflight) return inflight;
        const request = client
            .post(`/api/generate/tasks/${encodeURIComponent(taskId)}/cancel`, {})
            .then((payload) => {
                const task = readGenerationTask(payload);
                cancelSettled.set(taskId, task);
                return task;
            })
            .finally(() => {
                cancelInflight.delete(taskId);
            });
        cancelInflight.set(taskId, request);
        return request;
    }

    async function retry(taskId: string, options: { confirmUpstreamBillingRisk?: boolean } = {}): Promise<GenerationTask> {
        // 人工重试由服务端创建全新任务并签发新幂等键；前端不得复用旧 clientRequestId。
        return readGenerationTask(
            await client.post(`/api/generate/tasks/${encodeURIComponent(taskId)}/retry`, {
                confirmUpstreamBillingRisk: options.confirmUpstreamBillingRisk === true,
            }),
        );
    }

    async function waitForTask(taskId: string, options: WaitForTaskOptions = {}): Promise<GenerationTask> {
        const sleep = options.sleep ?? defaultSleep;
        const now = options.now ?? (() => Date.now());
        const initialDelayMs = Math.max(50, Number(options.initialDelayMs) || 800);
        const maxDelayMs = Math.max(initialDelayMs, Number(options.maxDelayMs) || 4000);
        const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 300000);
        const deadline = now() + timeoutMs;
        let delayMs = initialDelayMs;

        while (true) {
            if (options.signal?.aborted) throw abortError();
            let task: GenerationTask;
            try {
                task = await getTask(taskId);
            } catch (error) {
                // 轮询期间被限流：按 Retry-After 等待后继续，不视为任务失败。
                if (error instanceof ApiError && error.status === 429) {
                    await sleep(Math.max(1000, (error.retryAfterSeconds ?? 5) * 1000));
                    continue;
                }
                throw error;
            }
            if (isTerminalTaskStatus(task.status)) return task;
            options.onUpdate?.(task);
            const waitMs = task.retryAfterMs > 0 ? Math.max(task.retryAfterMs, 500) : delayMs;
            if (now() + waitMs > deadline) throw new Error("生图任务等待超时，请稍后在画布中继续查看结果");
            await sleep(waitMs);
            delayMs = Math.min(maxDelayMs, Math.round(delayMs * 1.5));
        }
    }

    return { submit, getTask, cancel, retry, waitForTask };
}

export type GenerationApi = ReturnType<typeof createGenerationApi>;
