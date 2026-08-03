import assert from "node:assert/strict";
import test from "node:test";

import { createCanvasAgentApi, type CanvasAgentApiClient, type CanvasAgentEventStreamTransport } from "./canvas-agent-api.ts";

type RecordedCall = { method: string; path: string; body?: unknown };

function createFixture() {
    const calls: RecordedCall[] = [];
    const client: CanvasAgentApiClient = {
        async get<T>(path: string): Promise<T> {
            calls.push({ method: "GET", path });
            if (path.includes("/events?")) return { success: true, session: { id: "session_1", status: "idle" }, events: [], toolCalls: [] } as T;
            if (/\/sessions\/session_1\?/.test(path)) return { success: true, session: { id: "session_1", status: "idle" }, events: [], toolCalls: [] } as T;
            return { success: true, sessions: [{ id: "session_1", projectId: "project_1", browserSessionId: "browser_1", title: "主会话", status: "idle" }] } as T;
        },
        async post<T>(path: string, body?: unknown): Promise<T> {
            calls.push({ method: "POST", path, body });
            if (path.endsWith("/sessions")) return { success: true, session: { id: "session_1", projectId: "project_1", browserSessionId: "browser_1", title: "新对话", status: "idle" } } as T;
            if (path.endsWith("/messages")) {
                return {
                    success: true,
                    session: { id: "session_1", status: "waiting_confirmation" },
                    events: [{ id: 1, sessionId: "session_1", type: "tool_proposed", payload: {}, createdAt: 1 }],
                    toolCalls: [{
                        id: "call_1",
                        sessionId: "session_1",
                        name: "canvas_create_text_node",
                        summary: "创建文本节点",
                        input: { text: "卖点" },
                        execution: { kind: "canvas_ops", ops: [{ type: "add_node", id: "node_1", nodeType: "text" }] },
                        status: "pending",
                        result: null,
                        error: "",
                        createdAt: 1,
                        updatedAt: 1,
                    }],
                } as T;
            }
            if (path.endsWith("/confirm")) {
                return {
                    success: true,
                    session: { id: "session_1", status: "waiting_result" },
                    toolCall: { id: "call_1", status: "approved" },
                    execution: { kind: "canvas_ops", ops: [{ type: "add_node", id: "node_1", nodeType: "text" }] },
                    execute: true,
                    replayed: false,
                } as T;
            }
            if (path.endsWith("/result")) return { success: true, session: { id: "session_1", status: "idle" }, toolCall: { id: "call_1", status: "executed" }, replayed: false } as T;
            if (path.endsWith("/reject")) return { success: true, session: { id: "session_1", status: "idle" }, toolCall: { id: "call_1", status: "rejected" }, execute: false, replayed: false } as T;
            if (path.endsWith("/stop")) return { success: true, session: { id: "session_1", status: "stopped" } } as T;
            return {} as T;
        },
        async delete<T>(path: string): Promise<T> {
            calls.push({ method: "DELETE", path });
            return { success: true, deleted: true, id: "session_1" } as T;
        },
    };
    let streamPath = "";
    const streamTransport: CanvasAgentEventStreamTransport = ({ path, onEvent }) => {
        streamPath = path;
        onEvent({ id: 2, sessionId: "session_1", type: "assistant_message", payload: { text: "完成" }, createdAt: 2 });
        return () => {};
    };
    return { api: createCanvasAgentApi(client, streamTransport), calls, getStreamPath: () => streamPath };
}

const scope = { projectId: "project_1", browserSessionId: "browser_1" };

test("Agent API 全部使用同源 /api/canvas/agent 路径并携带隔离字段", async () => {
    const { api, calls } = createFixture();
    await api.listSessions(scope);
    const session = await api.createSession(scope);
    await api.getSession(scope, session.id);
    await api.sendMessage(scope, session.id, {
        text: "创建节点",
        snapshot: {
            projectId: "project_1",
            title: "画布",
            nodes: [],
            connections: [],
            selectedNodeIds: [],
            viewport: { x: 0, y: 0, k: 1 },
        },
        attachments: [],
    });
    await api.confirmToolCall(scope, session.id, "call_1");
    await api.reportToolResult(scope, session.id, "call_1", { result: { ok: true } });
    await api.rejectToolCall(scope, session.id, "call_1", "拒绝");
    await api.stopSession(scope, session.id);
    await api.deleteSession(scope, session.id);

    assert.ok(calls.length >= 8);
    calls.forEach((call) => {
        assert.ok(call.path.startsWith("/api/canvas/agent/"), call.path);
        assert.ok(!/^https?:\/\//.test(call.path));
    });
    const sent = calls.find((call) => call.path.endsWith("/messages"));
    assert.deepEqual((sent?.body as Record<string, unknown>).projectId, "project_1");
    assert.deepEqual((sent?.body as Record<string, unknown>).browserSessionId, "browser_1");
});

test("确认响应保留 canvas_ops 执行载荷，重复确认由 execute/replayed 控制", async () => {
    const { api } = createFixture();
    const result = await api.confirmToolCall(scope, "session_1", "call_1");
    assert.equal(result.execute, true);
    assert.equal(result.replayed, false);
    assert.equal(result.execution?.kind, "canvas_ops");
    if (result.execution?.kind === "canvas_ops") {
        assert.equal(result.execution.ops[0].type, "add_node");
    }
});

test("SSE 使用认证 transport，不在 URL 拼 token，并按 after 恢复", () => {
    const { api, getStreamPath } = createFixture();
    const received: number[] = [];
    const close = api.streamEvents(scope, "session_1", {
        after: 7,
        onEvent: (event) => received.push(event.id),
    });
    assert.deepEqual(received, [2]);
    assert.match(getStreamPath(), /\/events\/stream\?/);
    assert.match(getStreamPath(), /after=7/);
    assert.equal(/token|authorization/i.test(getStreamPath()), false);
    close();
});

test("畸形响应不会伪造成有效会话或工具调用", async () => {
    const client: CanvasAgentApiClient = {
        async get<T>() { return { sessions: [{ id: "" }, null, "bad"] } as T; },
        async post<T>() { return { session: {} } as T; },
        async delete<T>() { return {} as T; },
    };
    const api = createCanvasAgentApi(client);
    assert.deepEqual(await api.listSessions(scope), []);
    await assert.rejects(() => api.createSession(scope), /缺少会话实体/);
});
