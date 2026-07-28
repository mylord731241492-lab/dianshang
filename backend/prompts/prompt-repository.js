'use strict';

// system_prompts / user_prompts 仓储（Task 7 双层云端提示词库）。
// 建表遵循 task-repository.js / asset-repository.js 的幂等迁移先例（模块内 migrate()，server.js 只挂载）。
// user_prompts 的所有查询强制带 user_id，跨用户访问对调用方表现为不存在；
// 普通用户视角的系统提示词只读 status='published' AND deleted_at IS NULL。

const PROMPT_TITLE_MAX = 120;
const PROMPT_CONTENT_MAX = 20000;
const PROMPT_CATEGORY_MAX = 50;
const PROMPT_TAG_MAX_LENGTH = 30;
const PROMPT_TAGS_MAX_COUNT = 10;
const DEFAULT_PAGE_LIMIT = 24;
const MAX_PAGE_LIMIT = 100;

function safeParse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function createPromptRepository(options = {}) {
  const db = options.db;
  if (!db) throw new TypeError('缺少 SQLite 数据库连接');
  const idFactory = options.idFactory || ((prefix) => `${prefix}${Date.now()}_${Math.random().toString(16).slice(2)}`);

  function migrate() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS system_prompts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        sort_order INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 1,
        created_by TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_system_prompts_status_sort
        ON system_prompts(status, sort_order, updated_at DESC);

      CREATE TABLE IF NOT EXISTS user_prompts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        is_favorite INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_user_prompts_owner_updated
        ON user_prompts(user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_prompts_owner_favorite
        ON user_prompts(user_id, is_favorite, updated_at DESC);
    `);
  }

  function rowToUserPrompt(row) {
    if (!row) return null;
    return {
      id: row.id,
      scope: 'user',
      title: row.title,
      content: row.content,
      category: row.category || '',
      tags: safeParse(row.tags_json, []),
      isFavorite: Number(row.is_favorite) === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function rowToSystemPrompt(row) {
    if (!row) return null;
    return {
      id: row.id,
      scope: 'system',
      title: row.title,
      content: row.content,
      category: row.category || '',
      tags: safeParse(row.tags_json, []),
      isFavorite: false,
      version: Number(row.version || 1),
      status: row.status || 'draft',
      sortOrder: Number(row.sort_order || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // ---------------- 用户提示词（强制 user_id 隔离） ----------------

  function insertUserPrompt(input) {
    db.prepare(`
      INSERT INTO user_prompts (id,user_id,title,content,category,tags_json,is_favorite,status)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(
      input.id,
      input.userId,
      input.title,
      input.content,
      input.category || '',
      JSON.stringify(Array.isArray(input.tags) ? input.tags : []),
      input.isFavorite ? 1 : 0,
      'active'
    );
    return getUserPrompt(input.userId, input.id);
  }

  function getUserPrompt(userId, id) {
    const row = db.prepare('SELECT * FROM user_prompts WHERE id=? AND user_id=? AND deleted_at IS NULL').get(id, userId);
    return rowToUserPrompt(row);
  }

  function encodeUpdatedCursor(row) {
    return Buffer.from(`${row.updated_at}|${row.id}`, 'utf8').toString('base64url');
  }

  function decodeUpdatedCursor(cursor) {
    try {
      const decoded = Buffer.from(String(cursor), 'base64url').toString('utf8');
      const separator = decoded.lastIndexOf('|');
      if (separator <= 0) return null;
      return { updatedAt: decoded.slice(0, separator), id: decoded.slice(separator + 1) };
    } catch {
      return null;
    }
  }

  function buildFilterConditions(conditions, params, options, { allowFavorite = false } = {}) {
    const query = String(options.q || '').trim();
    const category = String(options.category || '').trim();
    const tag = String(options.tag || '').trim();
    if (query) {
      conditions.push("(title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\' OR category LIKE ? ESCAPE '\\')");
      const pattern = `%${escapeLike(query)}%`;
      params.push(pattern, pattern, pattern);
    }
    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }
    if (tag) {
      conditions.push("tags_json LIKE ? ESCAPE '\\'");
      params.push(`%"${escapeLike(tag)}"%`);
    }
    if (allowFavorite && String(options.favorite || '') === '1') {
      conditions.push('is_favorite = 1');
    }
  }

  function listUserPrompts(userId, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT));
    const conditions = ['user_id = ?', 'deleted_at IS NULL'];
    const params = [userId];
    buildFilterConditions(conditions, params, options, { allowFavorite: true });
    if (options.cursor) {
      const cursor = decodeUpdatedCursor(options.cursor);
      if (!cursor) return { error: 'cursor' };
      conditions.push('(updated_at < ? OR (updated_at = ? AND id < ?))');
      params.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
    }
    const rows = db.prepare(`
      SELECT * FROM user_prompts
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC, id DESC
      LIMIT ?
    `).all(...params, limit + 1);
    const pageRows = rows.slice(0, limit);
    return {
      items: pageRows.map(rowToUserPrompt),
      nextCursor: rows.length > limit && pageRows.length ? encodeUpdatedCursor(pageRows[pageRows.length - 1]) : null
    };
  }

  function updateUserPrompt(userId, id, fields) {
    const existing = getUserPrompt(userId, id);
    if (!existing) return null;
    db.prepare("UPDATE user_prompts SET title=?,content=?,category=?,tags_json=?,is_favorite=?,updated_at=datetime('now') WHERE id=? AND user_id=? AND deleted_at IS NULL")
      .run(
        fields.title,
        fields.content,
        fields.category,
        JSON.stringify(fields.tags),
        fields.isFavorite ? 1 : 0,
        id,
        userId
      );
    return getUserPrompt(userId, id);
  }

  function softDeleteUserPrompt(userId, id) {
    const result = db.prepare("UPDATE user_prompts SET status='deleted',deleted_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND user_id=? AND deleted_at IS NULL")
      .run(id, userId);
    return result.changes > 0;
  }

  // ---------------- 系统提示词 ----------------

  function insertSystemPrompt(input) {
    db.prepare(`
      INSERT INTO system_prompts (id,title,content,category,tags_json,status,sort_order,version,created_by,updated_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      input.id,
      input.title,
      input.content,
      input.category || '',
      JSON.stringify(Array.isArray(input.tags) ? input.tags : []),
      input.status,
      Number(input.sortOrder) || 0,
      1,
      input.operatorId,
      input.operatorId
    );
    return getSystemPrompt(input.id);
  }

  function getSystemPrompt(id) {
    const row = db.prepare('SELECT * FROM system_prompts WHERE id=? AND deleted_at IS NULL').get(id);
    return rowToSystemPrompt(row);
  }

  // copy-system 专用：只允许复制已发布且未删除的系统提示词。
  function getPublishedSystemPrompt(id) {
    const row = db.prepare("SELECT * FROM system_prompts WHERE id=? AND status='published' AND deleted_at IS NULL").get(id);
    return rowToSystemPrompt(row);
  }

  function listSystemPromptsAdmin(options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT));
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    const status = String(options.status || '').trim();
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    buildFilterConditions(conditions, params, options);
    if (options.cursor) {
      const cursor = decodeUpdatedCursor(options.cursor);
      if (!cursor) return { error: 'cursor' };
      conditions.push('(updated_at < ? OR (updated_at = ? AND id < ?))');
      params.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
    }
    const rows = db.prepare(`
      SELECT * FROM system_prompts
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC, id DESC
      LIMIT ?
    `).all(...params, limit + 1);
    const pageRows = rows.slice(0, limit);
    return {
      items: pageRows.map(rowToSystemPrompt),
      nextCursor: rows.length > limit && pageRows.length ? encodeUpdatedCursor(pageRows[pageRows.length - 1]) : null
    };
  }

  function encodeSortCursor(row) {
    return Buffer.from(`${row.sort_order}|${row.id}`, 'utf8').toString('base64url');
  }

  function decodeSortCursor(cursor) {
    try {
      const decoded = Buffer.from(String(cursor), 'base64url').toString('utf8');
      const separator = decoded.indexOf('|');
      if (separator < 0) return null;
      const sortOrder = Number(decoded.slice(0, separator));
      const id = decoded.slice(separator + 1);
      if (!Number.isFinite(sortOrder) || !id) return null;
      return { sortOrder, id };
    } catch {
      return null;
    }
  }

  // 普通用户视角：只读已发布，按 sort_order 升序。
  function listPublishedSystemPrompts(options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT));
    const conditions = ["status = 'published'", 'deleted_at IS NULL'];
    const params = [];
    buildFilterConditions(conditions, params, options);
    if (options.cursor) {
      const cursor = decodeSortCursor(options.cursor);
      if (!cursor) return { error: 'cursor' };
      conditions.push('(sort_order > ? OR (sort_order = ? AND id > ?))');
      params.push(cursor.sortOrder, cursor.sortOrder, cursor.id);
    }
    const rows = db.prepare(`
      SELECT * FROM system_prompts
      WHERE ${conditions.join(' AND ')}
      ORDER BY sort_order ASC, id ASC
      LIMIT ?
    `).all(...params, limit + 1);
    const pageRows = rows.slice(0, limit);
    return {
      items: pageRows.map(rowToSystemPrompt),
      nextCursor: rows.length > limit && pageRows.length ? encodeSortCursor(pageRows[pageRows.length - 1]) : null
    };
  }

  function updateSystemPrompt(id, fields, { bumpVersion, operatorId }) {
    const existing = getSystemPrompt(id);
    if (!existing) return null;
    db.prepare(`
      UPDATE system_prompts
      SET title=?,content=?,category=?,tags_json=?,status=?,sort_order=?,version=version+?,updated_by=?,updated_at=datetime('now')
      WHERE id=? AND deleted_at IS NULL
    `).run(
      fields.title,
      fields.content,
      fields.category,
      JSON.stringify(fields.tags),
      fields.status,
      fields.sortOrder,
      bumpVersion ? 1 : 0,
      operatorId,
      id
    );
    return getSystemPrompt(id);
  }

  function softDeleteSystemPrompt(id) {
    const result = db.prepare("UPDATE system_prompts SET status='disabled',deleted_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND deleted_at IS NULL")
      .run(id);
    return result.changes > 0;
  }

  migrate();

  return {
    insertUserPrompt,
    getUserPrompt,
    listUserPrompts,
    updateUserPrompt,
    softDeleteUserPrompt,
    insertSystemPrompt,
    getSystemPrompt,
    getPublishedSystemPrompt,
    listSystemPromptsAdmin,
    listPublishedSystemPrompts,
    updateSystemPrompt,
    softDeleteSystemPrompt,
    newPromptId: () => idFactory('prompt_')
  };
}

module.exports = {
  createPromptRepository,
  PROMPT_TITLE_MAX,
  PROMPT_CONTENT_MAX,
  PROMPT_CATEGORY_MAX,
  PROMPT_TAG_MAX_LENGTH,
  PROMPT_TAGS_MAX_COUNT,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT
};
