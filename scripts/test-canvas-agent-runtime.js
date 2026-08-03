'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Database = require('better-sqlite3');

const { createCanvasAgentRepository } = require('../backend/canvas-agent/session-repository');
const { createCanvasAgentRuntime } = require('../backend/canvas-agent/runtime-service');

function createFixture(options = {}) {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      username TEXT,
      balance REAL DEFAULT 50,
      status TEXT DEFAULT 'active'
    );
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT,
      data TEXT DEFAULT '{}'
    );
  `);
  db.prepare("INSERT INTO users (id,username,balance,status) VALUES ('user_a','A',100,'active'),('user_b','B',100,'active')").run();
  db.prepare("INSERT INTO projects (id,user_id,name,data) VALUES ('project_a','user_a','A 画布','{}'),('project_b','user_b','B 画布','{}')").run();

  let idSequence = 0;
  const repository = createCanvasAgentRepository({
    db,
    now: options.now || (() => 1_800_000_000_000 + idSequence),
    idFactory: (prefix) => `${prefix}${++idSequence}`
  });
  const planner = options.planner || {
    async plan(input) {
      if (input.message.includes('读取')) {
        if (!input.toolResults?.length) {
          return { text: '', toolCalls: [{ name: 'canvas_get_state', input: {} }] };
        }
        return { text: `当前有 ${input.toolResults[0].result.nodes.length} 个节点`, toolCalls: [] };
      }
      return {
        text: '我准备创建两个文本节点并连接。',
        toolCalls: [{
          name: 'canvas_apply_ops',
          input: {
            ops: [
              { type: 'add_node', id: 'agent_text_a', nodeType: 'text', title: '卖点', x: 0, y: 0, metadata: { content: '轻盈' } },
              { type: 'add_node', id: 'agent_text_b', nodeType: 'text', title: '文案', x: 420, y: 0, metadata: { content: '夏日通勤' } },
              { type: 'connect_nodes', id: 'agent_edge_a_b', fromNodeId: 'agent_text_a', toNodeId: 'agent_text_b' }
            ]
          }
        }]
      };
    }
  };
  const siteExecutions = [];
  const runtime = createCanvasAgentRuntime({
    repository,
    planner,
    siteTools: {
      async execute(input) {
        siteExecutions.push(input);
        return { ok: true, taskId: input.callId };
      }
    }
  });
  runtime.start();
  return { db, repository, runtime, siteExecutions };
}

function scope(overrides = {}) {
  return {
    userId: overrides.userId || 'user_a',
    projectId: overrides.projectId || 'project_a',
    browserSessionId: overrides.browserSessionId || 'browser_a',
    sessionId: overrides.sessionId || ''
  };
}

function snapshot(nodeCount = 0) {
  return {
    projectId: 'project_a',
    title: 'A 画布',
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `node_${index + 1}`,
      type: 'text',
      title: `节点 ${index + 1}`,
      position: { x: index * 100, y: 0 },
      width: 320,
      height: 220,
      metadata: { content: `内容 ${index + 1}` }
    })),
    connections: [],
    selectedNodeIds: [],
    viewport: { x: 0, y: 0, k: 1 }
  };
}

test('写操作先产生提案，重复确认只允许浏览器执行一次，结果可恢复', async () => {
  const { runtime } = createFixture();
  const session = runtime.createSession({ ...scope(), title: '主会话' });

  const turn = await runtime.sendMessage({
    ...scope({ sessionId: session.id }),
    text: '创建两个文本节点并连接',
    snapshot: snapshot()
  });

  assert.equal(turn.session.status, 'waiting_confirmation');
  assert.equal(turn.toolCalls.length, 1);
  assert.equal(turn.toolCalls[0].status, 'pending');
  assert.equal(turn.toolCalls[0].execution.kind, 'canvas_ops');
  assert.deepEqual(turn.toolCalls[0].execution.ops.map((item) => item.type), ['add_node', 'add_node', 'connect_nodes']);

  const approved = await runtime.confirmToolCall({ ...scope({ sessionId: session.id }), callId: turn.toolCalls[0].id });
  assert.equal(approved.execute, true);
  assert.equal(approved.replayed, false);

  const replayed = await runtime.confirmToolCall({ ...scope({ sessionId: session.id }), callId: turn.toolCalls[0].id });
  assert.equal(replayed.execute, false);
  assert.equal(replayed.replayed, true);

  const recorded = runtime.reportToolResult({
    ...scope({ sessionId: session.id }),
    callId: turn.toolCalls[0].id,
    result: { ok: true, nodeCount: 2, connectionCount: 1 }
  });
  assert.equal(recorded.toolCall.status, 'executed');
  assert.equal(recorded.session.status, 'idle');

  const restored = runtime.getSession(scope({ sessionId: session.id }));
  assert.equal(restored.toolCalls[0].status, 'executed');
  assert.equal(restored.events.some((event) => event.type === 'tool_executed'), true);
});

test('拒绝写操作后不返回执行载荷，重复拒绝幂等', async () => {
  const { runtime } = createFixture();
  const session = runtime.createSession(scope());
  const turn = await runtime.sendMessage({
    ...scope({ sessionId: session.id }),
    text: '创建节点',
    snapshot: snapshot()
  });

  const rejected = runtime.rejectToolCall({
    ...scope({ sessionId: session.id }),
    callId: turn.toolCalls[0].id,
    reason: '暂时不要修改'
  });
  assert.equal(rejected.toolCall.status, 'rejected');
  assert.equal(rejected.execute, false);
  const replayed = runtime.rejectToolCall({
    ...scope({ sessionId: session.id }),
    callId: turn.toolCalls[0].id,
    reason: '重复拒绝'
  });
  assert.equal(replayed.replayed, true);
  assert.equal(runtime.getSession(scope({ sessionId: session.id })).session.status, 'idle');
});

test('读取工具自动执行并继续生成最终答复，不要求确认', async () => {
  const { runtime } = createFixture();
  const session = runtime.createSession(scope());
  const turn = await runtime.sendMessage({
    ...scope({ sessionId: session.id }),
    text: '读取画布状态',
    snapshot: snapshot(2)
  });
  assert.equal(turn.toolCalls.length, 0);
  assert.equal(turn.session.status, 'idle');
  assert.equal(turn.events.some((event) => event.type === 'tool_executed'), true);
  assert.equal(turn.events.some((event) => event.type === 'assistant_message' && event.payload.text.includes('2 个节点')), true);
});

test('会话、事件与工具确认按用户、项目和浏览器标签页隔离', async () => {
  const { runtime } = createFixture();
  const session = runtime.createSession(scope());
  const turn = await runtime.sendMessage({
    ...scope({ sessionId: session.id }),
    text: '创建节点',
    snapshot: snapshot()
  });

  assert.throws(
    () => runtime.getSession(scope({ userId: 'user_b', projectId: 'project_b', browserSessionId: 'browser_b', sessionId: session.id })),
    (error) => error.code === 'CANVAS_AGENT_SESSION_NOT_FOUND'
  );
  await assert.rejects(
    () => runtime.confirmToolCall({
      ...scope({ userId: 'user_b', projectId: 'project_b', browserSessionId: 'browser_b', sessionId: session.id }),
      callId: turn.toolCalls[0].id
    }),
    (error) => error.code === 'CANVAS_AGENT_TOOL_CALL_NOT_FOUND'
  );
});

test('停止正在执行的规划请求并写入安全终态', async () => {
  let releasePlanner;
  const planner = {
    plan({ signal }) {
      return new Promise((resolve, reject) => {
        releasePlanner = resolve;
        signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        }, { once: true });
      });
    }
  };
  const { runtime } = createFixture({ planner });
  const session = runtime.createSession(scope());
  const pending = runtime.sendMessage({
    ...scope({ sessionId: session.id }),
    text: '执行一个较长任务',
    snapshot: snapshot()
  });

  await Promise.resolve();
  const stopped = runtime.stopSession(scope({ sessionId: session.id }));
  assert.equal(stopped.session.status, 'stopped');
  const result = await pending;
  assert.equal(result.session.status, 'stopped');
  assert.equal(runtime.getSession(scope({ sessionId: session.id })).events.some((event) => event.type === 'turn_stopped'), true);
  releasePlanner?.({ text: '', toolCalls: [] });
});

test('事件日志脱敏 token、密码与 data URL，会话可删除', async () => {
  const { runtime, repository } = createFixture();
  const session = runtime.createSession(scope());
  repository.appendEvent({
    ...scope({ sessionId: session.id }),
    type: 'diagnostic',
    payload: {
      authorization: 'Bearer secret-token',
      password: 'secret-password',
      image: 'data:image/png;base64,AAAA',
      nested: { connectToken: 'connect-secret' }
    }
  });
  const events = runtime.getSession(scope({ sessionId: session.id })).events;
  const serialized = JSON.stringify(events);
  assert.equal(serialized.includes('secret-token'), false);
  assert.equal(serialized.includes('secret-password'), false);
  assert.equal(serialized.includes('base64,AAAA'), false);
  assert.equal(serialized.includes('connect-secret'), false);

  runtime.deleteSession(scope({ sessionId: session.id }));
  assert.throws(
    () => runtime.getSession(scope({ sessionId: session.id })),
    (error) => error.code === 'CANVAS_AGENT_SESSION_NOT_FOUND'
  );
});

test('进程恢复把运行中会话和已确认未回执工具置为 interrupted，绝不自动重放', async () => {
  const { db, repository, runtime } = createFixture();
  const session = runtime.createSession(scope());
  repository.updateSessionStatus(scope({ sessionId: session.id }), 'running');
  repository.insertToolCall({
    ...scope({ sessionId: session.id }),
    id: 'call_interrupted',
    name: 'canvas_apply_ops',
    input: { ops: [] },
    summary: '待恢复',
    execution: { kind: 'canvas_ops', ops: [] },
    status: 'approved'
  });

  const recoveredRepository = createCanvasAgentRepository({ db });
  const recoveredRuntime = createCanvasAgentRuntime({
    repository: recoveredRepository,
    planner: { async plan() { return { text: '', toolCalls: [] }; } },
    siteTools: { async execute() { throw new Error('不应自动执行'); } }
  });
  const recovered = recoveredRuntime.start();
  assert.equal(recovered.sessions, 1);
  assert.equal(recovered.toolCalls, 1);
  const restored = recoveredRuntime.getSession(scope({ sessionId: session.id }));
  assert.equal(restored.session.status, 'interrupted');
  assert.equal(restored.toolCalls[0].status, 'interrupted');
});
