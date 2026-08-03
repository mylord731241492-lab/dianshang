'use strict';

// Agent Skills 仓库（管理员统一维护，纯提示词注入）。
// skill 只作为规划上下文注入，不包含可执行内容；参照 backend/prompts 的策展模式。

const crypto = require('crypto');

const MAX_NAME = 60;
const MAX_DESCRIPTION = 200;
const MAX_MARKDOWN = 8000;
const MAX_ACTIVE_SKILLS = 3;

function skillError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function skillFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    markdown: row.markdown,
    enabled: row.enabled === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function publicSkill(skill) {
  if (!skill) return null;
  return { id: skill.id, name: skill.name, description: skill.description, enabled: skill.enabled, sortOrder: skill.sortOrder };
}

function validateSkillInput(input, { partial = false } = {}) {
  const output = {};
  if (!partial || input.name !== undefined) {
    const name = String(input.name || '').trim();
    if (!name || name.length > MAX_NAME) throw skillError(400, 'AGENT_SKILL_NAME_INVALID', `技能名称必填且不超过 ${MAX_NAME} 字`);
    output.name = name;
  }
  if (!partial || input.description !== undefined) {
    const description = String(input.description || '').trim();
    if (description.length > MAX_DESCRIPTION) throw skillError(400, 'AGENT_SKILL_DESCRIPTION_INVALID', `技能描述不超过 ${MAX_DESCRIPTION} 字`);
    output.description = description;
  }
  if (!partial || input.markdown !== undefined) {
    const markdown = String(input.markdown || '').trim();
    if (!markdown || markdown.length > MAX_MARKDOWN) throw skillError(400, 'AGENT_SKILL_MARKDOWN_INVALID', `技能内容必填且不超过 ${MAX_MARKDOWN} 字`);
    output.markdown = markdown;
  }
  if (!partial || input.enabled !== undefined) {
    output.enabled = input.enabled === undefined ? 1 : (input.enabled === true || input.enabled === 1 ? 1 : 0);
  }
  if (!partial || input.sortOrder !== undefined) output.sortOrder = Math.max(0, Math.min(Number(input.sortOrder) || 0, 9999));
  return output;
}

function normalizeSkillIds(skillIds) {
  if (skillIds === undefined || skillIds === null) return [];
  if (!Array.isArray(skillIds)) throw skillError(400, 'AGENT_SKILL_IDS_INVALID', 'skillIds 必须是数组');
  const ids = [...new Set(skillIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (ids.length > MAX_ACTIVE_SKILLS) throw skillError(400, 'AGENT_SKILL_TOO_MANY', `同一会话最多启用 ${MAX_ACTIVE_SKILLS} 个技能`);
  return ids;
}

function createAgentSkillRepository(options = {}) {
  const db = options.db;
  if (!db) throw new TypeError('缺少 SQLite 数据库连接');
  const now = options.now || (() => Date.now());
  const idFactory = options.idFactory || ((prefix) => `${prefix}${crypto.randomUUID()}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      markdown TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agent_skills_enabled ON agent_skills(enabled, sort_order);
  `);

  function listAll() {
    return db.prepare('SELECT * FROM agent_skills ORDER BY sort_order ASC, created_at ASC').all().map(skillFromRow);
  }

  function listEnabled() {
    return db.prepare('SELECT * FROM agent_skills WHERE enabled=1 ORDER BY sort_order ASC, created_at ASC').all().map(skillFromRow);
  }

  function getById(id) {
    return skillFromRow(db.prepare('SELECT * FROM agent_skills WHERE id=?').get(String(id || '')));
  }

  function create(input) {
    const value = validateSkillInput(input);
    const timestamp = now();
    const id = idFactory('agent_skill_');
    db.prepare(`
      INSERT INTO agent_skills (id,name,description,markdown,enabled,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(id, value.name, value.description, value.markdown, value.enabled ?? 1, value.sortOrder ?? 0, timestamp, timestamp);
    return getById(id);
  }

  function update(id, input) {
    const current = getById(id);
    if (!current) throw skillError(404, 'AGENT_SKILL_NOT_FOUND', '技能不存在');
    const value = validateSkillInput(input, { partial: true });
    db.prepare(`
      UPDATE agent_skills SET
        name=?, description=?, markdown=?, enabled=?, sort_order=?, updated_at=?
      WHERE id=?
    `).run(
      value.name ?? current.name,
      value.description ?? current.description,
      value.markdown ?? current.markdown,
      value.enabled ?? (current.enabled ? 1 : 0),
      value.sortOrder ?? current.sortOrder,
      now(),
      current.id
    );
    return getById(id);
  }

  function remove(id) {
    const current = getById(id);
    if (!current) throw skillError(404, 'AGENT_SKILL_NOT_FOUND', '技能不存在');
    db.prepare('DELETE FROM agent_skills WHERE id=?').run(current.id);
    return { deleted: true, id: current.id };
  }

  // 会话绑定时校验（strict）：只允许存在且启用的技能。
  // 运行时宽松解析（strict:false）：管理员后来停用的技能自动过滤，不阻断对话。
  function resolveEnabledSkills(skillIds, { strict = true } = {}) {
    const ids = normalizeSkillIds(skillIds);
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(`SELECT * FROM agent_skills WHERE enabled=1 AND id IN (${placeholders})`).all(...ids).map(skillFromRow);
    const found = new Set(rows.map((row) => row.id));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length && strict) {
      throw skillError(400, 'AGENT_SKILL_UNAVAILABLE', `技能不存在或已停用：${missing.join('、')}`);
    }
    return ids.filter((id) => found.has(id)).map((id) => rows.find((row) => row.id === id));
  }

  return {
    listAll,
    listEnabled,
    getById,
    create,
    update,
    remove,
    resolveEnabledSkills,
    publicSkill
  };
}

module.exports = {
  MAX_ACTIVE_SKILLS,
  createAgentSkillRepository,
  normalizeSkillIds,
  skillError
};
