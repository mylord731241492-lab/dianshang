// 崩溃恢复草稿：唯一允许的浏览器端项目持久化。
// 键按 userId + projectId 隔离；服务器保存成功后必须删除对应草稿；
// 退出登录 / 401 时清空当前用户的全部草稿。

export type ProjectDraft = {
    userId: string;
    projectId: string;
    title: string;
    savedAt: string;
    content: unknown;
};

const DRAFT_PREFIX = "hjm:canvas-draft:";

function draftKey(userId: string, projectId: string): string {
    return `${DRAFT_PREFIX}${userId}:${projectId}`;
}

function storageOrNull(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}

export function saveProjectDraft(userId: string, projectId: string, input: { title: string; content: unknown }): void {
    const storage = storageOrNull();
    if (!storage || !userId || !projectId) return;
    const draft: ProjectDraft = {
        userId,
        projectId,
        title: input.title,
        savedAt: new Date().toISOString(),
        content: input.content,
    };
    try {
        storage.setItem(draftKey(userId, projectId), JSON.stringify(draft));
    } catch {
        // localStorage 写满时放弃草稿，不影响主流程。
    }
}

export function loadProjectDraft(userId: string, projectId: string): ProjectDraft | null {
    const storage = storageOrNull();
    if (!storage || !userId || !projectId) return null;
    try {
        const raw = storage.getItem(draftKey(userId, projectId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<ProjectDraft>;
        if (parsed.userId !== userId || parsed.projectId !== projectId) return null;
        return {
            userId,
            projectId,
            title: typeof parsed.title === "string" ? parsed.title : "",
            savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
            content: parsed.content,
        };
    } catch {
        return null;
    }
}

export function removeProjectDraft(userId: string, projectId: string): void {
    const storage = storageOrNull();
    if (!storage || !userId || !projectId) return;
    try {
        storage.removeItem(draftKey(userId, projectId));
    } catch {
        // 忽略清理失败。
    }
}

export function clearUserDrafts(userId: string): void {
    const storage = storageOrNull();
    if (!storage || !userId) return;
    const prefix = `${DRAFT_PREFIX}${userId}:`;
    const keys: string[] = [];
    try {
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (key && key.startsWith(prefix)) keys.push(key);
        }
        keys.forEach((key) => storage.removeItem(key));
    } catch {
        // 忽略清理失败。
    }
}
