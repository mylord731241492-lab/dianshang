'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { createCanvasAgentPlanner } = require('../backend/canvas-agent/provider-planner');

function plannerInput(overrides = {}) {
  return {
    userId: 'user_a',
    projectId: 'project_a',
    sessionId: 'session_a',
    browserSessionId: 'browser_a',
    message: overrides.message || '创建一个文本节点',
    history: overrides.history || [],
    snapshot: overrides.snapshot || {
      projectId: 'project_a',
      title: '测试画布',
      nodes: [],
      connections: [],
      selectedNodeIds: [],
      viewport: { x: 0, y: 0, k: 1 }
    },
    attachments: overrides.attachments || [],
    toolDefinitions: [{ type: 'function', name: 'canvas_create_text_node', description: '创建文本节点', parameters: { type: 'object', properties: { text: { type: 'string' } } } }],
    toolResults: overrides.toolResults || [],
    signal: new AbortController().signal
  };
}

test('解析 Responses API 的文本和 function_call，并把工具 schema 交给 Provider', async () => {
  let providerRequest;
  const planner = createCanvasAgentPlanner({
    async callProvider(input, options) {
      providerRequest = { input, options };
      return {
        success: true,
        output: [
          { type: 'message', content: [{ type: 'output_text', text: '我先创建节点。' }] },
          { type: 'function_call', call_id: 'provider_call_1', name: 'canvas_create_text_node', arguments: '{"text":"卖点"}' }
        ]
      };
    },
    providerOptions: () => ({ route: { id: 'lingsuan' }, model: 'gpt-5.6-terra' })
  });
  const result = await planner.plan(plannerInput());
  assert.equal(result.text, '我先创建节点。');
  assert.deepEqual(result.toolCalls, [{ id: 'provider_call_1', name: 'canvas_create_text_node', input: { text: '卖点' } }]);
  assert.equal(providerRequest.options.tools[0].name, 'canvas_create_text_node');
  assert.equal(providerRequest.options.route.id, 'lingsuan');
  assert.equal(JSON.stringify(providerRequest.input).includes('Local URL'), true);
  assert.equal(JSON.stringify(providerRequest.input).includes('secret'), false);
});

test('兼容 Chat Completions tool_calls 响应', async () => {
  const planner = createCanvasAgentPlanner({
    async callProvider() {
      return {
        success: true,
        choices: [{
          message: {
            role: 'assistant',
            content: '准备更新。',
            tool_calls: [{
              id: 'chat_call_1',
              type: 'function',
              function: { name: 'canvas_update_node_text', arguments: '{"id":"node_1","text":"新文案"}' }
            }]
          }
        }]
      };
    }
  });
  const result = await planner.plan(plannerInput());
  assert.equal(result.text, '准备更新。');
  assert.deepEqual(result.toolCalls[0], {
    id: 'chat_call_1',
    name: 'canvas_update_node_text',
    input: { id: 'node_1', text: '新文案' }
  });
});

test('Fake Provider 提供可人工验收的确定性画布提案，不触发真实调用', async () => {
  const planner = createCanvasAgentPlanner({
    async callProvider() {
      return { success: true, mock: true, output_text: '本地 mock' };
    }
  });
  const result = await planner.plan(plannerInput({ message: '创建两个文本节点并连接' }));
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].name, 'canvas_apply_ops');
  assert.deepEqual(result.toolCalls[0].input.ops.map((item) => item.type), ['add_node', 'add_node', 'connect_nodes']);

  const asciiSmokeResult = await planner.plan(plannerInput({ message: 'create two text nodes and connect' }));
  assert.deepEqual(asciiSmokeResult.toolCalls[0].input.ops.map((item) => item.type), ['add_node', 'add_node', 'connect_nodes']);
});

test('Provider 失败保留错误码，畸形工具参数被拒绝', async () => {
  const failedPlanner = createCanvasAgentPlanner({
    async callProvider() {
      return { success: false, code: 'PROVIDER_TIMEOUT', message: '上游超时' };
    }
  });
  await assert.rejects(
    () => failedPlanner.plan(plannerInput()),
    (error) => error.code === 'PROVIDER_TIMEOUT' && error.message === '上游超时'
  );

  const malformedPlanner = createCanvasAgentPlanner({
    async callProvider() {
      return {
        success: true,
        output: [{ type: 'function_call', name: 'canvas_create_text_node', arguments: '{bad-json' }]
      };
    }
  });
  await assert.rejects(
    () => malformedPlanner.plan(plannerInput()),
    (error) => error.code === 'CANVAS_AGENT_PROVIDER_TOOL_ARGUMENTS_INVALID'
  );
});
