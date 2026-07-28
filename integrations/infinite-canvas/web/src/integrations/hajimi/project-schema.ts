// 项目信封 schema：候选项目保存到服务器的数据格式（见 docs/plans 第 2 章）。
// 纯 TS 模块，仅供 strip-types 契约测试与画布 Store 使用，禁止引入 @/ 别名或运行时依赖。
// 规则：blob:、data:*、本机绝对路径不得进入服务器项目 JSON；
// 识别不到信封的旧数据标记为 legacy，绝不抛弃原数据。

export const PROJECT_SCHEMA = "hjm.infinite-canvas.project";
export const PROJECT_SCHEMA_VERSION = 1;
export const PROJECT_ENGINE = "infinite-canvas";
export const UPSTREAM_VERSION = "0.10.0";

export type HjmProjectContent = {
    nodes: unknown[];
    connections: unknown[];
    chatSessions: unknown[];
    activeChatId: string | null;
    backgroundMode: string;
    showImageInfo: boolean;
    viewport: { x: number; y: number; k: number };
};

export type HjmPromptReference = {
    scope: "system" | "user";
    promptId: string;
    version?: number;
    contentSnapshot: string;
};

export type HjmInfiniteCanvasProjectEnvelope = {
    schema: typeof PROJECT_SCHEMA;
    schemaVersion: typeof PROJECT_SCHEMA_VERSION;
    engine: typeof PROJECT_ENGINE;
    upstreamVersion: typeof UPSTREAM_VERSION;
    project: HjmProjectContent;
    references?: {
        assetIds?: string[];
        prompts?: HjmPromptReference[];
    };
};

export class UnsafeProjectContentError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "UnsafeProjectContentError";
    }
}

const DATA_URL_PATTERN = /^data:/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-zA-Z]:[\\/]/;
const BLOB_URL_PREFIX = "blob:";

// blob: 对象 URL 只在当前会话有效，序列化时剥离为空串；
// 节点上的 storageKey 会在重新加载时重新解析出可展示 URL。
// data:*（内联大图）与本机绝对路径没有安全的服务器表示，直接拒绝。
function sanitizeForServer(value: unknown, path: string): unknown {
    if (typeof value === "string") {
        if (value.startsWith(BLOB_URL_PREFIX)) return "";
        if (DATA_URL_PATTERN.test(value)) {
            throw new UnsafeProjectContentError(`项目内容包含内联 data: 数据（${path}），不得写入服务器项目 JSON`);
        }
        if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(value)) {
            throw new UnsafeProjectContentError(`项目内容包含本机绝对路径（${path}），不得写入服务器项目 JSON`);
        }
        return value;
    }
    if (Array.isArray(value)) return value.map((item, index) => sanitizeForServer(item, `${path}[${index}]`));
    if (value && typeof value === "object") {
        const result: Record<string, unknown> = {};
        for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
            result[key] = sanitizeForServer(item, path ? `${path}.${key}` : key);
        }
        return result;
    }
    return value;
}

export function serializeProjectEnvelope(content: HjmProjectContent): HjmInfiniteCanvasProjectEnvelope {
    const safeContent = sanitizeForServer(content, "") as HjmProjectContent;
    const promptReferences = collectPromptReferences(safeContent.nodes);
    return {
        schema: PROJECT_SCHEMA,
        schemaVersion: PROJECT_SCHEMA_VERSION,
        engine: PROJECT_ENGINE,
        upstreamVersion: UPSTREAM_VERSION,
        project: {
            nodes: Array.isArray(safeContent.nodes) ? safeContent.nodes : [],
            connections: Array.isArray(safeContent.connections) ? safeContent.connections : [],
            chatSessions: Array.isArray(safeContent.chatSessions) ? safeContent.chatSessions : [],
            activeChatId: typeof safeContent.activeChatId === "string" ? safeContent.activeChatId : null,
            backgroundMode: typeof safeContent.backgroundMode === "string" ? safeContent.backgroundMode : "lines",
            showImageInfo: Boolean(safeContent.showImageInfo),
            viewport: {
                x: Number(safeContent.viewport?.x ?? 0) || 0,
                y: Number(safeContent.viewport?.y ?? 0) || 0,
                k: Number(safeContent.viewport?.k ?? 1) || 1,
            },
        },
        ...(promptReferences.length ? { references: { prompts: promptReferences } } : {}),
    };
}

// 从节点 metadata.promptReference 收集提示词引用（scope + promptId + version + contentSnapshot），
// 按 scope+promptId+version 去重。插入提示词的节点携带引用，保存项目时汇入信封 references.prompts。
export function collectPromptReferences(nodes: unknown): HjmPromptReference[] {
    if (!Array.isArray(nodes)) return [];
    const seen = new Set<string>();
    const references: HjmPromptReference[] = [];
    for (const node of nodes) {
        const metadata = node && typeof node === "object" ? (node as Record<string, unknown>).metadata : null;
        const reference = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>).promptReference : null;
        if (!reference || typeof reference !== "object") continue;
        const record = reference as Record<string, unknown>;
        const scope = record.scope === "system" ? "system" : record.scope === "user" ? "user" : null;
        const promptId = typeof record.promptId === "string" ? record.promptId : "";
        const contentSnapshot = typeof record.contentSnapshot === "string" ? record.contentSnapshot : "";
        if (!scope || !promptId || !contentSnapshot) continue;
        const version = Number(record.version);
        const key = `${scope}:${promptId}:${Number.isFinite(version) && version > 0 ? version : ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        references.push({
            scope,
            promptId,
            ...(Number.isFinite(version) && version > 0 ? { version } : {}),
            contentSnapshot,
        });
    }
    return references;
}

export function isProjectEnvelope(data: unknown): data is HjmInfiniteCanvasProjectEnvelope {
    return Boolean(
        data &&
            typeof data === "object" &&
            (data as Record<string, unknown>).schema === PROJECT_SCHEMA &&
            (data as Record<string, unknown>).schemaVersion === PROJECT_SCHEMA_VERSION,
    );
}

export type DeserializeProjectResult =
    | { kind: "envelope"; project: HjmProjectContent }
    | { kind: "legacy"; raw: unknown };

// 反序列化：识别信封则取出内容；识别不到的一律标记 legacy，原数据原样保留。
export function deserializeProjectEnvelope(data: unknown): DeserializeProjectResult {
    if (!isProjectEnvelope(data)) return { kind: "legacy", raw: data };
    const project = (data.project ?? {}) as Partial<HjmProjectContent>;
    return {
        kind: "envelope",
        project: {
            nodes: Array.isArray(project.nodes) ? project.nodes : [],
            connections: Array.isArray(project.connections) ? project.connections : [],
            chatSessions: Array.isArray(project.chatSessions) ? project.chatSessions : [],
            activeChatId: typeof project.activeChatId === "string" ? project.activeChatId : null,
            backgroundMode: typeof project.backgroundMode === "string" ? project.backgroundMode : "lines",
            showImageInfo: Boolean(project.showImageInfo),
            viewport: {
                x: Number(project.viewport?.x ?? 0) || 0,
                y: Number(project.viewport?.y ?? 0) || 0,
                k: Number(project.viewport?.k ?? 1) || 1,
            },
        },
    };
}
