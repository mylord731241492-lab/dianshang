'use strict';

// user_assets 元数据仓储：账号归属、名称、标签、MIME、尺寸、状态存 SQLite；
// 文件字节由 ObjectStorage 负责（见 object-storage.js）。
// 建表遵循 task-repository.js 的幂等迁移先例（模块内 migrate()，server.js 只挂载）。
// 所有查询强制带 user_id，跨用户访问对调用方表现为不存在。

const { storageError } = require('./object-storage');

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

function createAssetRepository(options = {}) {
  const db = options.db;
  if (!db) throw new TypeError('缺少 SQLite 数据库连接');
  const idFactory = options.idFactory || ((prefix) => `${prefix}${Date.now()}_${Math.random().toString(16).slice(2)}`);

  function migrate() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_assets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        object_key TEXT NOT NULL,
        storage_provider TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        width INTEGER,
        height INTEGER,
        checksum_sha256 TEXT,
        tags_json TEXT NOT NULL DEFAULT '[]',
        source TEXT NOT NULL DEFAULT 'upload',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_user_assets_owner_updated
        ON user_assets(user_id, updated_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_assets_owner_object
        ON user_assets(user_id, object_key);
    `);
  }

  function rowToAsset(row) {
    if (!row) return null;
    return {
      id: row.id,
      kind: row.kind,
      name: row.name,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes || 0),
      width: row.width === null || row.width === undefined ? null : Number(row.width),
      height: row.height === null || row.height === undefined ? null : Number(row.height),
      checksumSha256: row.checksum_sha256 || '',
      tags: safeParse(row.tags_json, []),
      source: row.source || 'upload',
      status: row.status || 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function insertAsset(input) {
    db.prepare(`
      INSERT INTO user_assets (
        id,user_id,kind,name,object_key,storage_provider,mime_type,size_bytes,
        width,height,checksum_sha256,tags_json,source,status
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      input.id,
      input.userId,
      input.kind,
      input.name,
      input.objectKey,
      input.storageProvider,
      input.mimeType,
      input.sizeBytes,
      input.width ?? null,
      input.height ?? null,
      input.checksumSha256 || '',
      JSON.stringify(Array.isArray(input.tags) ? input.tags : []),
      input.source || 'upload',
      'active'
    );
    return getAsset(input.userId, input.id);
  }

  function getAsset(userId, id) {
    const row = db.prepare("SELECT * FROM user_assets WHERE id=? AND user_id=? AND deleted_at IS NULL")
      .get(id, userId);
    return rowToAsset(row);
  }

  // 内容路由使用：签名 URL 本身是能力凭证，此处按 id 查（不限 user_id），但仍排除已软删除资产。
  function getAssetByObjectId(id) {
    const row = db.prepare("SELECT * FROM user_assets WHERE id=? AND deleted_at IS NULL").get(id);
    if (!row) return null;
    return { ...rowToAsset(row), objectKey: row.object_key, userId: row.user_id };
  }

  function escapeLike(value) {
    return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
  }

  function encodeCursor(row) {
    return Buffer.from(`${row.updated_at}|${row.id}`, 'utf8').toString('base64url');
  }

  function decodeCursor(cursor) {
    try {
      const decoded = Buffer.from(String(cursor), 'base64url').toString('utf8');
      const separator = decoded.lastIndexOf('|');
      if (separator <= 0) return null;
      return { updatedAt: decoded.slice(0, separator), id: decoded.slice(separator + 1) };
    } catch {
      return null;
    }
  }

  function listAssets(userId, options = {}) {
    const limit = Math.max(1, Math.min(Number(options.limit) || DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT));
    const kind = ['image', 'video', 'audio'].includes(options.kind) ? options.kind : '';
    const query = String(options.q || '').trim();
    const conditions = ['user_id = ?', 'deleted_at IS NULL'];
    const params = [userId];
    if (kind) {
      conditions.push('kind = ?');
      params.push(kind);
    }
    if (query) {
      conditions.push("name LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(query)}%`);
    }
    if (options.cursor) {
      const cursor = decodeCursor(options.cursor);
      if (!cursor) throw storageError(400, 'ASSET_CURSOR_INVALID', '分页游标无效');
      conditions.push('(updated_at < ? OR (updated_at = ? AND id < ?))');
      params.push(cursor.updatedAt, cursor.updatedAt, cursor.id);
    }
    const rows = db.prepare(`
      SELECT * FROM user_assets
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC, id DESC
      LIMIT ?
    `).all(...params, limit + 1);
    const pageRows = rows.slice(0, limit);
    return {
      items: pageRows.map(rowToAsset),
      nextCursor: rows.length > limit && pageRows.length ? encodeCursor(pageRows[pageRows.length - 1]) : null
    };
  }

  function updateAsset(userId, id, patch = {}) {
    const existing = getAsset(userId, id);
    if (!existing) return null;
    const name = patch.name !== undefined ? String(patch.name).trim().slice(0, 200) : existing.name;
    if (!name) throw storageError(400, 'ASSET_NAME_REQUIRED', '资产名称不能为空');
    const tags = patch.tags !== undefined
      ? (Array.isArray(patch.tags) ? patch.tags.map((tag) => String(tag).trim().slice(0, 50)).filter(Boolean).slice(0, 20) : existing.tags)
      : existing.tags;
    db.prepare("UPDATE user_assets SET name=?,tags_json=?,updated_at=datetime('now') WHERE id=? AND user_id=? AND deleted_at IS NULL")
      .run(name, JSON.stringify(tags), id, userId);
    return getAsset(userId, id);
  }

  function softDeleteAsset(userId, id) {
    const result = db.prepare("UPDATE user_assets SET status='deleted',deleted_at=datetime('now'),updated_at=datetime('now') WHERE id=? AND user_id=? AND deleted_at IS NULL")
      .run(id, userId);
    return result.changes > 0;
  }

  migrate();

  return {
    insertAsset,
    getAsset,
    getAssetByObjectId,
    listAssets,
    updateAsset,
    softDeleteAsset,
    newAssetId: () => idFactory('asset_')
  };
}

module.exports = {
  createAssetRepository,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT
};
