'use strict';

const { createGenerationBillingService } = require('../billing/generation-billing');

function repositoryError(status, code, message, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, details);
  return error;
}

function safeParse(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function json(value, fallback) {
  return JSON.stringify(value === undefined ? fallback : value);
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function createGenerationTaskRepository(options = {}) {
  const db = options.db;
  if (!db) throw new TypeError('缺少 SQLite 数据库连接');
  const now = options.now || (() => Date.now());
  const idFactory = options.idFactory || ((prefix) => `${prefix}${Date.now()}_${Math.random().toString(16).slice(2)}`);
  const maxUserNonterminal = Math.max(1, Number(options.maxUserNonterminal || 3));
  const maxQueued = Math.max(1, Number(options.maxQueued || 30));
  const billing = options.billing || createGenerationBillingService({ db });

  function migrate() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS generation_tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        stage TEXT NOT NULL DEFAULT 'queued',
        route_id TEXT DEFAULT '',
        route_key TEXT DEFAULT '',
        route_display_name TEXT DEFAULT '',
        failure_domain TEXT NOT NULL DEFAULT 'default',
        model_key TEXT NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        image_count INTEGER NOT NULL DEFAULT 1,
        unit_cost REAL NOT NULL DEFAULT 0,
        reserved_cost REAL NOT NULL DEFAULT 0,
        settled_cost REAL NOT NULL DEFAULT 0,
        billing_status TEXT NOT NULL DEFAULT 'reserved',
        request_json TEXT NOT NULL DEFAULT '{}',
        request_meta_json TEXT NOT NULL DEFAULT '{}',
        result_json TEXT NOT NULL DEFAULT '[]',
        error_code TEXT DEFAULT '',
        error_message TEXT DEFAULT '',
        queue_position INTEGER NOT NULL DEFAULT 0,
        retry_after_ms INTEGER NOT NULL DEFAULT 0,
        cancellation_reason TEXT DEFAULT '',
        cancel_requested_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        started_at INTEGER,
        finished_at INTEGER,
        UNIQUE(user_id, idempotency_key)
      );
      CREATE INDEX IF NOT EXISTS idx_generation_tasks_status_created
        ON generation_tasks(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_status
        ON generation_tasks(user_id, status, created_at);
      CREATE INDEX IF NOT EXISTS idx_generation_tasks_domain_status
        ON generation_tasks(failure_domain, status, created_at);

      CREATE TABLE IF NOT EXISTS generation_task_items (
        task_id TEXT NOT NULL,
        item_index INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        unit_cost REAL NOT NULL DEFAULT 0,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        result_json TEXT NOT NULL DEFAULT '[]',
        error_code TEXT DEFAULT '',
        error_message TEXT DEFAULT '',
        started_at INTEGER,
        finished_at INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(task_id, item_index)
      );
      CREATE INDEX IF NOT EXISTS idx_generation_task_items_status
        ON generation_task_items(status, updated_at);

      CREATE TABLE IF NOT EXISTS generation_task_attempts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        item_index INTEGER NOT NULL,
        attempt_no INTEGER NOT NULL,
        phase TEXT NOT NULL DEFAULT 'provider',
        transport_mode TEXT DEFAULT '',
        failure_domain TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'running',
        upstream_status INTEGER,
        error_code TEXT DEFAULT '',
        error_message TEXT DEFAULT '',
        request_meta_json TEXT NOT NULL DEFAULT '{}',
        started_at INTEGER NOT NULL,
        finished_at INTEGER,
        duration_ms INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_generation_task_attempts_task
        ON generation_task_attempts(task_id, item_index, started_at);
    `);
    ensureColumn(db, 'generations', 'task_id', "TEXT DEFAULT ''");
    ensureColumn(db, 'generations', 'item_index', 'INTEGER');
    ensureColumn(db, 'balance_logs', 'task_id', "TEXT DEFAULT ''");
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_generations_task_item
        ON generations(task_id, item_index)
        WHERE task_id IS NOT NULL AND task_id <> '' AND item_index IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_balance_logs_task_type
        ON balance_logs(task_id, type)
        WHERE task_id IS NOT NULL AND task_id <> '';
    `);
  }

  function rowToTask(row, includeItems = false) {
    if (!row) return null;
    const task = {
      id: row.id,
      taskId: row.id,
      userId: row.user_id,
      idempotencyKey: row.idempotency_key,
      requestHash: row.request_hash,
      status: row.status,
      stage: row.stage,
      routeId: row.route_id || '',
      lineId: row.route_id || '',
      routeKey: row.route_key || '',
      lineKey: row.route_key || '',
      routeDisplayName: row.route_display_name || '',
      failureDomain: row.failure_domain || 'default',
      modelKey: row.model_key,
      prompt: row.prompt || '',
      imageCount: Number(row.image_count || 1),
      unitCost: Number(row.unit_cost || 0),
      cost: Number(row.settled_cost || row.reserved_cost || 0),
      totalCost: Number(row.settled_cost || row.reserved_cost || 0),
      reservedCost: Number(row.reserved_cost || 0),
      settledCost: Number(row.settled_cost || 0),
      billingStatus: row.billing_status,
      requestPayload: safeParse(row.request_json, {}),
      request: safeParse(row.request_meta_json, {}),
      images: safeParse(row.result_json, []),
      errorCode: row.error_code || '',
      errorMessage: row.error_message || '',
      queuePosition: Number(row.queue_position || 0),
      retryAfterMs: Number(row.retry_after_ms || 0),
      cancellationReason: row.cancellation_reason || '',
      cancelRequestedAt: row.cancel_requested_at || null,
      createdAtMs: row.created_at,
      updatedAtMs: row.updated_at,
      startedAtMs: row.started_at || null,
      finishedAtMs: row.finished_at || null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
      finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null
    };
    if (includeItems) task.items = getItems(task.id);
    return task;
  }

  function getTask(taskId, includeItems = false) {
    return rowToTask(db.prepare('SELECT * FROM generation_tasks WHERE id=?').get(taskId), includeItems);
  }

  function findByIdempotency(userId, idempotencyKey) {
    if (!idempotencyKey) return null;
    return rowToTask(db.prepare('SELECT * FROM generation_tasks WHERE user_id=? AND idempotency_key=?')
      .get(userId, idempotencyKey));
  }

  function getItems(taskId) {
    return db.prepare('SELECT * FROM generation_task_items WHERE task_id=? ORDER BY item_index ASC')
      .all(taskId)
      .map((row) => ({
        taskId: row.task_id,
        itemIndex: Number(row.item_index),
        status: row.status,
        unitCost: Number(row.unit_cost || 0),
        attemptCount: Number(row.attempt_count || 0),
        images: safeParse(row.result_json, []),
        errorCode: row.error_code || '',
        errorMessage: row.error_message || '',
        startedAtMs: row.started_at || null,
        finishedAtMs: row.finished_at || null
      }));
  }

  const createReservedTransaction = db.transaction((input) => {
    const existing = db.prepare('SELECT * FROM generation_tasks WHERE user_id=? AND idempotency_key=?')
      .get(input.userId, input.idempotencyKey);
    if (existing) {
      if (existing.request_hash !== input.requestHash) {
        throw repositoryError(409, 'IDEMPOTENCY_KEY_REUSED', '同一个幂等键不能用于不同的生图请求');
      }
      return { task: rowToTask(existing), replayed: true, remainingBalance: null };
    }

    const userActive = Number(db.prepare(`
      SELECT COUNT(*) AS count
      FROM generation_tasks
      WHERE user_id=? AND status IN ('pending','running')
    `).get(input.userId).count || 0);
    if (userActive >= maxUserNonterminal) {
      throw repositoryError(429, 'GENERATION_USER_LIMIT', `每个用户最多保留 ${maxUserNonterminal} 个未完成生图任务`, { retryAfter: 5 });
    }
    const queued = Number(db.prepare(`
      SELECT COUNT(*) AS count
      FROM generation_tasks
      WHERE status IN ('pending','running')
    `).get().count || 0);
    if (queued >= maxQueued) {
      throw repositoryError(429, 'GENERATION_QUEUE_FULL', '图片生成队列已满，请稍后重试', { retryAfter: 5 });
    }

    const reservation = billing.reserve({
      userId: input.userId,
      taskId: input.id,
      reservedCost: input.reservedCost,
      remark: `生图任务预占: ${input.modelKey} x${input.imageCount}`
    });
    const reservedCost = reservation.reservedCost;

    const timestamp = now();
    db.prepare(`
      INSERT INTO generation_tasks (
        id,user_id,idempotency_key,request_hash,status,stage,
        route_id,route_key,route_display_name,failure_domain,
        model_key,prompt,image_count,unit_cost,reserved_cost,settled_cost,billing_status,
        request_json,request_meta_json,result_json,created_at,updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      input.id,
      input.userId,
      input.idempotencyKey,
      input.requestHash,
      'pending',
      'queued',
      input.routeId || '',
      input.routeKey || '',
      input.routeDisplayName || '',
      input.failureDomain || 'default',
      input.modelKey,
      input.prompt || '',
      input.imageCount,
      input.unitCost,
      reservedCost,
      0,
      'reserved',
      json(input.requestPayload, {}),
      json(input.requestMeta, {}),
      '[]',
      timestamp,
      timestamp
    );
    const insertItem = db.prepare(`
      INSERT INTO generation_task_items (task_id,item_index,status,unit_cost,updated_at)
      VALUES (?,?,?,?,?)
    `);
    for (let index = 0; index < input.imageCount; index += 1) {
      insertItem.run(input.id, index, 'pending', input.unitCost, timestamp);
    }
    return {
      task: getTask(input.id),
      replayed: false,
      remainingBalance: reservation.afterBalance
    };
  });

  function createReservedTask(input) {
    return createReservedTransaction(input);
  }

  function listPendingTasks(limit = maxQueued) {
    return db.prepare(`
      SELECT * FROM generation_tasks
      WHERE status='pending'
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit).map((row) => rowToTask(row));
  }

  function listTasks(limit = 100) {
    return db.prepare(`
      SELECT * FROM generation_tasks
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit).map((row) => rowToTask(row));
  }

  function updateQueueState(taskId, state = {}) {
    const timestamp = now();
    const status = state.status === 'running' ? 'running' : 'pending';
    const stage = status === 'running'
      ? (state.stage || 'connecting')
      : (state.stage === 'provider_degraded' ? 'provider_degraded' : 'queued');
    db.prepare(`
      UPDATE generation_tasks
      SET status=?,stage=?,queue_position=?,retry_after_ms=?,updated_at=?,
          started_at=CASE WHEN ?='running' THEN COALESCE(started_at,?) ELSE started_at END
      WHERE id=? AND status IN ('pending','running')
    `).run(
      status,
      stage,
      status === 'pending' ? Math.max(1, Number(state.queuePosition || 1)) : 0,
      Math.max(0, Number(state.retryAfterMs || 0)),
      timestamp,
      status,
      timestamp,
      taskId
    );
    return getTask(taskId);
  }

  const claimItemTransaction = db.transaction((taskId) => {
    const task = db.prepare("SELECT * FROM generation_tasks WHERE id=? AND status IN ('pending','running')")
      .get(taskId);
    if (!task) return null;
    const item = db.prepare(`
      SELECT * FROM generation_task_items
      WHERE task_id=? AND status='pending'
      ORDER BY item_index ASC
      LIMIT 1
    `).get(taskId);
    if (!item) return null;
    const timestamp = now();
    const updated = db.prepare(`
      UPDATE generation_task_items
      SET status='running',attempt_count=attempt_count+1,started_at=COALESCE(started_at,?),updated_at=?
      WHERE task_id=? AND item_index=? AND status='pending'
    `).run(timestamp, timestamp, taskId, item.item_index);
    if (updated.changes !== 1) return null;
    db.prepare(`
      UPDATE generation_tasks
      SET status='running',stage='connecting',queue_position=0,retry_after_ms=0,
          started_at=COALESCE(started_at,?),updated_at=?
      WHERE id=?
    `).run(timestamp, timestamp, taskId);
    return {
      task: getTask(taskId),
      item: getItems(taskId).find((entry) => entry.itemIndex === Number(item.item_index))
    };
  });

  function claimNextItem(taskId) {
    return claimItemTransaction(taskId);
  }

  function markTaskStage(taskId, stage, requestMeta) {
    const task = getTask(taskId);
    if (!task || !['pending', 'running'].includes(task.status)) return task;
    const meta = {
      ...(task.request || {}),
      ...(requestMeta && typeof requestMeta === 'object' ? requestMeta : {})
    };
    db.prepare(`
      UPDATE generation_tasks
      SET stage=?,request_meta_json=?,updated_at=?
      WHERE id=? AND status IN ('pending','running')
    `).run(stage, json(meta, {}), now(), taskId);
    return getTask(taskId);
  }

  function recordAttemptStart(input) {
    const id = input.id || idFactory('attempt_');
    const timestamp = now();
    db.prepare(`
      INSERT INTO generation_task_attempts (
        id,task_id,item_index,attempt_no,phase,transport_mode,failure_domain,status,
        request_meta_json,started_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      id,
      input.taskId,
      input.itemIndex,
      input.attemptNo || 1,
      input.phase || 'provider',
      input.transportMode || '',
      input.failureDomain || '',
      'running',
      json(input.requestMeta, {}),
      timestamp
    );
    return { id, startedAt: timestamp };
  }

  function recordAttemptFinish(id, input = {}) {
    const row = db.prepare('SELECT started_at FROM generation_task_attempts WHERE id=?').get(id);
    if (!row) return false;
    const timestamp = now();
    db.prepare(`
      UPDATE generation_task_attempts
      SET status=?,upstream_status=?,error_code=?,error_message=?,transport_mode=COALESCE(NULLIF(?,''),transport_mode),request_meta_json=?,
          finished_at=?,duration_ms=?
      WHERE id=?
    `).run(
      input.status || (input.success ? 'success' : 'failed'),
      input.upstreamStatus || null,
      input.errorCode || '',
      input.errorMessage || '',
      input.transportMode || input.requestMeta?.transportMode || '',
      json(input.requestMeta, {}),
      timestamp,
      Math.max(0, timestamp - row.started_at),
      id
    );
    return true;
  }

  function finalizeTask(taskId, options = {}) {
    const taskRow = db.prepare('SELECT * FROM generation_tasks WHERE id=?').get(taskId);
    if (!taskRow) return null;
    const items = db.prepare('SELECT * FROM generation_task_items WHERE task_id=? ORDER BY item_index ASC')
      .all(taskId);
    const active = items.some((item) => ['pending', 'running'].includes(item.status));
    if (active && !options.forceStatus) {
      db.prepare(`
        UPDATE generation_tasks
        SET status='pending',stage='queued',queue_position=0,updated_at=?
        WHERE id=? AND status<>'cancelled'
      `).run(now(), taskId);
      return getTask(taskId, true);
    }
    const successfulItems = items.filter((item) => item.status === 'success');
    const results = successfulItems.flatMap((item) => safeParse(item.result_json, []));
    const settledCost = successfulItems.reduce((total, item) => total + Number(item.unit_cost || 0), 0);
    const refundResult = billing.refundUnused(taskRow, settledCost, options.reason);
    const timestamp = now();
    const status = options.forceStatus || (successfulItems.length ? 'success' : 'failed');
    const requestMeta = safeParse(taskRow.request_meta_json, {});
    const partial = successfulItems.length > 0 && successfulItems.length < items.length;
    const warnings = Array.isArray(requestMeta.warnings) ? [...requestMeta.warnings] : [];
    if (partial) {
      warnings.push(options.errorMessage || taskRow.error_message || '部分图片生成失败，已按实际成功数量结算');
    }
    db.prepare(`
      UPDATE generation_tasks
      SET status=?,stage=?,settled_cost=?,billing_status=?,result_json=?,
          request_meta_json=?,error_code=?,error_message=?,queue_position=0,retry_after_ms=0,
          updated_at=?,finished_at=?
      WHERE id=?
    `).run(
      status,
      status === 'success' ? 'done' : status,
      settledCost,
      refundResult.billingStatus,
      json(results, []),
      json({
        ...requestMeta,
        partial,
        warnings: [...new Set(warnings.filter(Boolean))],
        successfulItems: successfulItems.length,
        requestedItems: items.length
      }, {}),
      options.errorCode || taskRow.error_code || '',
      options.errorMessage || taskRow.error_message || '',
      timestamp,
      timestamp,
      taskId
    );
    return getTask(taskId, true);
  }

  const completeItemTransaction = db.transaction((input) => {
    const task = db.prepare('SELECT * FROM generation_tasks WHERE id=?').get(input.taskId);
    if (!task || !['pending', 'running'].includes(task.status)) return getTask(input.taskId, true);
    const item = db.prepare(`
      SELECT * FROM generation_task_items
      WHERE task_id=? AND item_index=? AND status='running'
    `).get(input.taskId, input.itemIndex);
    if (!item) return getTask(input.taskId, true);
    const timestamp = now();
    const images = Array.isArray(input.images) ? input.images : [];
    db.prepare(`
      UPDATE generation_task_items
      SET status='success',result_json=?,error_code='',error_message='',finished_at=?,updated_at=?
      WHERE task_id=? AND item_index=? AND status='running'
    `).run(json(images, []), timestamp, timestamp, input.taskId, input.itemIndex);

    const generationCost = Number(item.unit_cost || 0) / Math.max(1, images.length);
    const insertGeneration = db.prepare(`
      INSERT OR IGNORE INTO generations (
        id,user_id,model_key,prompt,result_url,cost,status,task_id,item_index
      ) VALUES (?,?,?,?,?,?,?,?,?)
    `);
    images.forEach((image, offset) => {
      insertGeneration.run(
        input.generationIdFactory ? input.generationIdFactory(offset) : idFactory('gen_'),
        task.user_id,
        task.model_key,
        task.prompt,
        image.url || image.imageUrl || '',
        generationCost,
        'completed',
        task.id,
        (Number(input.itemIndex) * 100) + offset
      );
    });
    if (input.requestMeta) {
      const currentMeta = safeParse(task.request_meta_json, {});
      db.prepare('UPDATE generation_tasks SET request_meta_json=?,updated_at=? WHERE id=?')
        .run(json({ ...currentMeta, ...input.requestMeta }, {}), timestamp, input.taskId);
    }
    return finalizeTask(input.taskId);
  });

  function completeItem(input) {
    return completeItemTransaction(input);
  }

  const failTaskTransaction = db.transaction((taskId, input = {}) => {
    const task = db.prepare('SELECT * FROM generation_tasks WHERE id=?').get(taskId);
    if (!task || !['pending', 'running'].includes(task.status)) return getTask(taskId, true);
    const timestamp = now();
    db.prepare(`
      UPDATE generation_task_items
      SET status='failed',error_code=?,error_message=?,finished_at=?,updated_at=?
      WHERE task_id=? AND status IN ('pending','running')
    `).run(input.errorCode || 'PROVIDER_IMAGE_FAILED', input.errorMessage || '图片生成失败', timestamp, timestamp, taskId);
    db.prepare(`
      UPDATE generation_tasks
      SET error_code=?,error_message=?,request_meta_json=?,updated_at=?
      WHERE id=?
    `).run(
      input.errorCode || 'PROVIDER_IMAGE_FAILED',
      input.errorMessage || '图片生成失败',
      json({ ...safeParse(task.request_meta_json, {}), ...(input.requestMeta || {}) }, {}),
      timestamp,
      taskId
    );
    return finalizeTask(taskId, {
      errorCode: input.errorCode || 'PROVIDER_IMAGE_FAILED',
      errorMessage: input.errorMessage || '图片生成失败',
      reason: input.errorMessage || '任务失败'
    });
  });

  function failTask(taskId, input) {
    return failTaskTransaction(taskId, input);
  }

  const cancelTaskTransaction = db.transaction((taskId, input = {}) => {
    const task = db.prepare('SELECT * FROM generation_tasks WHERE id=?').get(taskId);
    if (!task) return null;
    if (!['pending', 'running'].includes(task.status)) {
      throw repositoryError(409, 'TASK_NOT_CANCELLABLE', '只有等待中或运行中的任务可以取消');
    }
    const timestamp = now();
    const reason = input.reason || '用户取消';
    const upstreamBillingAmbiguous = task.status === 'running';
    const errorCode = upstreamBillingAmbiguous ? 'TASK_CANCELLED_UPSTREAM_UNKNOWN' : 'TASK_CANCELLED';
    const errorMessage = upstreamBillingAmbiguous
      ? `${reason}；本地请求已中止，上游可能已计费`
      : reason;
    const requestMeta = {
      ...safeParse(task.request_meta_json, {}),
      upstreamBillingAmbiguous,
      cancelledWhileRunning: upstreamBillingAmbiguous,
      providerBillingStatus: upstreamBillingAmbiguous ? 'unknown' : 'not_charged',
      billingAuditRequired: upstreamBillingAmbiguous
    };
    db.prepare(`
      UPDATE generation_task_items
      SET status='cancelled',
          error_code=CASE WHEN status='running' THEN ? ELSE 'TASK_CANCELLED' END,
          error_message=?,finished_at=?,updated_at=?
      WHERE task_id=? AND status IN ('pending','running')
    `).run(errorCode, errorMessage, timestamp, timestamp, taskId);
    db.prepare(`
      UPDATE generation_tasks
      SET cancellation_reason=?,cancel_requested_at=?,error_code=?,
          error_message=?,request_meta_json=?,updated_at=?
      WHERE id=?
    `).run(reason, timestamp, errorCode, errorMessage, json(requestMeta, {}), timestamp, taskId);
    return finalizeTask(taskId, {
      forceStatus: 'cancelled',
      errorCode,
      errorMessage,
      reason
    });
  });

  function cancelTask(taskId, input) {
    return cancelTaskTransaction(taskId, input);
  }

  function recoverInterruptedTasks() {
    const running = db.prepare("SELECT id FROM generation_tasks WHERE status='running'").all();
    return running.map((row) => failTask(row.id, {
      errorCode: 'WORKER_INTERRUPTED_UNKNOWN',
      errorMessage: '服务重启时任务仍在调用上游，为避免重复计费已停止且不会自动重放',
      requestMeta: {
        providerBillingStatus: 'unknown',
        upstreamBillingAmbiguous: true,
        billingAuditRequired: true,
        interruptedWhileRunning: true
      }
    }));
  }

  function queuePosition(taskId) {
    const rows = db.prepare(`
      SELECT id FROM generation_tasks
      WHERE status='pending'
      ORDER BY created_at ASC
    `).all();
    const index = rows.findIndex((row) => row.id === taskId);
    return index < 0 ? 0 : index + 1;
  }

  function summary() {
    const counts = db.prepare(`
      SELECT status,COUNT(*) AS count
      FROM generation_tasks
      GROUP BY status
    `).all();
    const result = {
      total: 0,
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
      cancelled: 0
    };
    counts.forEach((row) => {
      result[row.status] = Number(row.count || 0);
      result.total += Number(row.count || 0);
    });
    return result;
  }

  const deleteTaskTransaction = db.transaction((taskId) => {
    const task = db.prepare('SELECT * FROM generation_tasks WHERE id=?').get(taskId);
    if (!task) return false;
    if (['pending', 'running'].includes(task.status)) {
      throw repositoryError(409, 'TASK_ACTIVE', '请先取消运行中的任务再删除');
    }
    db.prepare('DELETE FROM generation_task_attempts WHERE task_id=?').run(taskId);
    db.prepare('DELETE FROM generation_task_items WHERE task_id=?').run(taskId);
    db.prepare('DELETE FROM generations WHERE task_id=?').run(taskId);
    db.prepare('DELETE FROM generation_tasks WHERE id=?').run(taskId);
    return true;
  });

  function deleteTask(taskId) {
    return deleteTaskTransaction(taskId);
  }

  migrate();

  return {
    createReservedTask,
    getTask,
    findByIdempotency,
    getItems,
    listPendingTasks,
    listTasks,
    updateQueueState,
    claimNextItem,
    markTaskStage,
    recordAttemptStart,
    recordAttemptFinish,
    completeItem,
    failTask,
    cancelTask,
    recoverInterruptedTasks,
    queuePosition,
    summary,
    deleteTask
  };
}

module.exports = {
  createGenerationTaskRepository,
  repositoryError
};
