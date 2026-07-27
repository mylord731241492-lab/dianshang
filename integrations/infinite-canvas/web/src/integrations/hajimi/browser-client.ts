// 浏览器端项目仓库单例：复用同源 HTTP 客户端，401 时清空当前用户内存态与其恢复草稿。
// 本模块不被契约测试 import，可以使用 @/ 别名。

import { clearUserDrafts } from "./project-draft-cache";
import { createHttpClient } from "./http";
import { createProjectsApi, type ProjectsApi } from "./projects-api";
import { useUserStore } from "@/stores/use-user-store";

let cachedApi: ProjectsApi | null = null;

export function getProjectsApi(): ProjectsApi {
    if (cachedApi) return cachedApi;
    const client = createHttpClient({
        storage: {
            getItem: (key) => window.localStorage.getItem(key),
            removeItem: (key) => window.localStorage.removeItem(key),
        },
        navigate: (url) => window.location.assign(url),
        currentPath: () => `${window.location.pathname}${window.location.search}`,
        onSessionCleared: () => {
            const userId = useUserStore.getState().user?.id;
            useUserStore.getState().clearSession();
            if (userId) clearUserDrafts(userId);
        },
    });
    cachedApi = createProjectsApi(client);
    return cachedApi;
}
