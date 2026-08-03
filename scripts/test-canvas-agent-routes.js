'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const Database = require('better-sqlite3');
const express = require('express');

const { registerCanvasAgentRoutes } = require('../backend/canvas-agent/routes');
const { createCanvasAgentRepository } = require('../backend/canvas-agent/session-repository');
const { createCanvasAgentRuntime } = require('../backend/canvas-agent/runtime-service');

async function createServer() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT, data TEXT DEFAULT '{}');
    INSERT INTO projects (id,user_id,name,data) VALUES
      ('project_a','user_a','A 画布','{}'),
      ('project_b','user_b','B 画布','{}');
  `);
  const repository = createCanvasAgentRepository({ db });
  const runtime = createCanvasAgentRuntime({
    repository,
    planner: {
      async plan() {
        return {
          text: '准备修改画布',
          toolCalls: [{
            name: 'canvas_create_text_node',
            input: { text: '测试节点', title: '测试' }
          }]
        };
      }
    },
    siteTools: { async execute() { return { ok: true }; } }
  });
  runtime.start();

  const app = express();
  app.use(express.json());
  const auth = (req, res, next) => {
    const userId = String(req.headers['x-test-user'] || '');
    if (!userId) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: '缺少测试用户' });
    req.user = { userId };
    next();
  };
  registerCanvasAgentRoutes(app, {
    auth,
    runtime,
    assertProjectAccess(userId, projectId) {
      const row = db.prepare('SELECT id FROM projects WHERE id=? AND user_id=?').get(projectId, userId);
      if (!row) {
        const error = new Error('项目不存在');
        error.status = 404;
        error.code = 'CANVAS_AGENT_PROJECT_NOT_FOUND';
        throw error;
      }
    }
  });
  app.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({
      success: false,
      code: error.code || 'SERVER_ERROR',
      message: error.message || '服务器错误'
    });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    baseUrl,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

async function jsonRequest(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.userId ? { 'X-Test-User': options.userId } : {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const body = await response.json();
  return { response, body };
}

test('Agent HTTP 契约完成新建、发消息、确认、回执、恢复与删除', async (t) => {
  const server = await createServer();
  t.after(server.close);
  const scope = { projectId: 'project_a', browserSessionId: 'browser_a' };

  const created = await jsonRequest(server.baseUrl, '/api/canvas/agent/sessions', {
    method: 'POST',
    userId: 'user_a',
    body: scope
  });
  assert.equal(created.response.status, 201);
  const sessionId = created.body.session.id;

  const sent = await jsonRequest(server.baseUrl, `/api/canvas/agent/sessions/${sessionId}/messages`, {
    method: 'POST',
    userId: 'user_a',
    body: {
      ...scope,
      text: '创建一个测试文本节点',
      snapshot: {
        projectId: 'project_a',
        title: 'A 画布',
        nodes: [],
        connections: [],
        selectedNodeIds: [],
        viewport: { x: 0, y: 0, k: 1 }
      }
    }
  });
  assert.equal(sent.response.status, 200);
  assert.equal(sent.body.toolCalls.length, 1);
  const callId = sent.body.toolCalls[0].id;

  const confirmed = await jsonRequest(server.baseUrl, `/api/canvas/agent/sessions/${sessionId}/tool-calls/${callId}/confirm`, {
    method: 'POST',
    userId: 'user_a',
    body: scope
  });
  assert.equal(confirmed.body.execute, true);
  assert.equal(confirmed.body.execution.kind, 'canvas_ops');

  const result = await jsonRequest(server.baseUrl, `/api/canvas/agent/sessions/${sessionId}/tool-calls/${callId}/result`, {
    method: 'POST',
    userId: 'user_a',
    body: { ...scope, result: { ok: true, nodeCount: 1 } }
  });
  assert.equal(result.body.toolCall.status, 'executed');

  const restored = await jsonRequest(server.baseUrl, `/api/canvas/agent/sessions/${sessionId}?projectId=project_a&browserSessionId=browser_a`, {
    userId: 'user_a'
  });
  assert.equal(restored.body.events.some((event) => event.type === 'tool_executed'), true);

  const removed = await jsonRequest(server.baseUrl, `/api/canvas/agent/sessions/${sessionId}`, {
    method: 'DELETE',
    userId: 'user_a',
    body: scope
  });
  assert.equal(removed.body.deleted, true);
});

test('路由拒绝未登录、跨账号项目和伪造 browserSessionId', async (t) => {
  const server = await createServer();
  t.after(server.close);

  const unauthenticated = await jsonRequest(server.baseUrl, '/api/canvas/agent/sessions?projectId=project_a&browserSessionId=browser_a');
  assert.equal(unauthenticated.response.status, 401);

  const crossUser = await jsonRequest(server.baseUrl, '/api/canvas/agent/sessions', {
    method: 'POST',
    userId: 'user_b',
    body: { projectId: 'project_a', browserSessionId: 'browser_b' }
  });
  assert.equal(crossUser.response.status, 404);
  assert.equal(crossUser.body.code, 'CANVAS_AGENT_PROJECT_NOT_FOUND');

  const created = await jsonRequest(server.baseUrl, '/api/canvas/agent/sessions', {
    method: 'POST',
    userId: 'user_a',
    body: { projectId: 'project_a', browserSessionId: 'browser_a' }
  });
  const forged = await jsonRequest(server.baseUrl, `/api/canvas/agent/sessions/${created.body.session.id}?projectId=project_a&browserSessionId=browser_forged`, {
    userId: 'user_a'
  });
  assert.equal(forged.response.status, 404);
  assert.equal(forged.body.code, 'CANVAS_AGENT_SESSION_NOT_FOUND');
});

test('认证 SSE 返回持久事件，不把 token 放进 URL', async (t) => {
  const server = await createServer();
  t.after(server.close);
  const created = await jsonRequest(server.baseUrl, '/api/canvas/agent/sessions', {
    method: 'POST',
    userId: 'user_a',
    body: { projectId: 'project_a', browserSessionId: 'browser_a' }
  });
  const sessionId = created.body.session.id;
  const response = await fetch(
    `${server.baseUrl}/api/canvas/agent/sessions/${sessionId}/events/stream?projectId=project_a&browserSessionId=browser_a&after=0`,
    { headers: { 'X-Test-User': 'user_a' } }
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^text\/event-stream/);
  const reader = response.body.getReader();
  const first = await reader.read();
  const text = new TextDecoder().decode(first.value);
  assert.match(text, /event: session_created/);
  await reader.cancel();
});
