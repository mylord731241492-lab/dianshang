// 浏览器端项目/资产仓库单例：复用同源 HTTP 客户端，401 时清空当前用户内存态、恢复草稿与资产瞬态缓存。
// 本模块不被契约测试 import，可以使用 @/ 别名。

import { clearUserDrafts } from "./project-draft-cache";
import { ApiError, AUTH_TOKEN_KEY, clearSessionAndRedirect, createHttpClient } from "./http";
import { createProjectsApi, type ProjectsApi } from "./projects-api";
import { createAssetsApi, type AssetsApi } from "./assets-api";
import { createPromptsApi, type PromptsApi } from "./prompts-api";
import { createGenerationApi, type GenerationApi } from "./generation-api";
import { createCanvasAssistantStore, type CanvasAssistantStore } from "./canvas-assistant-api";
import { createCanvasAgentApi, type CanvasAgentApi, type CanvasAgentEvent, type CanvasAgentEventStreamTransport } from "./canvas-agent-api";
import { createImageToolsApi, type ImageToolsApi } from "./image-tools-api";
import { createModelsApi, type ModelsApi } from "./models-api";
import { createUserApi, type UserApi } from "./user-api";
import { mapProfileToUser } from "./auth";
import { useUserStore } from "@/stores/use-user-store";

let cachedClient: ReturnType<typeof createHttpClient> | null = null;
let cachedUserApi: UserApi | null = null;
let cachedProjectsApi: ProjectsApi | null = null;
let cachedAssetsApi: AssetsApi | null = null;
let cachedPromptsApi: PromptsApi | null = null;
let cachedGenerationApi: GenerationApi | null = null;
let cachedCanvasAssistantStore: CanvasAssistantStore | null = null;
let cachedCanvasAgentApi: CanvasAgentApi | null = null;
let cachedImageToolsApi: ImageToolsApi | null = null;
let cachedModelsApi: ModelsApi | null = null;

const browserStorage = {
    getItem: (key: string) => window.localStorage.getItem(key),
    removeItem: (key: string) => window.localStorage.removeItem(key),
};

// 会话失效（401/登出）时清空账号资产的内存态与 IndexedDB 瞬态缓存（ADR-0006：事实源在服务端）。
function clearCloudAssetSessionState() {
    void Promise.all([import("@/stores/use-asset-store"), import("@/services/image-storage"), import("@/services/file-storage")]).then(
        ([assetStoreModule, imageStorage, fileStorage]) => {
            assetStoreModule.useAssetStore.getState().resetCloudAssets();
            return Promise.all([imageStorage.clearTransientImageCache(), fileStorage.clearTransientMediaCache()]);
        },
    );
}

function handleSessionCleared() {
    const userId = useUserStore.getState().user?.id;
    useUserStore.getState().clearSession();
    if (userId) clearUserDrafts(userId);
    clearCloudAssetSessionState();
    // 提示词库 UI 状态（选择/查询）随会话立即清空；「我的提示词」数据本就只按用户经 API 拉取。
    void import("@/stores/use-prompt-source-store").then((module) => module.usePromptSourceStore.getState().reset());
}

const sessionConfig = {
    storage: browserStorage,
    navigate: (url: string) => window.location.assign(url),
    currentPath: () => `${window.location.pathname}${window.location.search}`,
    onSessionCleared: handleSessionCleared,
};

function getHttpClient() {
    if (cachedClient) return cachedClient;
    cachedClient = createHttpClient(sessionConfig);
    return cachedClient;
}

const canvasAgentEventStreamTransport: CanvasAgentEventStreamTransport = ({ path, onEvent, onError }) => {
    if (!path.startsWith("/api/canvas/agent/") || path.startsWith("//")) {
        onError?.(new Error(`只允许同源 Canvas Agent SSE：${path}`));
        return () => {};
    }
    let stopped = false;
    let activeController: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let lastEventId = Number(new URL(path, window.location.origin).searchParams.get("after")) || 0;

    const connect = async () => {
        if (stopped) return;
        const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
        activeController = new AbortController();
        const url = new URL(path, window.location.origin);
        url.searchParams.set("after", String(lastEventId));
        try {
            const response = await fetch(`${url.pathname}${url.search}`, {
                headers: {
                    Accept: "text/event-stream",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(lastEventId ? { "Last-Event-ID": String(lastEventId) } : {}),
                },
                signal: activeController.signal,
            });
            if (response.status === 401) {
                stopped = true;
                clearSessionAndRedirect(sessionConfig);
                throw new ApiError(401, "登录已过期，请重新登录");
            }
            if (!response.ok || !response.body) throw new ApiError(response.status, `Agent 事件流连接失败（HTTP ${response.status}）`);
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (!stopped) {
                const chunk = await reader.read();
                if (chunk.done) break;
                buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
                let boundary = buffer.indexOf("\n\n");
                while (boundary >= 0) {
                    const block = buffer.slice(0, boundary);
                    buffer = buffer.slice(boundary + 2);
                    const data = block
                        .split("\n")
                        .filter((line) => line.startsWith("data:"))
                        .map((line) => line.slice(5).trimStart())
                        .join("\n");
                    if (data) {
                        try {
                            const event = JSON.parse(data) as CanvasAgentEvent;
                            if (Number.isFinite(Number(event?.id)) && typeof event?.type === "string") {
                                lastEventId = Math.max(lastEventId, Number(event.id));
                                onEvent(event);
                            }
                        } catch {
                            // ping 或畸形单条事件不终止整条 SSE。
                        }
                    }
                    boundary = buffer.indexOf("\n\n");
                }
            }
        } catch (error) {
            if (!stopped && !(error instanceof DOMException && error.name === "AbortError")) onError?.(error);
        } finally {
            activeController = null;
            if (!stopped) reconnectTimer = setTimeout(() => void connect(), 1000);
        }
    };
    void connect();
    return () => {
        stopped = true;
        activeController?.abort();
        if (reconnectTimer) clearTimeout(reconnectTimer);
    };
};

// multipart 上传通道：FormData POST /api/user/assets/upload；浏览器只持有 JWT，永不接触对象存储密钥。
async function uploadAssetTransport({ path, file, fileName }: { path: string; file: Blob; fileName: string }) {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    const form = new FormData();
    form.append("file", file, fileName);
    const response = await fetch(path, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
    });
    if (response.status === 401) {
        clearSessionAndRedirect(sessionConfig);
        throw new ApiError(401, "登录已过期，请重新登录");
    }
    let payload: { message?: unknown; code?: unknown } | null = null;
    try {
        payload = (await response.json()) as { message?: unknown; code?: unknown };
    } catch {
        payload = null;
    }
    if (!response.ok) {
        const message = typeof payload?.message === "string" && payload.message ? payload.message : `上传失败（HTTP ${response.status}）`;
        const code = typeof payload?.code === "string" ? payload.code : undefined;
        throw new ApiError(response.status, message, code);
    }
    return payload;
}

export function getProjectsApi(): ProjectsApi {
    if (cachedProjectsApi) return cachedProjectsApi;
    cachedProjectsApi = createProjectsApi(getHttpClient());
    return cachedProjectsApi;
}

export function getAssetsApi(): AssetsApi {
    if (cachedAssetsApi) return cachedAssetsApi;
    cachedAssetsApi = createAssetsApi(getHttpClient(), uploadAssetTransport);
    return cachedAssetsApi;
}

export function getPromptsApi(): PromptsApi {
    if (cachedPromptsApi) return cachedPromptsApi;
    cachedPromptsApi = createPromptsApi(getHttpClient());
    return cachedPromptsApi;
}

export function getGenerationApi(): GenerationApi {
    if (cachedGenerationApi) return cachedGenerationApi;
    cachedGenerationApi = createGenerationApi(getHttpClient());
    return cachedGenerationApi;
}

// 画布三模式助手（对话 / 快速 / 电商套图）：状态容器按模式隔离，全部走同源 /api/*。
export function getCanvasAssistantStore(): CanvasAssistantStore {
    if (cachedCanvasAssistantStore) return cachedCanvasAssistantStore;
    cachedCanvasAssistantStore = createCanvasAssistantStore({ client: getHttpClient() });
    return cachedCanvasAssistantStore;
}

// 网页版 Canvas Agent：同源 HTTP + 带 Authorization header 的 fetch SSE。
// 浏览器不接触 Provider Key，也不使用 Local URL / Connect token。
export function getCanvasAgentApi(): CanvasAgentApi {
    if (cachedCanvasAgentApi) return cachedCanvasAgentApi;
    cachedCanvasAgentApi = createCanvasAgentApi(getHttpClient(), canvasAgentEventStreamTransport);
    return cachedCanvasAgentApi;
}

export function getModelsApi(): ModelsApi {
    if (cachedModelsApi) return cachedModelsApi;
    cachedModelsApi = createModelsApi(getHttpClient());
    return cachedModelsApi;
}

// 图片编辑工具（局部重绘/擦除/扩图/反推/免费扩写）：全部走同源 /api/image-tools/* 与 /api/canvas/enhance-prompt。
export function getImageToolsApi(): ImageToolsApi {
    if (cachedImageToolsApi) return cachedImageToolsApi;
    cachedImageToolsApi = createImageToolsApi(getHttpClient());
    return cachedImageToolsApi;
}

// 用户中心：余额流水、生成记录、兑换码、头像（/api/user/* 与 /api/upload 同源）。
export function getUserApi(): UserApi {
    if (cachedUserApi) return cachedUserApi;
    cachedUserApi = createUserApi(getHttpClient(), uploadAssetTransport);
    return cachedUserApi;
}

// 任务终态后重新拉取用户资料（余额事实源在服务端，前端不自行计算余额）。
export async function refreshSessionUser(): Promise<void> {
    const payload = await getHttpClient().get("/api/user/profile");
    useUserStore.getState().setUser(mapProfileToUser(payload as Parameters<typeof mapProfileToUser>[0]));
}
