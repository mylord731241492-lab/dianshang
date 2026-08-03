'use strict';

// 画布基本生图逻辑对齐：图片节点只提供参考图，生图节点自带提示词/参数/结果。
// Agent 图片流程不得再为提示词额外创建文本节点。

const assert = require('node:assert/strict');
const test = require('node:test');

const { prepareToolCall, toolDescriptions } = require('../backend/canvas-agent/tool-contracts');

function makeContext() {
  let seq = 0;
  return {
    callId: 'call_test',
    attachments: [],
    snapshot: {
      projectId: 'project_a',
      title: '测试画布',
      nodes: [{ id: 'img_1', type: 'image', title: '参考图', position: { x: 0, y: 0 }, metadata: { content: '/api/asset-content/asset_1', storageKey: 'asset:asset_1' } }],
      connections: [],
      selectedNodeIds: [],
      viewport: { x: 0, y: 0, k: 1 }
    },
    idFactory: (prefix) => `${prefix}${++seq}`
  };
}

test('图片生成流程只创建生图节点，提示词直接写入本节点', () => {
  const call = prepareToolCall('canvas_generate_image', { prompt: '白底商品图' }, makeContext());
  const ops = call.execution.ops;
  assert.deepEqual(ops.map((op) => op.type), ['add_node', 'select_nodes', 'run_generation']);
  const node = ops[0];
  assert.equal(node.nodeType, 'config');
  assert.equal(node.title, '生图节点');
  assert.equal(node.metadata.composerContent, '白底商品图');
  assert.equal(JSON.stringify(ops).includes('@[node:'), false);
  assert.equal(ops.some((op) => op.nodeType === 'text'), false);
  assert.equal(ops[2].nodeId, node.id);
  assert.equal(ops[2].prompt, '白底商品图');
});

test('图片生成流程把参考图图片节点连线到生图节点', () => {
  const call = prepareToolCall('canvas_generate_image', { prompt: '参考这件商品', referenceNodeIds: ['img_1'] }, makeContext());
  const ops = call.execution.ops;
  assert.deepEqual(ops.map((op) => op.type), ['add_node', 'connect_nodes', 'select_nodes', 'run_generation']);
  assert.equal(ops[1].fromNodeId, 'img_1');
  assert.equal(ops[1].toNodeId, ops[0].id);
});

test('生图节点默认标题与工具描述使用当前节点叫法', () => {
  const call = prepareToolCall('canvas_create_config_node', { prompt: '测试' }, makeContext());
  assert.equal(call.execution.ops[0].title, '生图节点');
  assert.match(toolDescriptions.canvas_create_config_node, /生图节点/);
  assert.match(toolDescriptions.canvas_generate_image, /生图节点/);
  assert.equal(JSON.stringify(toolDescriptions).includes('生成配置节点'), false);
});

test('非图片生成流程保留文本节点提示词结构', () => {
  const call = prepareToolCall('canvas_generate_text', { prompt: '写一段文案' }, makeContext());
  const ops = call.execution.ops;
  assert.equal(ops.some((op) => op.nodeType === 'text'), true);
  assert.equal(ops.some((op) => op.nodeType === 'config'), true);
});

test('反推工具解析指定、选中或首个图片节点', () => {
  const byId = prepareToolCall('canvas_reverse_image_prompt', { nodeId: 'img_1' }, makeContext());
  assert.deepEqual(byId.execution.ops, [{ type: 'reverse_prompt', nodeId: 'img_1' }]);

  const context = makeContext();
  context.snapshot.selectedNodeIds = ['img_1'];
  const bySelection = prepareToolCall('canvas_reverse_image_prompt', {}, context);
  assert.deepEqual(bySelection.execution.ops, [{ type: 'reverse_prompt', nodeId: 'img_1' }]);

  const fallback = prepareToolCall('canvas_reverse_image_prompt', {}, makeContext());
  assert.deepEqual(fallback.execution.ops, [{ type: 'reverse_prompt', nodeId: 'img_1' }]);
});

test('反推工具在没有图片节点时明确报错', () => {
  const context = makeContext();
  context.snapshot.nodes = [];
  assert.throws(
    () => prepareToolCall('canvas_reverse_image_prompt', {}, context),
    (error) => error.code === 'CANVAS_AGENT_REVERSE_SOURCE_NOT_FOUND'
  );
});
