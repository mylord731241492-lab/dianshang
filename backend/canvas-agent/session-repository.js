'use strict';

const crypto = require('crypto');

function agentError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function redactString(value) {
  const text = String(value);
  if (/^data:[^;,]+(?:;[^,]*)?,/i.test(text)) {
    return `[已省略 data URL，长度 ${text.length}]`;
  }
  return text
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|sk-proj-[A-Za-z0-9_-]{8,})\b/gi, '[REDACTED]');
}

function sanitizeForStorage(value, depth = 0) {
  if (depth > 12) return '[已省略过深数据]';
  if (typeof value === 'string') return redactString(value).slice(0, 12000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => sanitizeForStorage(item, depth + 1));
  if (!value || typeof value !== 'object') return value === undefined ? null : String(value);
  const output = {};
  Object.entries(value).slice(0, 200).forEach(([key, item]) => {
    if (/authorization|api[-_]?key|password|secret|connect[-_]?token|access[-_]?token|refresh[-_]?token/i.test(key)) {
      output[key] = '[REDACTED]';
      return;
    }
    if (/data[-_]?url/i.test(key)) {
      output[key] = typeof item === 'string' ? `[已省略 data URL，长度 ${item.length}]` : '[已省略 data URL]';
      return;
    }
    output[key] = sanitizeForStorage(item, depth + 1);
  });
  return output;
}

function stringify(value) {
  return JSON.stringify(sanitizeForStorage(value));
}

function sessionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    browserSessionId: row.browser_session_id,
    title: row.title,
    status: row.status,
    skillIds: parseJson(row.skill_ids, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null
  };
}

function eventFromRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    type: row.type,
    payload: parseJson(row.payload_json, {}),
    createdAt: row.created_at
  };
}

function toolCallFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    input: parseJson(row.input_json, {}),
    summary: row.summary,
    execution: parseJson(row.execution_json, null),
    status: row.status,
    result: parseJson(row.result_json, null),
    error: row.error_message || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedAt: row.approved_at || null,
    executedAt: row.executed_at || null
  };
}

function createCanvasAgentRepository(options = {}) {
  const db = options.db;
  if (!db) throw new TypeError('缺少 SQLite 数据库连接');
  const now = options.now || (() => Date.now());
  const idFactory = options.idFactory || ((prefix) => `${prefix}${crypto.randomUUID()}`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS canvas_agent_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      browser_session_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      status TEXT NOT NULL DEFAULT 'idle',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      deleted_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_canvas_agent_sessions_scope
      ON canvas_agent_sessions(user_id, project_id, browser_session_id, updated_at);
    CREATE TABLE IF NOT EXISTS canvas_agent_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      browser_session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_canvas_agent_events_session
      ON canvas_agent_events(session_id, id);
    CREATE INDEX IF NOT EXISTS idx_canvas_agent_events_scope
      ON canvas_agent_events(user_id, project_id, browser_session_id, session_id, id);
    CREATE TABLE IF NOT EXISTS canvas_agent_tool_calls (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      browser_session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      input_json TEXT NOT NULL DEFAULT '{}',
      summary TEXT NOT NULL DEFAULT '',
      execution_json TEXT NOT NULL DEFAULT 'null',
      status TEXT NOT NULL DEFAULT 'pending',
      result_json TEXT NOT NULL DEFAULT 'null',
      error_message TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      approved_at INTEGER,
      executed_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_canvas_agent_tool_calls_session
      ON canvas_agent_tool_calls(session_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_canvas_agent_tool_calls_scope
      ON canvas_agent_tool_calls(user_id, project_id, browser_session_id, session_id, status);
  `);

  // 幂等列迁移：老库补 skill_ids（JSON 数组，管理员维护的 Agent 技能绑定）。
  const sessionColumns = db.prepare('PRAGMA table_info(canvas_agent_sessions)').all().map((column) => column.name);
  if (!sessionColumns.includes('skill_ids')) {
    db.exec("ALTER TABLE canvas_agent_sessions ADD COLUMN skill_ids TEXT NOT NULL DEFAULT '[]'");
  }

  const scopedSessionSql = `
    SELECT * FROM canvas_agent_sessions
    WHERE id=? AND user_id=? AND project_id=? AND browser_session_id=? AND deleted_at IS NULL
  `;
  const scopedToolSql = `
    SELECT * FROM canvas_agent_tool_calls
    WHERE id=? AND session_id=? AND user_id=? AND project_id=? AND browser_session_id=?
  `;

  function sessionScopeValues(scope) {
    return [scope.sessionId, scope.userId, scope.projectId, scope.browserSessionId];
  }

  function requireSession(scope) {
    const row = db.prepare(scopedSessionSql).get(...sessionScopeValues(scope));
    if (!row) throw agentError(404, 'CANVAS_AGENT_SESSION_NOT_FOUND', 'Agent 会话不存在或不属于当前页面');
    return row;
  }

  function requireToolCall(scope, callId) {
    const row = db.prepare(scopedToolSql).get(
      callId,
      scope.sessionId,
      scope.userId,
      scope.projectId,
      scope.browserSessionId
    );
    if (!row) throw agentError(404, 'CANVAS_AGENT_TOOL_CALL_NOT_FOUND', '工具调用不存在或不属于当前会话');
    return row;
  }

  function createSession(input) {
    const timestamp = now();
    const id = input.id || idFactory('agent_session_');
    const skillIds = Array.isArray(input.skillIds) ? input.skillIds.map((item) => String(item)).slice(0, 10) : [];
    db.prepare(`
      INSERT INTO canvas_agent_sessions
        (id,user_id,project_id,browser_session_id,title,status,skill_ids,created_at,updated_at)
      VALUES (?,?,?,?,?,'idle',?,?,?)
    `).run(
      id,
      input.userId,
      input.projectId,
      input.browserSessionId,
      String(input.title || '新对话').trim().slice(0, 120) || '新对话',
      JSON.stringify(skillIds),
      timestamp,
      timestamp
    );
    return sessionFromRow(requireSession({ ...input, sessionId: id }));
  }

  function updateSessionSkills(scope, skillIds) {
    requireSession(scope);
    const ids = Array.isArray(skillIds) ? skillIds.map((item) => String(item)).slice(0, 10) : [];
    const timestamp = now();
    db.prepare(`
      UPDATE canvas_agent_sessions SET skill_ids=?, updated_at=?
      WHERE id=? AND user_id=? AND project_id=? AND browser_session_id=? AND deleted_at IS NULL
    `).run(JSON.stringify(ids), timestamp, ...sessionScopeValues(scope));
    return getSession(scope);
  }

  function listSessions(scope, limit = 50) {
    return db.prepare(`
      SELECT * FROM canvas_agent_sessions
      WHERE user_id=? AND project_id=? AND browser_session_id=? AND deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(
      scope.userId,
      scope.projectId,
      scope.browserSessionId,
      Math.max(1, Math.min(Number(limit) || 50, 100))
    ).map(sessionFromRow);
  }

  function getSession(scope) {
    return sessionFromRow(requireSession(scope));
  }

  function updateSessionStatus(scope, status) {
    requireSession(scope);
    const timestamp = now();
    db.prepare(`
      UPDATE canvas_agent_sessions SET status=?, updated_at=?
      WHERE id=? AND user_id=? AND project_id=? AND browser_session_id=? AND deleted_at IS NULL
    `).run(status, timestamp, ...sessionScopeValues(scope));
    return getSession(scope);
  }

  function touchSession(scope) {
    requireSession(scope);
    db.prepare(`
      UPDATE canvas_agent_sessions SET updated_at=?
      WHERE id=? AND user_id=? AND project_id=? AND browser_session_id=? AND deleted_at IS NULL
    `).run(now(), ...sessionScopeValues(scope));
  }

  function deleteSession(scope) {
    requireSession(scope);
    const timestamp = now();
    db.prepare(`
      UPDATE canvas_agent_sessions SET status='deleted', deleted_at=?, updated_at=?
      WHERE id=? AND user_id=? AND project_id=? AND browser_session_id=? AND deleted_at IS NULL
    `).run(timestamp, timestamp, ...sessionScopeValues(scope));
    return { deleted: true, id: scope.sessionId };
  }

  function appendEvent(input) {
    requireSession(input);
    const timestamp = now();
    const result = db.prepare(`
      INSERT INTO canvas_agent_events
        (session_id,user_id,project_id,browser_session_id,type,payload_json,created_at)
      VALUES (?,?,?,?,?,?,?)
    `).run(
      input.sessionId,
      input.userId,
      input.projectId,
      input.browserSessionId,
      input.type,
      stringify(input.payload || {}),
      timestamp
    );
    touchSession(input);
    return eventFromRow(db.prepare('SELECT * FROM canvas_agent_events WHERE id=?').get(result.lastInsertRowid));
  }

  function listEvents(scope, options = {}) {
    requireSession(scope);
    const after = Math.max(0, Number(options.after) || 0);
    const limit = Math.max(1, Math.min(Number(options.limit) || 500, 1000));
    return db.prepare(`
      SELECT * FROM canvas_agent_events
      WHERE session_id=? AND user_id=? AND project_id=? AND browser_session_id=? AND id>?
      ORDER BY id ASC
      LIMIT ?
    `).all(
      scope.sessionId,
      scope.userId,
      scope.projectId,
      scope.browserSessionId,
      after,
      limit
    ).map(eventFromRow);
  }

  function insertToolCall(input) {
    requireSession(input);
    const timestamp = now();
    const id = input.id || idFactory('agent_call_');
    db.prepare(`
      INSERT INTO canvas_agent_tool_calls
        (id,session_id,user_id,project_id,browser_session_id,name,input_json,summary,execution_json,status,result_json,error_message,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      id,
      input.sessionId,
      input.userId,
      input.projectId,
      input.browserSessionId,
      input.name,
      stringify(input.input || {}),
      String(input.summary || '').slice(0, 1000),
      stringify(input.execution ?? null),
      input.status || 'pending',
      stringify(input.result ?? null),
      String(input.error || '').slice(0, 2000),
      timestamp,
      timestamp
    );
    return toolCallFromRow(requireToolCall(input, id));
  }

  function listToolCalls(scope) {
    requireSession(scope);
    return db.prepare(`
      SELECT * FROM canvas_agent_tool_calls
      WHERE session_id=? AND user_id=? AND project_id=? AND browser_session_id=?
      ORDER BY created_at ASC, id ASC
    `).all(
      scope.sessionId,
      scope.userId,
      scope.projectId,
      scope.browserSessionId
    ).map(toolCallFromRow);
  }

  function getToolCall(scope, callId) {
    return toolCallFromRow(requireToolCall(scope, callId));
  }

  const approveToolCall = db.transaction((scope, callId) => {
    const current = requireToolCall(scope, callId);
    if (current.status !== 'pending') {
      return { toolCall: toolCallFromRow(current), changed: false };
    }
    const timestamp = now();
    db.prepare(`
      UPDATE canvas_agent_tool_calls
      SET status='approved', approved_at=?, updated_at=?
      WHERE id=? AND status='pending'
    `).run(timestamp, timestamp, callId);
    return { toolCall: getToolCall(scope, callId), changed: true };
  });

  const rejectToolCall = db.transaction((scope, callId, reason) => {
    const current = requireToolCall(scope, callId);
    if (current.status !== 'pending') {
      return { toolCall: toolCallFromRow(current), changed: false };
    }
    const timestamp = now();
    db.prepare(`
      UPDATE canvas_agent_tool_calls
      SET status='rejected', error_message=?, updated_at=?, executed_at=?
      WHERE id=? AND status='pending'
    `).run(String(reason || '用户拒绝执行').slice(0, 2000), timestamp, timestamp, callId);
    return { toolCall: getToolCall(scope, callId), changed: true };
  });

  const finishToolCall = db.transaction((scope, callId, outcome = {}) => {
    const current = requireToolCall(scope, callId);
    if (['executed', 'failed', 'rejected', 'interrupted'].includes(current.status)) {
      return { toolCall: toolCallFromRow(current), changed: false };
    }
    if (current.status !== 'approved') {
      throw agentError(409, 'CANVAS_AGENT_TOOL_NOT_APPROVED', '工具调用尚未批准');
    }
    const timestamp = now();
    const status = outcome.error ? 'failed' : 'executed';
    db.prepare(`
      UPDATE canvas_agent_tool_calls
      SET status=?, result_json=?, error_message=?, executed_at=?, updated_at=?
      WHERE id=? AND status='approved'
    `).run(
      status,
      stringify(outcome.result ?? null),
      String(outcome.error || '').slice(0, 2000),
      timestamp,
      timestamp,
      callId
    );
    return { toolCall: getToolCall(scope, callId), changed: true };
  });

  function recoverInterrupted() {
    const interruptedToolRows = db.prepare(`
      SELECT * FROM canvas_agent_tool_calls
      WHERE status IN ('approved','executing')
    `).all();
    const interruptedSessionIds = new Set(
      db.prepare("SELECT id FROM canvas_agent_sessions WHERE status='running' AND deleted_at IS NULL")
        .all()
        .map((row) => row.id)
    );
    interruptedToolRows.forEach((row) => interruptedSessionIds.add(row.session_id));
    const timestamp = now();
    if (interruptedToolRows.length) {
      db.prepare(`
        UPDATE canvas_agent_tool_calls
        SET status='interrupted', error_message='服务重启后未自动重放，请重新发起操作', updated_at=?, executed_at=?
        WHERE status IN ('approved','executing')
      `).run(timestamp, timestamp);
    }
    interruptedSessionIds.forEach((id) => {
      db.prepare(`
        UPDATE canvas_agent_sessions
        SET status='interrupted', updated_at=?
        WHERE id=? AND deleted_at IS NULL
      `).run(timestamp, id);
    });
    return {
      sessions: interruptedSessionIds.size,
      toolCalls: interruptedToolRows.length,
      sessionIds: Array.from(interruptedSessionIds)
    };
  }

  return {
    createSession,
    listSessions,
    getSession,
    updateSessionStatus,
    updateSessionSkills,
    deleteSession,
    appendEvent,
    listEvents,
    insertToolCall,
    listToolCalls,
    getToolCall,
    approveToolCall,
    rejectToolCall,
    finishToolCall,
    recoverInterrupted
  };
}

module.exports = {
  agentError,
  createCanvasAgentRepository,
  sanitizeForStorage
};
