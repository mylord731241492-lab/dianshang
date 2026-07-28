import assert from "node:assert/strict";
import test from "node:test";

import {
    ASSET_ACCESS_URL_TTL_SECONDS,
    assetStorageKey,
    createAssetsApi,
    parseAssetStorageKey,
    readCloudAsset,
    readCloudAssetAccessUrl,
    readCloudAssetList,
} from "./assets-api.ts";

// 记录调用的假客户端与假上传通道，断言资产 API 的请求方法、路径与请求体。
type RecordedCall = { method: string; path: string; body?: unknown };

function createFakeClient(handler: (call: RecordedCall) => unknown) {
    const calls: RecordedCall[] = [];
    const invoke = async (method: string, path: string, body?: unknown) => {
        const call: RecordedCall = { method, path, body };
        calls.push(call);
        return handler(call);
    };
    const client = {
        get: <T>(path: string): Promise<T> => invoke("GET", path) as Promise<T>,
        post: <T>(path: string, body?: unknown): Promise<T> => invoke("POST", path, body) as Promise<T>,
        put: <T>(path: string, body?: unknown): Promise<T> => invoke("PUT", path, body) as Promise<T>,
        delete: <T>(path: string): Promise<T> => invoke("DELETE", path) as Promise<T>,
    };
    return { client, calls };
}

const sampleAsset = {
    id: "asset_srv_1",
    kind: "image",
    name: "像素.png",
    mimeType: "image/png",
    sizeBytes: 72,
    width: 32,
    height: 32,
    checksumSha256: "abc123",
    tags: ["素材"],
    source: "upload",
    status: "active",
    createdAt: "2026-07-27 08:00:00",
    updatedAt: "2026-07-27 08:00:00",
    accessUrl: "/api/asset-content/asset_srv_1?expires=1790000000&sig=deadbeef",
};

function createFakeTransport(handler: (input: { path: string; file: Blob; fileName: string }) => unknown) {
    const calls: { path: string; file: Blob; fileName: string }[] = [];
    const transport = async (input: { path: string; file: Blob; fileName: string }) => {
        calls.push(input);
        return handler(input);
    };
    return { transport, calls };
}

test("列表请求带 q/kind/cursor/limit 并解析 items 与 nextCursor", async () => {
    const { client, calls } = createFakeClient(() => ({ success: true, items: [sampleAsset], nextCursor: "cursor-2" }));
    const { transport } = createFakeTransport(() => ({}));
    const api = createAssetsApi(client, transport);
    const page = await api.list({ q: "像素", kind: "image", cursor: "cursor-1", limit: 12 });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.method, "GET");
    const path = calls[0]!.path;
    assert.ok(path.startsWith("/api/user/assets?"), `列表路径异常：${path}`);
    const search = new URLSearchParams(path.slice("/api/user/assets?".length));
    assert.equal(search.get("q"), "像素");
    assert.equal(search.get("kind"), "image");
    assert.equal(search.get("cursor"), "cursor-1");
    assert.equal(search.get("limit"), "12");
    assert.equal(page.items.length, 1);
    assert.equal(page.items[0]!.id, "asset_srv_1");
    assert.equal(page.nextCursor, "cursor-2");
});

test("列表 kind 白名单过滤与 limit 上限收敛", async () => {
    const { client, calls } = createFakeClient(() => ({ success: true, items: [], nextCursor: null }));
    const { transport } = createFakeTransport(() => ({}));
    const api = createAssetsApi(client, transport);
    await api.list({ kind: "exe", limit: 9999 });
    const search = new URLSearchParams(calls[0]!.path.split("?")[1]);
    assert.equal(search.get("kind"), null, "非法 kind 不得发给后端");
    assert.equal(search.get("limit"), "100", "limit 必须收敛到契约上限 100");
    assert.deepEqual(readCloudAssetList(null), { items: [], nextCursor: null });
    assert.deepEqual(readCloudAssetList({ success: true }), { items: [], nextCursor: null });
});

test("上传经注入的 multipart 通道，资产 ID 一律由服务器生成（asset_*）", async () => {
    const { client } = createFakeClient(() => ({}));
    const { transport, calls } = createFakeTransport(() => ({ success: true, asset: sampleAsset }));
    const api = createAssetsApi(client, transport);
    const asset = await api.upload(new Blob(["fake-png-bytes"], { type: "image/png" }), { name: "像素.png" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.path, "/api/user/assets/upload");
    assert.equal(calls[0]!.fileName, "像素.png");
    assert.equal(asset.id, "asset_srv_1");
    assert.match(asset.id, /^asset_/, "前端不得自行生成最终资产 ID");
    assert.equal(asset.kind, "image");
    assert.equal(asset.mimeType, "image/png");
});

test("storageKey 形态为 asset:<assetId>，可往返解析", () => {
    assert.equal(assetStorageKey("asset_1"), "asset:asset_1");
    assert.equal(parseAssetStorageKey("asset:asset_1"), "asset_1");
    assert.equal(parseAssetStorageKey("image:legacy"), null);
    assert.equal(parseAssetStorageKey("asset:"), null);
    assert.equal(parseAssetStorageKey(undefined), null);
});

test("access-url 只接受同源 /api/asset-content/ 签名路径", async () => {
    const { client, calls } = createFakeClient(() => ({
        success: true,
        url: "/api/asset-content/asset_srv_1?expires=1790000900&sig=deadbeef",
        expiresAt: "2026-07-27T08:15:00.000Z",
        expiresInSeconds: ASSET_ACCESS_URL_TTL_SECONDS,
    }));
    const { transport } = createFakeTransport(() => ({}));
    const api = createAssetsApi(client, transport);
    const access = await api.getAccessUrl("asset_srv_1");
    assert.equal(calls[0]!.path, "/api/user/assets/asset_srv_1/access-url");
    assert.ok(access.url.startsWith("/api/asset-content/"));
    assert.equal(access.expiresInSeconds, 900, "签名读取 URL 有效期必须为 15 分钟");

    // 外链、永久 URL、对象存储直连一律拒绝
    assert.equal(readCloudAssetAccessUrl({ url: "https://bucket.s3.example.com/x?X-Amz-Signature=1" }), null);
    assert.equal(readCloudAssetAccessUrl({ url: "asset_srv_1" }), null);
    assert.equal(readCloudAssetAccessUrl(null), null);
});

test("改名与标签走 PUT /api/user/assets/:id，只提交 name/tags", async () => {
    const { client, calls } = createFakeClient(() => ({ success: true, asset: { ...sampleAsset, name: "改名后.png", tags: ["新"] } }));
    const { transport } = createFakeTransport(() => ({}));
    const api = createAssetsApi(client, transport);
    const asset = await api.update("asset_srv_1", { name: "改名后.png", tags: ["新"] });
    assert.equal(calls[0]!.method, "PUT");
    assert.equal(calls[0]!.path, "/api/user/assets/asset_srv_1");
    assert.deepEqual(calls[0]!.body, { name: "改名后.png", tags: ["新"] });
    assert.equal(asset.name, "改名后.png");
    assert.deepEqual(asset.tags, ["新"]);
});

test("删除调用 DELETE（软删除语义），导入生成记录走 import-generation", async () => {
    const { client, calls } = createFakeClient((call) =>
        call.method === "DELETE" ? { success: true, deleted: true } : { success: true, asset: { ...sampleAsset, source: "generation" } },
    );
    const { transport } = createFakeTransport(() => ({}));
    const api = createAssetsApi(client, transport);
    await api.remove("asset_srv_1");
    assert.equal(calls[0]!.method, "DELETE");
    assert.equal(calls[0]!.path, "/api/user/assets/asset_srv_1");

    const imported = await api.importGeneration("gen_123");
    assert.equal(calls[1]!.method, "POST");
    assert.equal(calls[1]!.path, "/api/user/assets/import-generation");
    assert.deepEqual(calls[1]!.body, { generationId: "gen_123" });
    assert.equal(imported.source, "generation");
});

test("资产解析不携带存储密钥，readCloudAsset 兼容 { asset } 包裹与顶层形态", () => {
    const wrapped = readCloudAsset({ success: true, asset: sampleAsset });
    const flat = readCloudAsset(sampleAsset);
    assert.equal(wrapped!.id, "asset_srv_1");
    assert.equal(flat!.id, "asset_srv_1");
    assert.equal(readCloudAsset(null), null);
    const serialized = JSON.stringify(wrapped);
    assert.ok(!/secretAccessKey|accessKeyId|OBJECT_STORAGE_|sessionToken|presign/i.test(serialized), "资产实体不得包含对象存储凭据字段");
});
