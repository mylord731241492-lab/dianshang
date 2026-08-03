'use strict';

const { agentError } = require('./session-repository');

function registerCanvasAgentRoutes(app, options = {}) {
  const auth = options.auth;
  const runtime = options.runtime;
  const assertProjectAccess = options.assertProjectAccess;
  if (typeof auth !== 'function') throw new TypeError('Canvas Agent 路由缺少 auth 中间件');
  if (!runtime) throw new TypeError('Canvas Agent 路由缺少 runtime');
  if (typeof assertProjectAccess !== 'function') throw new TypeError('Canvas Agent 路由缺少项目权限校验');

  const wrap = (handler) => async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };

  function requiredScopeValue(value, label) {
    const text = String(value || '').trim();
    if (!text || text.length > 200 || /[\u0000-\u001f]/.test(text)) {
      throw agentError(400, 'CANVAS_AGENT_SCOPE_INVALID', `${label} 不合法`);
    }
    return text;
  }

  function requestScope(req, options = {}) {
    const source = req.body && typeof req.body === 'object' ? req.body : {};
    const projectId = requiredScopeValue(source.projectId || req.query.projectId, 'projectId');
    const browserSessionId = requiredScopeValue(
      source.browserSessionId || req.query.browserSessionId,
      'browserSessionId'
    );
    const scope = {
      userId: requiredScopeValue(req.user?.userId, 'userId'),
      projectId,
      browserSessionId
    };
    if (options.session) {
      scope.sessionId = requiredScopeValue(req.params.sessionId, 'sessionId');
    }
    return scope;
  }

  async function authorizedScope(req, options = {}) {
    const scope = requestScope(req, options);
    await assertProjectAccess(scope.userId, scope.projectId);
    return scope;
  }

  app.post('/api/canvas/agent/sessions', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req);
    const session = runtime.createSession({
      ...scope,
      title: String(req.body?.title || '新对话').trim().slice(0, 120) || '新对话',
      skillIds: req.body?.skillIds
    });
    res.status(201).json({ success: true, session });
  }));

  // 更换会话绑定的 Agent 技能（管理员维护的启用技能，最多 3 个）。
  app.post('/api/canvas/agent/sessions/:sessionId/skills', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    const session = runtime.updateSessionSkills(scope, req.body?.skillIds || []);
    res.json({ success: true, session });
  }));

  app.get('/api/canvas/agent/sessions', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req);
    const sessions = runtime.listSessions(scope);
    res.json({ success: true, sessions, items: sessions });
  }));

  app.get('/api/canvas/agent/sessions/:sessionId', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    res.json({ success: true, ...runtime.getSession(scope) });
  }));

  app.delete('/api/canvas/agent/sessions/:sessionId', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    res.json({ success: true, ...runtime.deleteSession(scope) });
  }));

  app.get('/api/canvas/agent/sessions/:sessionId/events', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    const bundle = runtime.getSession(scope);
    const after = Math.max(0, Number(req.query.after) || 0);
    const events = bundle.events.filter((event) => Number(event.id) > after);
    res.json({
      success: true,
      session: bundle.session,
      events,
      toolCalls: bundle.toolCalls
    });
  }));

  app.get('/api/canvas/agent/sessions/:sessionId/events/stream', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    runtime.getSession(scope);

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let lastSent = Math.max(
      0,
      Number(req.query.after) || 0,
      Number(req.get?.('Last-Event-ID')) || 0
    );
    const send = (event) => {
      if (!event || Number(event.id) <= lastSent || res.writableEnded) return;
      lastSent = Number(event.id);
      res.write(`id: ${event.id}\n`);
      res.write(`event: ${event.type}\n`);
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // 先订阅，再补发持久事件；按 event id 去重，避免订阅与补发之间丢事件。
    const unsubscribe = runtime.subscribe(scope, send);
    runtime.getSession(scope).events.forEach(send);
    const ping = setInterval(() => {
      if (!res.writableEnded) res.write(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
    }, 15000);
    if (typeof ping.unref === 'function') ping.unref();

    req.on('close', () => {
      clearInterval(ping);
      unsubscribe();
    });
  }));

  app.post('/api/canvas/agent/sessions/:sessionId/messages', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    const bundle = await runtime.sendMessage({
      ...scope,
      text: req.body?.text || req.body?.message || '',
      snapshot: req.body?.snapshot,
      attachments: req.body?.attachments,
      mentions: req.body?.mentions
    });
    res.json({ success: true, ...bundle });
  }));

  app.post('/api/canvas/agent/sessions/:sessionId/stop', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    res.json({ success: true, ...runtime.stopSession(scope) });
  }));

  app.post('/api/canvas/agent/sessions/:sessionId/tool-calls/:callId/confirm', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    const result = await runtime.confirmToolCall({
      ...scope,
      callId: requiredScopeValue(req.params.callId, 'callId')
    });
    res.json({ success: true, ...result });
  }));

  app.post('/api/canvas/agent/sessions/:sessionId/tool-calls/:callId/reject', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    const result = runtime.rejectToolCall({
      ...scope,
      callId: requiredScopeValue(req.params.callId, 'callId'),
      reason: String(req.body?.reason || '').trim().slice(0, 1000)
    });
    res.json({ success: true, ...result });
  }));

  app.post('/api/canvas/agent/sessions/:sessionId/tool-calls/:callId/result', auth, wrap(async (req, res) => {
    const scope = await authorizedScope(req, { session: true });
    const result = runtime.reportToolResult({
      ...scope,
      callId: requiredScopeValue(req.params.callId, 'callId'),
      result: req.body?.result,
      error: String(req.body?.error || '').trim().slice(0, 2000)
    });
    res.json({ success: true, ...result });
  }));
}

module.exports = {
  registerCanvasAgentRoutes
};
