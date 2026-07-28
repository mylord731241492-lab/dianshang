// 浏览器端项目/资产仓库单例：复用同源 HTTP 客户端，401 时清空当前用户内存态、恢复草稿与资产瞬态缓存。
// 本模块不被契约测试 import，可以使用 @/ 别名。

import { clearUserDrafts } from "./project-draft-cache";
import { ApiError, AUTH_TOKEN_KEY, clearSessionAndRedirect, createHttpClient } from "./http";
import { createProjectsApi, type ProjectsApi } from "./projects-api";
import { createAssetsApi, type AssetsApi } from "./assets-api";
import { createPromptsApi, type PromptsApi } from "./prompts-api";
import { useUserStore } from "@/stores/use-user-store";

let cachedClient: ReturnType<typeof createHttpClient> | null = null;
let cachedProjectsApi: ProjectsApi | null = null;
let cachedAssetsApi: AssetsApi | null = null;
let cachedPromptsApi: PromptsApi | null = null;

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
