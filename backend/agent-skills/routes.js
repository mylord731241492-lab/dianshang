'use strict';

// Agent Skills 路由：普通用户只读启用列表；写接口走 admin 守卫。
// server.js 只调用 registerAgentSkillRoutes 挂载，不内联 skill 逻辑。

function registerAgentSkillRoutes(app, options = {}) {
  const auth = options.auth;
  const admin = options.admin;
  const repository = options.agentSkillRepository;
  if (typeof auth !== 'function') throw new TypeError('缺少 auth 中间件');
  if (typeof admin !== 'function') throw new TypeError('缺少 admin 中间件');
  if (!repository) throw new TypeError('缺少 Agent Skill 仓库');

  const wrap = (handler) => async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };

  // 普通用户只读启用技能（列表不含 markdown 全文，详情按 id 读取）
  app.get('/api/agent-skills', auth, wrap(async (req, res) => {
    res.json({ success: true, items: repository.listEnabled().map(repository.publicSkill) });
  }));

  app.get('/api/agent-skills/:id', auth, wrap(async (req, res) => {
    const skill = repository.getById(req.params.id);
    if (!skill || !skill.enabled) {
      res.status(404).json({ success: false, code: 'AGENT_SKILL_NOT_FOUND', message: '技能不存在或未启用' });
      return;
    }
    res.json({ success: true, item: skill });
  }));

  // 后台管理（admin）
  app.get('/api/admin/agent-skills', auth, admin, wrap(async (req, res) => {
    res.json({ success: true, items: repository.listAll() });
  }));

  app.post('/api/admin/agent-skills', auth, admin, wrap(async (req, res) => {
    res.json({ success: true, item: repository.create(req.body || {}) });
  }));

  app.get('/api/admin/agent-skills/:id', auth, admin, wrap(async (req, res) => {
    const skill = repository.getById(req.params.id);
    if (!skill) {
      res.status(404).json({ success: false, code: 'AGENT_SKILL_NOT_FOUND', message: '技能不存在' });
      return;
    }
    res.json({ success: true, item: skill });
  }));

  app.put('/api/admin/agent-skills/:id', auth, admin, wrap(async (req, res) => {
    res.json({ success: true, item: repository.update(req.params.id, req.body || {}) });
  }));

  app.delete('/api/admin/agent-skills/:id', auth, admin, wrap(async (req, res) => {
    res.json({ success: true, ...repository.remove(req.params.id) });
  }));
}

module.exports = {
  registerAgentSkillRoutes
};
