// Task 12 契约测试：旧版画布项目 → hjm.infinite-canvas.project v1 信封的非破坏性转换。
// 覆盖：原 fixture 不被修改（前后哈希一致）、信封结构、节点/连线/视口数量、
// data:image 必须先上传否则拒绝、blob:/本机绝对路径剥离并记 warning。
// 运行：node --experimental-strip-types --test "src/integrations/hajimi/*.test.ts"
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { convertLegacyProject, type LegacyImageUploadResult } from "./legacy-project-import.ts";
import { isProjectEnvelope } from "./project-schema.ts";

const FIXTURE_DIR = new URL("../../../../../../scripts/fixtures/canvas-projects/", import.meta.url);

function readFixture(name: string): { raw: unknown; hash: () => string } {
    const url = new URL(name, FIXTURE_DIR);
    const hash = () => createHash("sha256").update(readFileSync(url)).digest("hex");
    return { raw: JSON.parse(readFileSync(url, "utf8")), hash };
}

// 假上传：记录每次调用的 dataUrl，返回合成 assetId，断言转换器绝不把 data: 原样写入信封。
function createFakeUploader() {
    const calls: string[] = [];
    const upload = async (dataUrl: string): Promise<LegacyImageUploadResult> => {
        calls.push(dataUrl);
        const assetId = `asset_fake_${calls.length}`;
        return { assetId, storageKey: `asset:${assetId}`, url: "", width: 2, height: 2, bytes: 75, mimeType: "image/png" };
    };
    return { upload, calls };
}

function envelopeText(envelope: unknown): string {
    return JSON.stringify(envelope);
}

type FixtureExpectation = {
    file: string;
    nodes: number;
    connections: number;
    viewport: { x: number; y: number; k: number };
    uploads: number;
    warningIncludes: string[];
};

const FIXTURES: FixtureExpectation[] = [
    { file: "empty-project.sanitized.json", nodes: 0, connections: 0, viewport: { x: 0, y: 0, k: 1 }, uploads: 0, warningIncludes: [] },
    { file: "text-and-image-nodes.sanitized.json", nodes: 2, connections: 0, viewport: { x: -40, y: 12, k: 0.8 }, uploads: 1, warningIncludes: [] },
    { file: "generation-node.sanitized.json", nodes: 2, connections: 0, viewport: { x: 0, y: 0, k: 1 }, uploads: 0, warningIncludes: [] },
    { file: "connected-nodes.sanitized.json", nodes: 2, connections: 1, viewport: { x: 10, y: -20, k: 1.25 }, uploads: 0, warningIncludes: [] },
    { file: "ten-nodes-nine-images.sanitized.json", nodes: 10, connections: 3, viewport: { x: -200, y: -100, k: 0.6 }, uploads: 9, warningIncludes: [] },
    {
        file: "legacy-chat-state.sanitized.json",
        nodes: 1,
        connections: 0,
        viewport: { x: 0, y: 0, k: 1 },
        uploads: 0,
        warningIncludes: ["storage", "images"],
    },
];

for (const expected of FIXTURES) {
    test(`fixture ${expected.file}：非破坏性转换为 v1 信封`, async () => {
        const { raw, hash } = readFixture(expected.file);
        const before = hash();
        const { upload, calls } = createFakeUploader();

        const result = await convertLegacyProject(raw, { uploadImage: upload });

        assert.equal(hash(), before, "转换不得修改原 fixture 文件");
        assert.ok(isProjectEnvelope(result.envelope), "输出必须是 hjm.infinite-canvas.project v1 信封");
        assert.equal(result.envelope.schemaVersion, 1);
        assert.equal(result.envelope.engine, "infinite-canvas");

        const project = result.envelope.project;
        assert.equal(project.nodes.length, expected.nodes, "可转换节点数量");
        assert.equal(project.connections.length, expected.connections, "可转换连线数量");
        assert.deepEqual(project.viewport, expected.viewport, "视口 {x, y, zoom} 应映射为 {x, y, k}");
        assert.equal(project.chatSessions.length, expected.file === "legacy-chat-state.sanitized.json" ? 1 : 0);

        assert.equal(calls.length, expected.uploads, "data:image 节点必须先经上传函数");
        assert.equal(result.stats.imagesUploaded, expected.uploads);
        assert.ok(!envelopeText(result.envelope).includes("data:image"), "信封绝不允许内联 data:image");
        for (const fragment of expected.warningIncludes) {
            assert.ok(
                result.warnings.some((warning) => warning.includes(fragment)),
                `warnings 应包含「${fragment}」，实际：${JSON.stringify(result.warnings)}`,
            );
        }
    });
}

test("data:image 节点在上传后保存 assetId 引用而非内联数据", async () => {
    const { raw } = readFixture("text-and-image-nodes.sanitized.json");
    const { upload, calls } = createFakeUploader();
    const result = await convertLegacyProject(raw, { uploadImage: upload });

    assert.equal(calls.length, 1);
    assert.ok(calls[0]!.startsWith("data:image/png;base64,"), "上传函数收到的应是原始 dataUrl");
    const imageNode = result.envelope.project.nodes.find((node) => (node as { id?: unknown }).id === "node_1") as {
        type?: unknown;
        metadata?: { storageKey?: unknown; content?: unknown };
    };
    assert.equal(imageNode.type, "image");
    assert.equal(imageNode.metadata?.storageKey, "asset:asset_fake_1");
    assert.ok(!String(imageNode.metadata?.content ?? "").startsWith("data:"), "节点 content 不得保留 data:");
    assert.deepEqual(result.envelope.references?.assetIds, ["asset_fake_1"]);
});

test("未注入上传函数时 data:image 节点被拒绝转换并记 warning", async () => {
    const { raw } = readFixture("unsafe-references.sanitized.json");
    const result = await convertLegacyProject(raw);

    const inlineNode = result.envelope.project.nodes.find((node) => (node as { id?: unknown }).id === "node_inline");
    assert.equal(inlineNode, undefined, "不允许上传时内联图节点必须被拒绝");
    assert.ok(result.warnings.some((warning) => warning.includes("node_inline") && warning.includes("data:")));
    assert.ok(!envelopeText(result.envelope).includes("data:image"));
});

test("blob: 与本机绝对路径引用被剥离并记 warning，绝不原样写入信封", async () => {
    const { raw, hash } = readFixture("unsafe-references.sanitized.json");
    const before = hash();
    const { upload } = createFakeUploader();
    const result = await convertLegacyProject(raw, { uploadImage: upload });

    assert.equal(hash(), before);
    const text = envelopeText(result.envelope);
    assert.ok(!text.includes("blob:"), "blob: 引用不得进入信封");
    assert.ok(!text.includes("C:\\synthetic"), "本机绝对路径不得进入信封");
    assert.ok(!text.includes("data:image"), "data:image 不得进入信封");
    assert.ok(result.warnings.some((warning) => warning.includes("node_blob") && warning.includes("blob:")));
    assert.ok(result.warnings.some((warning) => warning.includes("node_abspath")));
});

test("旧 Chat 状态映射为 assistant 会话，消息图片引用剥离并记 warning", async () => {
    const { raw } = readFixture("legacy-chat-state.sanitized.json");
    const result = await convertLegacyProject(raw);

    const sessions = result.envelope.project.chatSessions as Array<{ id?: unknown; messages?: Array<{ role?: unknown; text?: unknown }> }>;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]!.id, "chat_synthetic_1");
    assert.equal(sessions[0]!.messages?.length, 2);
    assert.equal(sessions[0]!.messages?.[0]?.role, "user");
    assert.equal(sessions[0]!.messages?.[1]?.role, "assistant");
    assert.equal(result.envelope.project.activeChatId, null);
});

test("无法识别的输入整体拒绝：空对象转换为空项目并记 warning", async () => {
    const result = await convertLegacyProject({ totally: "unknown" });
    assert.ok(isProjectEnvelope(result.envelope));
    assert.equal(result.envelope.project.nodes.length, 0);
    assert.ok(result.warnings.length > 0, "缺少 nodes 的旧数据应产生 warning");
});
