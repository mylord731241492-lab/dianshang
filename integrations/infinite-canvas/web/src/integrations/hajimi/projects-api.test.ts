import assert from "node:assert/strict";
import test from "node:test";

import {
    deserializeProjectEnvelope,
    isProjectEnvelope,
    serializeProjectEnvelope,
    UnsafeProjectContentError,
} from "./project-schema.ts";
import { createProjectsApi, readProjectEntity, readProjectList } from "./projects-api.ts";

// 记录调用的假客户端，断言项目仓库的请求方法与请求体。
type RecordedCall = { method: string; path: string; body?: unknown };

function createFakeClient(handler: (call: RecordedCall) => unknown) {
    const calls: RecordedCall[] = [];
    const invoke = async (method: string, path: string, body?: unknown) => {
        const call: RecordedCall = { method, path, body };
        calls.push(call);
        return handler(call);
    };
    const client = {
        request: <T>(path: string, options?: { method?: string; body?: unknown }): Promise<T> =>
            invoke(options?.method ?? "GET", path, options?.body) as Promise<T>,
        get: <T>(path: string): Promise<T> => invoke("GET", path) as Promise<T>,
        post: <T>(path: string, body?: unknown): Promise<T> => invoke("POST", path, body) as Promise<T>,
        put: <T>(path: string, body?: unknown): Promise<T> => invoke("PUT", path, body) as Promise<T>,
        delete: <T>(path: string): Promise<T> => invoke("DELETE", path) as Promise<T>,
    };
    return { client, calls };
}

const sampleListItem = { id: "proj_1", name: "画布一", thumbnail: "", updatedAt: "2026-07-27 08:00:00", createdAt: "2026-07-27 07:00:00" };

function sampleEnvelope() {
    return serializeProjectEnvelope({
        nodes: [{ id: "node-1", type: "text", metadata: { content: "hello" } }],
        connections: [{ id: "conn-1", fromNodeId: "node-1", toNodeId: "node-2" }],
        chatSessions: [],
        activeChatId: null,
        backgroundMode: "lines",
        showImageInfo: false,
        viewport: { x: 1, y: 2, k: 1.5 },
    });
}

test("列表兼容读取 items/projects/list/data 多种包裹，内部统一为 items", () => {
    for (const key of ["items", "projects", "list", "data"]) {
        const payload: Record<string, unknown> = { success: true };
        payload[key] = [sampleListItem];
        const items = readProjectList(payload);
        assert.equal(items.length, 1, `包裹字段 ${key} 应被识别`);
        assert.equal(items[0]!.id, "proj_1");
        assert.equal(items[0]!.name, "画布一");
    }
    assert.deepEqual(readProjectList({ success: true }), []);
    assert.deepEqual(readProjectList(null), []);
});

test("创建发送 { name, data: envelope }，并使用服务器返回的 proj_* id", async () => {
    const envelope = sampleEnvelope();
    const { client, calls } = createFakeClient(() => ({
        success: true,
        id: "proj_server_1",
        name: "无限画布 1",
        data: envelope,
        createdAt: "2026-07-27 08:00:00",
        project: { id: "proj_server_1", name: "无限画布 1", data: envelope, createdAt: "2026-07-27 08:00:00" },
    }));
    const api = createProjectsApi(client);
    const created = await api.create({ name: "无限画布 1", data: envelope });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "POST");
    assert.equal(calls[0]!.path, "/api/user/projects");
    const body = calls[0]!.body as { name?: unknown; data?: unknown };
    assert.equal(body.name, "无限画布 1");
    assert.deepEqual(body.data, envelope);
    // 不自己生成 id，必须使用服务器返回值
    assert.equal(created.id, "proj_server_1");
    assert.match(created.id, /^proj_/);
});

test("详情读取 { project } 包裹与顶层字段两种形态", async () => {
    const envelope = sampleEnvelope();
    const { client: wrappedClient } = createFakeClient(() => ({
        success: true,
        project: { id: "proj_2", name: "画布二", data: envelope, createdAt: "2026-07-27 08:00:00", updatedAt: "2026-07-27 09:00:00" },
    }));
    const wrapped = await createProjectsApi(wrappedClient).get("proj_2");
    assert.equal(wrapped.id, "proj_2");
    assert.deepEqual(wrapped.data, envelope);

    const { client: flatClient } = createFakeClient(() => ({
        success: true,
        id: "proj_3",
        name: "画布三",
        data: envelope,
        createdAt: "2026-07-27 08:00:00",
        updatedAt: "2026-07-27 09:00:00",
    }));
    const flat = await createProjectsApi(flatClient).get("proj_3");
    assert.equal(flat.id, "proj_3");
    assert.deepEqual(flat.data, envelope);

    assert.equal(readProjectEntity(null), null);
});

test("更新发送 PUT { name, data: envelope }", async () => {
    const envelope = sampleEnvelope();
    const { client, calls } = createFakeClient(() => ({ success: true, id: "proj_4", name: "改名后", data: envelope }));
    await createProjectsApi(client).update("proj_4", { name: "改名后", data: envelope });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "PUT");
    assert.equal(calls[0]!.path, "/api/user/projects/proj_4");
    const body = calls[0]!.body as { name?: unknown; data?: unknown };
    assert.equal(body.name, "改名后");
    assert.deepEqual(body.data, envelope);
});

test("删除调用 DELETE /api/user/projects/:id", async () => {
    const { client, calls } = createFakeClient(() => ({ success: true }));
    await createProjectsApi(client).remove("proj_5");
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "DELETE");
    assert.equal(calls[0]!.path, "/api/user/projects/proj_5");
});

test("序列化 envelope 符合计划第 2 章 schema", () => {
    const envelope = sampleEnvelope();
    assert.equal(envelope.schema, "hjm.infinite-canvas.project");
    assert.equal(envelope.schemaVersion, 1);
    assert.equal(envelope.engine, "infinite-canvas");
    assert.equal(envelope.upstreamVersion, "0.10.0");
    assert.equal(envelope.project.activeChatId, null);
    assert.equal(envelope.project.backgroundMode, "lines");
    assert.equal(envelope.project.showImageInfo, false);
    assert.deepEqual(envelope.project.viewport, { x: 1, y: 2, k: 1.5 });
    assert.ok(isProjectEnvelope(envelope));
    const roundTrip = deserializeProjectEnvelope(envelope);
    assert.equal(roundTrip.kind, "envelope");
    if (roundTrip.kind === "envelope") assert.deepEqual(roundTrip.project, envelope.project);
});

test("序列化结果不含 data:image/、blob:、Windows 绝对路径", () => {
    // blob: 对象 URL 只是本会话临时引用，有序列化时应剥离，由 storageKey 恢复
    const envelope = serializeProjectEnvelope({
        nodes: [{ id: "node-img", type: "image", metadata: { content: "blob:http://127.0.0.1/abc", storageKey: "image:xyz" } }],
        connections: [],
        chatSessions: [],
        activeChatId: null,
        backgroundMode: "lines",
        showImageInfo: false,
        viewport: { x: 0, y: 0, k: 1 },
    });
    const json = JSON.stringify(envelope);
    assert.ok(!json.includes("blob:"), "序列化结果不得包含 blob: URL");
    assert.ok(!json.includes("data:image/"), "序列化结果不得包含 data:image/");
    assert.ok(!/[A-Za-z]:[\\\\/]/.test(json.replaceAll("https://", "").replaceAll("http://", "")), "序列化结果不得包含 Windows 绝对路径");
    const imageNode = envelope.project.nodes[0] as { metadata: { content: string; storageKey: string } };
    assert.equal(imageNode.metadata.storageKey, "image:xyz");
    assert.equal(imageNode.metadata.content, "");

    // data: 大圖与本机绝对路径一律拒绝写入服务器
    assert.throws(
        () =>
            serializeProjectEnvelope({
                nodes: [{ id: "n", type: "image", metadata: { content: "data:image/png;base64,AAA" } }],
                connections: [],
                chatSessions: [],
                activeChatId: null,
                backgroundMode: "lines",
                showImageInfo: false,
                viewport: { x: 0, y: 0, k: 1 },
            }),
        UnsafeProjectContentError,
    );
    assert.throws(
        () =>
            serializeProjectEnvelope({
                nodes: [{ id: "n", type: "text", metadata: { content: String.raw`F:\dianshang\secret.png` } }],
                connections: [],
                chatSessions: [],
                activeChatId: null,
                backgroundMode: "lines",
                showImageInfo: false,
                viewport: { x: 0, y: 0, k: 1 },
            }),
        UnsafeProjectContentError,
    );
});

test("无法识别的 data 标记为 legacy，不抛弃原数据", () => {
    const legacyData = { nodes: [{ old: true }], storage: "legacy-vue-canvas" };
    const result = deserializeProjectEnvelope(legacyData);
    assert.equal(result.kind, "legacy");
    if (result.kind === "legacy") assert.deepEqual(result.raw, legacyData);
    assert.ok(!isProjectEnvelope(legacyData));
    assert.ok(!isProjectEnvelope(null));
    assert.ok(!isProjectEnvelope("hjm.infinite-canvas.project"));
});
