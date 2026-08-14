'use strict';

const fs = require('fs');
const path = require('path');

function registerWorkflowRoutes(app, options = {}) {
  const auth = options.auth;
  const uid = options.uid;
  const db = options.db;
  const WORKFLOW_DIR = options.workflowDir;
  const workflowDataFromBody = options.workflowDataFromBody;
  const normalizeWorkflowJson = options.normalizeWorkflowJson;
  if (typeof auth !== 'function') throw new TypeError('Workflows 路由缺少 auth 中间件');
  if (typeof uid !== 'function') throw new TypeError('Workflows 路由缺少 uid');
  if (!db) throw new TypeError('Workflows 路由缺少 db');
  if (!WORKFLOW_DIR) throw new TypeError('Workflows 路由缺少 workflowDir');
  if (typeof workflowDataFromBody !== 'function') throw new TypeError('Workflows 路由缺少 workflowDataFromBody');
  if (typeof normalizeWorkflowJson !== 'function') throw new TypeError('Workflows 路由缺少 normalizeWorkflowJson');

  function workflowNameFromBody(body = {}, data = {}) {
    return body.name || body.title || data.name || data.title || '本地工作流';
  }

  function safeWorkflowPathPart(value = '') {
    const cleaned = String(value || '')
      .replace(/[^a-zA-Z0-9_.-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 120);
    return cleaned || 'workflow';
  }

  function workflowFilePayload(id, name, data = {}) {
    return {
      ...normalizeWorkflowJson(data),
      projectId: id,
      title: name,
      savedAt: new Date().toISOString()
    };
  }

  function saveWorkflowJsonFile(userId, id, name, data = {}) {
    const userDir = path.join(WORKFLOW_DIR, safeWorkflowPathPart(userId || 'anonymous'));
    fs.mkdirSync(userDir, { recursive: true });
    const fileName = `${safeWorkflowPathPart(id)}.workflow.json`;
    const filePath = path.join(userDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(workflowFilePayload(id, name, data), null, 2), 'utf8');
    return {
      fileName,
      path: filePath,
      relativePath: path.relative(WORKFLOW_DIR, filePath).replace(/\\/g, '/')
    };
  }

  function saveWorkflowProject(userId, id, name, data = {}) {
    const existing = db.prepare('SELECT id FROM projects WHERE id=? AND user_id=?').get(id, userId);
    if (existing) {
      db.prepare("UPDATE projects SET name=?, data=?, updated_at=datetime('now') WHERE id=? AND user_id=?")
        .run(name, JSON.stringify(data || {}), id, userId);
    } else {
      db.prepare('INSERT INTO projects (id,user_id,name,data) VALUES (?,?,?,?)')
        .run(id, userId, name, JSON.stringify(data || {}));
    }
    return saveWorkflowJsonFile(userId, id, name, data);
  }

  app.post('/api/workflows/:id/save-json', auth, (req, res) => {
    const id = String(req.params.id || req.body.id || uid('workflow_'));
    const data = workflowDataFromBody(req.body);
    const name = workflowNameFromBody(req.body, data);
    const localFile = saveWorkflowProject(req.user.userId, id, name, data);
    res.json({ success: true, id, workflowId: id, savedAt: new Date().toISOString(), localFile });
  });

  app.post('/api/workflows/:id/save-local-json', auth, (req, res) => {
    const id = String(req.params.id || req.body.id || uid('workflow_'));
    const data = workflowDataFromBody(req.body);
    const name = workflowNameFromBody(req.body, data);
    const localFile = saveWorkflowProject(req.user.userId, id, name, data);
    res.json({ success: true, id, workflowId: id, savedAt: new Date().toISOString(), localFile });
  });

  app.get('/api/workflows/:id/local-json', auth, (req, res) => {
    const filePath = path.join(
      WORKFLOW_DIR,
      safeWorkflowPathPart(req.user.userId),
      `${safeWorkflowPathPart(req.params.id)}.workflow.json`
    );
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: '本地工作流 JSON 不存在' });
    res.sendFile(filePath);
  });
}

module.exports = { registerWorkflowRoutes };
