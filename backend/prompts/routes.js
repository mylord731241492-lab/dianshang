'use strict';

// /api/prompts/system、/api/user/prompts*、/api/admin/system-prompts* 路由。
// server.js 只调用 registerPromptRoutes 挂载，不内联任何提示词逻辑。
// 系统提示词写接口走 admin 守卫；user_prompts 所有操作由 service 强制 user_id 隔离。
// 管理员接口不提供读取所有用户提示词正文的能力（刻意不实现，见计划 Task 7 边界）。

const { createPromptService } = require('./prompt-service');

function registerPromptRoutes(app, options = {}) {
  const auth = options.auth;
  const admin = options.admin;
  if (typeof auth !== 'function') throw new TypeError('缺少 auth 中间件');
  if (typeof admin !== 'function') throw new TypeError('缺少 admin 中间件');
  const service = options.promptService || createPromptService(options);

  const wrap = (handler) => async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };

  // 普通用户只读已发布系统提示词
  app.get('/api/prompts/system', auth, wrap(async (req, res) => {
    const { items, nextCursor } = service.listPublishedSystemPrompts({
      q: req.query.q,
      category: req.query.category,
      tag: req.query.tag,
      cursor: req.query.cursor,
      limit: req.query.limit
    });
    res.json({ success: true, items, nextCursor });
  }));

  // 我的提示词
  app.get('/api/user/prompts', auth, wrap(async (req, res) => {
    const { items, nextCursor } = service.listUserPrompts(req.user.userId, {
      q: req.query.q,
      category: req.query.category,
      tag: req.query.tag,
      favorite: req.query.favorite,
      cursor: req.query.cursor,
      limit: req.query.limit
    });
    res.json({ success: true, items, nextCursor });
  }));

  app.post('/api/user/prompts', auth, wrap(async (req, res) => {
    const item = service.createUserPrompt(req.user.userId, req.body || {});
    res.json({ success: true, item });
  }));

  // 复制已发布系统提示词为当前用户私有副本（支撑前端“复制到我的提示词”）
  app.post('/api/user/prompts/copy-system', auth, wrap(async (req, res) => {
    const item = service.copySystemPrompt(req.user.userId, req.body || {});
    res.json({ success: true, item });
  }));

  app.get('/api/user/prompts/:id', auth, wrap(async (req, res) => {
    res.json({ success: true, item: service.getUserPrompt(req.user.userId, req.params.id) });
  }));

  app.put('/api/user/prompts/:id', auth, wrap(async (req, res) => {
    res.json({ success: true, item: service.updateUserPrompt(req.user.userId, req.params.id, req.body || {}) });
  }));

  app.delete('/api/user/prompts/:id', auth, wrap(async (req, res) => {
    service.deleteUserPrompt(req.user.userId, req.params.id);
    res.json({ success: true, deleted: true, id: req.params.id });
  }));

  // 系统提示词后台管理（admin）
  app.get('/api/admin/system-prompts', auth, admin, wrap(async (req, res) => {
    const { items, nextCursor } = service.listSystemPromptsAdmin({
      q: req.query.q,
      status: req.query.status,
      category: req.query.category,
      cursor: req.query.cursor,
      limit: req.query.limit
    });
    res.json({ success: true, items, nextCursor });
  }));

  app.post('/api/admin/system-prompts', auth, admin, wrap(async (req, res) => {
    const item = service.createSystemPrompt(req.user.userId, req.body || {});
    res.json({ success: true, item });
  }));

  app.get('/api/admin/system-prompts/:id', auth, admin, wrap(async (req, res) => {
    res.json({ success: true, item: service.getSystemPrompt(req.params.id) });
  }));

  app.put('/api/admin/system-prompts/:id', auth, admin, wrap(async (req, res) => {
    res.json({ success: true, item: service.updateSystemPrompt(req.user.userId, req.params.id, req.body || {}) });
  }));

  app.delete('/api/admin/system-prompts/:id', auth, admin, wrap(async (req, res) => {
    service.deleteSystemPrompt(req.params.id);
    res.json({ success: true, deleted: true, id: req.params.id });
  }));
}

module.exports = {
  registerPromptRoutes
};
