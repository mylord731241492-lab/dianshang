// Task 12：旧版画布项目 → hjm.infinite-canvas.project v1 信封的纯函数转换器。
// 旧格式字段名以代码证据为准（见 scripts/fixtures/canvas-projects/README.md）：
// - 项目 data 可能包裹在 workflowJson/workflowData/canvasData/workflow/data 下（server.js normalizeWorkflowJson）。
// - 节点 { id, type, position: { x, y }, data }；类型 text/imageConfig/image/video（llmConfig 等未知类型跳过）。
// - 连线 { id, source, target, sourceHandle, targetHandle }；视口 { x, y, zoom }（Vue Flow）。
// 非破坏性：只读取旧数据，绝不回写；无法转换的字段一律进 warnings。
// 安全规则：data:image 必须先经注入的上传函数转为 assetId（未注入则拒绝该节点）；
// blob: 与本机绝对路径一律剥离并记 warning，三者绝不原样写入信封。
// 本模块是纯契约层：不得 import 应用源码、@/ 别名或 JSX（strip-types 契约测试直接加载）。
// 注意：按 Task 12 Step 4，这里只提供显式逐个导入，禁止在此基础上编写数据库批量迁移脚本。

import { serializeProjectEnvelope, type HjmInfiniteCanvasProjectEnvelope } from "./project-schema.ts";

export type LegacyImageUploadResult = {
    assetId: string;
    storageKey: string;
    url: string;
    width: number;
    height: number;
    bytes: number;
    mimeType: string;
};

// data:image 内联图的上传通道：浏览器端注入 /api/user/assets/upload 实现，测试注入假实现。
export type LegacyImageUploader = (dataUrl: string, context: { nodeId: string }) => Promise<LegacyImageUploadResult>;

export type LegacyImportOptions = {
    uploadImage?: LegacyImageUploader;
};

export type LegacyImportStats = {
    nodesConverted: number;
    nodesSkipped: number;
    connectionsConverted: number;
    connectionsSkipped: number;
    imagesUploaded: number;
};

export type LegacyImportResult = {
    envelope: HjmInfiniteCanvasProjectEnvelope;
    warnings: string[];
    stats: LegacyImportStats;
};

const DATA_URL_PATTERN = /^data:/i;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /^[a-zA-Z]:[\\/]/;
const BLOB_URL_PREFIX = "blob:";
const POSIX_ABSOLUTE_PATH_PATTERN = /^\/(?:Users|home|tmp|var|etc|opt)\//;

// 旧格式没有节点宽高（Vue Flow 运行时计算），导入时使用固定默认尺寸。
const DEFAULT_NODE_SIZE: Record<string, { width: number; height: number }> = {
    text: { width: 320, height: 160 },
    config: { width: 360, height: 240 },
    image: { width: 320, height: 320 },
    video: { width: 360, height: 240 },
};

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toNumber(value: unknown, fallback = 0): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function toText(value: unknown, fallback = ""): string {
    return typeof value === "string" ? value : fallback;
}

// 与 server.js normalizeWorkflowJson 对齐：逐层解包 workflowJson/workflowData/canvasData/workflow/data。
function unwrapLegacyProject(raw: unknown): Record<string, unknown> {
    let current = toRecord(raw) ?? {};
    for (let depth = 0; depth < 8; depth += 1) {
        for (const key of ["workflowJson", "workflowData", "canvasData", "workflow"]) {
            const nested = toRecord(current[key]);
            if (nested) {
                current = nested;
                continue;
            }
        }
        const data = toRecord(current.data);
        if (data && !Array.isArray(current.nodes) && !Array.isArray(current.edges)) {
            current = data;
            continue;
        }
        return current;
    }
    return current;
}

type ImageRefResolution =
    | { kind: "keep"; url: string }
    | { kind: "strip"; warning: string }
    | { kind: "upload"; dataUrl: string };

function classifyImageRef(url: string, nodeId: string): ImageRefResolution {
    if (DATA_URL_PATTERN.test(url)) return { kind: "upload", dataUrl: url };
    if (url.startsWith(BLOB_URL_PREFIX)) {
        return { kind: "strip", warning: `节点 ${nodeId}：blob: 会话内引用无法持久化，已剥离` };
    }
    if (WINDOWS_ABSOLUTE_PATH_PATTERN.test(url) || POSIX_ABSOLUTE_PATH_PATTERN.test(url)) {
        return { kind: "strip", warning: `节点 ${nodeId}：本机绝对路径引用无法转换，已剥离` };
    }
    return { kind: "keep", url };
}

function convertChatSessions(value: unknown, warnings: string[]): { sessions: Record<string, unknown>[]; activeChatId: string | null } {
    if (!Array.isArray(value)) return { sessions: [], activeChatId: null };
    const sessions: Record<string, unknown>[] = [];
    for (const [index, item] of value.entries()) {
        const record = toRecord(item);
        if (!record) {
            warnings.push(`chatSessions[${index}]：会话不是对象，已跳过`);
            continue;
        }
        const id = toText(record.id) || toText(record.sessionId) || `legacy_chat_${index}`;
        const createdAtRaw = record.createdAt;
        const createdAt = Number.isFinite(Number(createdAtRaw)) ? new Date(Number(createdAtRaw)).toISOString() : toText(createdAtRaw) || new Date(0).toISOString();
        const messages = Array.isArray(record.messages) ? record.messages : [];
        const convertedMessages: Record<string, unknown>[] = [];
        for (const [messageIndex, messageItem] of messages.entries()) {
            const message = toRecord(messageItem);
            if (!message) continue;
            const role = message.role === "user" || message.role === "assistant" || message.role === "system" ? message.role : null;
            if (!role) {
                warnings.push(`会话 ${id} 消息 ${messageIndex}：无法识别的 role，已按 assistant 导入`);
            }
            if (Array.isArray(message.images) && message.images.length) {
                warnings.push(`会话 ${id} 消息 ${messageIndex}：旧消息 images 引用不迁移，已剥离`);
            }
            convertedMessages.push({
                id: toText(message.id) || `legacy_msg_${index}_${messageIndex}`,
                role: role ?? "assistant",
                text: toText(message.text),
            });
        }
        sessions.push({
            id,
            title: toText(record.title) || toText(record.mode) || "旧会话",
            messages: convertedMessages,
            createdAt,
            updatedAt: createdAt,
        });
    }
    // 旧格式没有 activeChatId 概念，导入后固定为 null（见 fixture README 假设）。
    return { sessions, activeChatId: null };
}

// 旧项目 data → v1 信封。raw 只读；上传回调可注入（未注入时 data:image 节点被拒绝）。
export async function convertLegacyProject(raw: unknown, options: LegacyImportOptions = {}): Promise<LegacyImportResult> {
    const warnings: string[] = [];
    const stats: LegacyImportStats = { nodesConverted: 0, nodesSkipped: 0, connectionsConverted: 0, connectionsSkipped: 0, imagesUploaded: 0 };
    const legacy = unwrapLegacyProject(raw);
    if (!Array.isArray(legacy.nodes)) warnings.push("旧项目缺少 nodes 数组，按空项目导入");
    if (legacy.storage !== undefined) warnings.push("旧本地存储描述 storage 不可转换，已忽略");
    if (legacy.thumbnail !== undefined) warnings.push("旧缩略图 thumbnail 不迁移，已忽略");

    const legacyNodes = Array.isArray(legacy.nodes) ? legacy.nodes : [];
    const nodes: Record<string, unknown>[] = [];
    const convertedNodeIds = new Set<string>();
    const assetIds: string[] = [];

    for (const [index, item] of legacyNodes.entries()) {
        const record = toRecord(item);
        const id = record ? toText(record.id) : "";
        if (!record || !id) {
            warnings.push(`nodes[${index}]：缺少节点 id，已跳过`);
            stats.nodesSkipped += 1;
            continue;
        }
        const position = toRecord(record.position);
        const base = {
            id,
            position: { x: toNumber(position?.x), y: toNumber(position?.y) },
        };
        const data = toRecord(record.data) ?? {};
        const type = toText(record.type);

        if (type === "text") {
            nodes.push({ ...base, type: "text", title: toText(data.label) || "文本", ...DEFAULT_NODE_SIZE.text, metadata: { content: toText(data.content) } });
        } else if (type === "imageConfig") {
            nodes.push({
                ...base,
                type: "config",
                title: toText(data.label) || "文生图",
                ...DEFAULT_NODE_SIZE.config,
                metadata: {
                    generationMode: "image",
                    prompt: toText(data.prompt),
                    ...(toText(data.model) ? { model: toText(data.model) } : {}),
                    ...(toText(data.size) ? { size: toText(data.size) } : {}),
                    ...(toText(data.quality || data.clarity) ? { quality: toText(data.quality || data.clarity) } : {}),
                },
            });
        } else if (type === "imagePromptGenerate") {
            // 旧画布主生成节点：提示词在连入的文本节点里（随 edges 转换），本节点只携带生成参数。
            nodes.push({
                ...base,
                type: "config",
                title: toText(data.label) || "生图节点",
                ...DEFAULT_NODE_SIZE.config,
                metadata: {
                    generationMode: "image",
                    ...(toText(data.model || data.modelKey) ? { model: toText(data.model || data.modelKey) } : {}),
                    ...(toText(data.size) ? { size: toText(data.size) } : {}),
                    ...(toText(data.quality || data.clarity) ? { quality: toText(data.quality || data.clarity) } : {}),
                    ...(Number(data.imageCount) ? { count: Math.max(1, Math.min(4, Number(data.imageCount))) } : {}),
                },
            });
        } else if (type === "image" || type === "video") {
            const url = toText(data.url || data.src);
            const metadata: Record<string, unknown> = {
                ...(toText(data.taskId) ? { legacyTaskId: toText(data.taskId) } : {}),
            };
            const ref = url ? classifyImageRef(url, id) : ({ kind: "keep", url: "" } as ImageRefResolution);
            if (ref.kind === "strip") {
                warnings.push(ref.warning);
                metadata.content = "";
            } else if (ref.kind === "upload") {
                if (!options.uploadImage) {
                    warnings.push(`节点 ${id}：内联 data: 图片必须先上传为云端资产，但未提供上传函数，节点被拒绝`);
                    stats.nodesSkipped += 1;
                    continue;
                }
                const uploaded = await options.uploadImage(ref.dataUrl, { nodeId: id });
                metadata.content = uploaded.url || "";
                metadata.storageKey = uploaded.storageKey;
                metadata.status = "success";
                metadata.naturalWidth = uploaded.width;
                metadata.naturalHeight = uploaded.height;
                metadata.bytes = uploaded.bytes;
                metadata.mimeType = uploaded.mimeType;
                assetIds.push(uploaded.assetId);
                stats.imagesUploaded += 1;
            } else {
                metadata.content = ref.url;
            }
            const size = type === "image" ? DEFAULT_NODE_SIZE.image : DEFAULT_NODE_SIZE.video;
            nodes.push({ ...base, type, title: toText(data.label) || (type === "image" ? "图片" : "视频"), ...size, metadata });
        } else {
            warnings.push(`节点 ${id}：未知类型 "${type || "(空)"}" 无法转换，已跳过`);
            stats.nodesSkipped += 1;
            continue;
        }
        convertedNodeIds.add(id);
        stats.nodesConverted += 1;
    }

    const legacyEdges = Array.isArray(legacy.edges) ? legacy.edges : [];
    const connections: Record<string, unknown>[] = [];
    for (const [index, item] of legacyEdges.entries()) {
        const record = toRecord(item);
        const source = record ? toText(record.source) : "";
        const target = record ? toText(record.target) : "";
        if (!record || !source || !target) {
            warnings.push(`edges[${index}]：缺少 source/target，已跳过`);
            stats.connectionsSkipped += 1;
            continue;
        }
        if (!convertedNodeIds.has(source) || !convertedNodeIds.has(target)) {
            warnings.push(`连线 ${toText(record.id) || `edges[${index}]`}：端点节点未转换，已跳过`);
            stats.connectionsSkipped += 1;
            continue;
        }
        connections.push({ id: toText(record.id) || `legacy_edge_${index}`, fromNodeId: source, toNodeId: target });
        stats.connectionsConverted += 1;
    }

    const legacyViewport = toRecord(legacy.viewport);
    if (!legacyViewport) warnings.push("旧项目缺少视口信息，已使用默认视口");
    const viewport = {
        x: toNumber(legacyViewport?.x),
        y: toNumber(legacyViewport?.y),
        k: toNumber(legacyViewport?.zoom ?? legacyViewport?.k, 1) || 1,
    };

    const { sessions, activeChatId } = convertChatSessions(legacy.chatSessions, warnings);

    const envelope = serializeProjectEnvelope({
        nodes,
        connections,
        chatSessions: sessions,
        activeChatId,
        backgroundMode: "lines",
        showImageInfo: false,
        viewport,
    });
    if (assetIds.length) {
        envelope.references = { ...envelope.references, assetIds };
    }
    return { envelope, warnings, stats };
}
