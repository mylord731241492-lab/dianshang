// 网页版 Canvas Agent 同源 API 契约（Task 13A）。
// - 浏览器只请求 /api/canvas/agent/*，JWT 由 browser-client transport 注入。
// - browserSessionId 与 projectId 每次请求都显式携带；token 永不进入 SSE URL。
// - 写操作先返回 execution 提案，只有 confirm 响应 execute=true 时浏览器才执行一次，
//   执行完成再通过 result 端点回传；replayed=true 时不得再次修改画布。
// 本模块为纯契约层：不得 import @/ 别名、React 或浏览器全局。

export type CanvasAgentScope = {
    projectId: string;
    browserSessionId: string;
};

export type CanvasAgentSessionStatus =
    | "idle"
    | "running"
    | "waiting_confirmation"
    | "waiting_result"
    | "stopped"
    | "interrupted"
    | "error";

export type CanvasAgentSession = {
    id: string;
    projectId: string;
    browserSessionId: string;
    title: string;
    status: CanvasAgentSessionStatus;
    skillIds: string[];
    createdAt: number;
    updatedAt: number;
    pendingToolCount?: number;
    preview?: string;
};

export type CanvasAgentSkill = {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    sortOrder: number;
};

export type CanvasAgentWireOp = {
    type: string;
    [key: string]: unknown;
};

export type CanvasAgentExecution =
    | { kind: "canvas_ops"; ops: CanvasAgentWireOp[] }
    | { kind: "navigate"; path: string }
    | { kind: "site_tool"; name: string; input: Record<string, unknown>; write: boolean };

export type CanvasAgentToolCallStatus = "pending" | "approved" | "executed" | "failed" | "rejected" | "interrupted";

export type CanvasAgentToolCall = {
    id: string;
    sessionId: string;
    name: string;
    summary: string;
    input: Record<string, unknown>;
    execution: CanvasAgentExecution | null;
    status: CanvasAgentToolCallStatus;
    result: unknown;
    error: string;
    createdAt: number;
    updatedAt: number;
};

export type CanvasAgentEvent = {
    id: number;
    sessionId: string;
    type: string;
    payload: Record<string, unknown>;
    createdAt: number;
};

export type CanvasAgentBundle = {
    session: CanvasAgentSession;
    events: CanvasAgentEvent[];
    toolCalls: CanvasAgentToolCall[];
};

export type CanvasAgentAttachment = {
    id: string;
    assetId: string;
    name: string;
    type: string;
    width?: number;
    height?: number;
    accessUrl?: string;
};

export type CanvasAgentApiClient = {
    get: <T>(path: string) => Promise<T>;
    post: <T>(path: string, body?: unknown) => Promise<T>;
    delete: <T>(path: string) => Promise<T>;
};

export type CanvasAgentEventStreamTransport = (input: {
    path: string;
    onEvent: (event: CanvasAgentEvent) => void;
    onError?: (error: unknown) => void;
}) => () => void;

type SendMessageInput = {
    text: string;
    snapshot: Record<string, unknown>;
    attachments?: CanvasAgentAttachment[];
    mentions?: CanvasAgentMention[];
};

export type CanvasAgentMention = {
    label: string;
    nodeId?: string;
    attachmentId?: string;
    title: string;
    kind: string;
};

type ConfirmResult = {
    session: CanvasAgentSession;
    toolCall: CanvasAgentToolCall;
    execution?: CanvasAgentExecution;
    execute: boolean;
    replayed: boolean;
};

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readStatus(value: unknown): CanvasAgentSessionStatus {
    const status = String(value || "");
    return ["idle", "running", "waiting_confirmation", "waiting_result", "stopped", "interrupted", "error"].includes(status)
        ? (status as CanvasAgentSessionStatus)
        : "idle";
}

function readSession(value: unknown): CanvasAgentSession | null {
    const record = toRecord(value);
    if (!record || typeof record.id !== "string" || !record.id) return null;
    return {
        id: record.id,
        projectId: typeof record.projectId === "string" ? record.projectId : "",
        browserSessionId: typeof record.browserSessionId === "string" ? record.browserSessionId : "",
        title: typeof record.title === "string" && record.title ? record.title : "新对话",
        status: readStatus(record.status),
        skillIds: Array.isArray(record.skillIds) ? record.skillIds.map(String).filter(Boolean) : [],
        createdAt: Number(record.createdAt) || 0,
        updatedAt: Number(record.updatedAt) || 0,
        pendingToolCount: Number.isFinite(Number(record.pendingToolCount)) ? Number(record.pendingToolCount) : undefined,
        preview: typeof record.preview === "string" ? record.preview : undefined,
    };
}

function readExecution(value: unknown): CanvasAgentExecution | null {
    const record = toRecord(value);
    if (!record) return null;
    if (record.kind === "canvas_ops" && Array.isArray(record.ops)) {
        return {
            kind: "canvas_ops",
            ops: record.ops.map(toRecord).filter((item): item is Record<string, unknown> => Boolean(item)).map((item) => ({ ...item, type: String(item.type || "") })),
        };
    }
    if (record.kind === "navigate" && typeof record.path === "string") return { kind: "navigate", path: record.path };
    if (record.kind === "site_tool" && typeof record.name === "string") {
        return {
            kind: "site_tool",
            name: record.name,
            input: toRecord(record.input) ?? {},
            write: record.write === true,
        };
    }
    return null;
}

function readToolCall(value: unknown): CanvasAgentToolCall | null {
    const record = toRecord(value);
    if (!record || typeof record.id !== "string" || !record.id) return null;
    const status = String(record.status || "");
    return {
        id: record.id,
        sessionId: typeof record.sessionId === "string" ? record.sessionId : "",
        name: typeof record.name === "string" ? record.name : "unknown",
        summary: typeof record.summary === "string" ? record.summary : "",
        input: toRecord(record.input) ?? {},
        execution: readExecution(record.execution),
        status: ["pending", "approved", "executed", "failed", "rejected", "interrupted"].includes(status)
            ? (status as CanvasAgentToolCallStatus)
            : "failed",
        result: record.result ?? null,
        error: typeof record.error === "string" ? record.error : "",
        createdAt: Number(record.createdAt) || 0,
        updatedAt: Number(record.updatedAt) || 0,
    };
}

function readEvent(value: unknown): CanvasAgentEvent | null {
    const record = toRecord(value);
    if (!record || !Number.isFinite(Number(record.id)) || typeof record.type !== "string") return null;
    return {
        id: Number(record.id),
        sessionId: typeof record.sessionId === "string" ? record.sessionId : "",
        type: record.type,
        payload: toRecord(record.payload) ?? {},
        createdAt: Number(record.createdAt) || 0,
    };
}

function readBundle(payload: unknown): CanvasAgentBundle {
    const record = toRecord(payload) ?? {};
    const session = readSession(record.session);
    if (!session) throw new Error("Agent 响应缺少会话实体");
    return {
        session,
        events: (Array.isArray(record.events) ? record.events : []).map(readEvent).filter((item): item is CanvasAgentEvent => Boolean(item)),
        toolCalls: (Array.isArray(record.toolCalls) ? record.toolCalls : []).map(readToolCall).filter((item): item is CanvasAgentToolCall => Boolean(item)),
    };
}

function query(scope: CanvasAgentScope, extra: Record<string, string | number> = {}): string {
    const search = new URLSearchParams({
        projectId: scope.projectId,
        browserSessionId: scope.browserSessionId,
    });
    Object.entries(extra).forEach(([key, value]) => search.set(key, String(value)));
    return search.toString();
}

function scopeBody(scope: CanvasAgentScope): CanvasAgentScope {
    return { projectId: scope.projectId, browserSessionId: scope.browserSessionId };
}

export function createCanvasAgentApi(client: CanvasAgentApiClient, streamTransport?: CanvasAgentEventStreamTransport) {
    return {
        async listSessions(scope: CanvasAgentScope): Promise<CanvasAgentSession[]> {
            const record = toRecord(await client.get(`/api/canvas/agent/sessions?${query(scope)}`)) ?? {};
            return (Array.isArray(record.sessions) ? record.sessions : []).map(readSession).filter((item): item is CanvasAgentSession => Boolean(item));
        },
        async createSession(scope: CanvasAgentScope, title = "新对话"): Promise<CanvasAgentSession> {
            const record = toRecord(await client.post("/api/canvas/agent/sessions", { ...scopeBody(scope), title })) ?? {};
            const session = readSession(record.session);
            if (!session) throw new Error("Agent 响应缺少会话实体");
            return session;
        },
        async getSession(scope: CanvasAgentScope, sessionId: string): Promise<CanvasAgentBundle> {
            return readBundle(await client.get(`/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}?${query(scope)}`));
        },
        async listEvents(scope: CanvasAgentScope, sessionId: string, after = 0): Promise<CanvasAgentBundle> {
            return readBundle(await client.get(`/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}/events?${query(scope, { after })}`));
        },
        async sendMessage(scope: CanvasAgentScope, sessionId: string, input: SendMessageInput): Promise<CanvasAgentBundle> {
            return readBundle(await client.post(`/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}/messages`, {
                ...scopeBody(scope),
                text: input.text,
                snapshot: input.snapshot,
                attachments: input.attachments ?? [],
                mentions: input.mentions ?? [],
            }));
        },
        async confirmToolCall(scope: CanvasAgentScope, sessionId: string, callId: string): Promise<ConfirmResult> {
            const record = toRecord(await client.post(`/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}/tool-calls/${encodeURIComponent(callId)}/confirm`, scopeBody(scope))) ?? {};
            const session = readSession(record.session);
            const toolCall = readToolCall(record.toolCall);
            if (!session || !toolCall) throw new Error("Agent 确认响应格式异常");
            return {
                session,
                toolCall,
                execution: readExecution(record.execution) ?? undefined,
                execute: record.execute === true,
                replayed: record.replayed === true,
            };
        },
        async rejectToolCall(scope: CanvasAgentScope, sessionId: string, callId: string, reason = "") {
            const record = toRecord(await client.post(`/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}/tool-calls/${encodeURIComponent(callId)}/reject`, {
                ...scopeBody(scope),
                reason,
            })) ?? {};
            const session = readSession(record.session);
            const toolCall = readToolCall(record.toolCall);
            if (!session || !toolCall) throw new Error("Agent 拒绝响应格式异常");
            return { session, toolCall, execute: false, replayed: record.replayed === true };
        },
        async reportToolResult(
            scope: CanvasAgentScope,
            sessionId: string,
            callId: string,
            outcome: { result?: unknown; error?: string },
        ) {
            const record = toRecord(await client.post(`/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}/tool-calls/${encodeURIComponent(callId)}/result`, {
                ...scopeBody(scope),
                ...outcome,
            })) ?? {};
            const session = readSession(record.session);
            const toolCall = readToolCall(record.toolCall);
            if (!session || !toolCall) throw new Error("Agent 工具回执响应格式异常");
            return { session, toolCall, replayed: record.replayed === true };
        },
        async stopSession(scope: CanvasAgentScope, sessionId: string): Promise<CanvasAgentSession> {
            const record = toRecord(await client.post(`/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}/stop`, scopeBody(scope))) ?? {};
            const session = readSession(record.session);
            if (!session) throw new Error("Agent 停止响应格式异常");
            return session;
        },
        async deleteSession(scope: CanvasAgentScope, sessionId: string): Promise<void> {
            await client.delete(`/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}?${query(scope)}`);
        },
        async listAgentSkills(): Promise<CanvasAgentSkill[]> {
            const record = toRecord(await client.get("/api/agent-skills")) ?? {};
            return (Array.isArray(record.items) ? record.items : []).map(toRecord).filter((item): item is Record<string, unknown> => Boolean(item?.id)).map((item) => ({
                id: String(item.id),
                name: String(item.name || ""),
                description: String(item.description || ""),
                enabled: item.enabled === true,
                sortOrder: Number(item.sortOrder) || 0,
            }));
        },
        async updateSessionSkills(scope: CanvasAgentScope, sessionId: string, skillIds: string[]): Promise<CanvasAgentSession> {
            const record = toRecord(await client.post(`/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}/skills`, {
                ...scopeBody(scope),
                skillIds,
            })) ?? {};
            const session = readSession(record.session);
            if (!session) throw new Error("Agent 技能响应缺少会话实体");
            return session;
        },
        streamEvents(
            scope: CanvasAgentScope,
            sessionId: string,
            options: { after?: number; onEvent: (event: CanvasAgentEvent) => void; onError?: (error: unknown) => void },
        ): () => void {
            if (!streamTransport) {
                options.onError?.(new Error("当前浏览器未配置 Agent SSE transport"));
                return () => {};
            }
            return streamTransport({
                path: `/api/canvas/agent/sessions/${encodeURIComponent(sessionId)}/events/stream?${query(scope, { after: options.after ?? 0 })}`,
                onEvent: options.onEvent,
                onError: options.onError,
            });
        },
    };
}

export type CanvasAgentApi = ReturnType<typeof createCanvasAgentApi>;
