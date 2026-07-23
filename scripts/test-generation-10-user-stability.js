'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');

const repoRoot = path.resolve(__dirname, '..');
const jwtSecret = 'hjm-mb-local-dev-secret';
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nH0AAAAASUVORK5CYII=';

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

async function freePort() {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON: ${response.status} ${text}`);
  }
}

async function waitForHealth(baseUrl, child, stderr) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Disposable app exited (${child.exitCode}): ${stderr.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Disposable app health timeout: ${stderr.join('')}`);
}

function startApp(appPort, providerPort, paths) {
  const stderr = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      DATA_DIR: paths.dataDir,
      DB_PATH: paths.dbPath,
      UPLOAD_DIR: paths.uploadDir,
      LOG_DIR: paths.logDir,
      WORKFLOW_DIR: paths.workflowDir,
      GENERATION_TASK_INPUT_DIR: paths.taskInputDir,
      ENABLE_REAL_AI: 'true',
      ENABLE_REAL_EMAIL: 'false',
      ENABLE_REAL_PAYMENT: 'false',
      ENABLE_REAL_STORAGE: 'false',
      AI_PROVIDER_GATEWAY: 'legacy',
      AI_API_BASE: `http://127.0.0.1:${providerPort}/v1`,
      AI_IMAGE_KEY: 'sk-fake-stability-image-key',
      AI_TEXT_KEY: 'sk-fake-stability-text-key',
      GENERATION_GLOBAL_CONCURRENCY: '3',
      GENERATION_DOMAIN_CONCURRENCY: '1',
      GENERATION_MAX_QUEUED: '30',
      IMAGE_PROVIDER_REQUEST_DELAY_MS: '0'
    },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true
  });
  child.stderr.on('data', (chunk) => stderr.push(chunk.toString('utf8')));
  return { child, stderr };
}

async function stopApp(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => {
    child.once('exit', resolve);
    setTimeout(resolve, 3000);
  });
}

function userToken(userId, role = 'user') {
  return jwt.sign({ userId, role }, jwtSecret, { expiresIn: '1h' });
}

function authHeaders(token, idempotencyKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
  };
}

async function submitTask(baseUrl, token, routeId, prompt, idempotencyKey, extra = {}) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}/api/generate/tasks`, {
    method: 'POST',
    headers: authHeaders(token, idempotencyKey),
    body: JSON.stringify({
      prompt,
      modelKey: 'gpt-image-2',
      imageCount: 1,
      ratio: '1:1',
      clarity: '1k',
      routeId,
      ...extra
    })
  });
  const data = await readJson(response);
  return { response, data, elapsedMs: performance.now() - startedAt };
}

async function getTask(baseUrl, token, taskId) {
  const response = await fetch(`${baseUrl}/api/generate/tasks/${encodeURIComponent(taskId)}`, {
    headers: authHeaders(token)
  });
  return readJson(response);
}

async function waitTask(baseUrl, token, taskId, statuses = ['success', 'failed', 'cancelled'], timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let task = null;
  while (Date.now() < deadline) {
    task = await getTask(baseUrl, token, taskId);
    if (statuses.includes(task.status)) return task;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Task ${taskId} timeout: ${JSON.stringify(task)}`);
}

async function cancelTask(baseUrl, token, taskId, reason) {
  const response = await fetch(`${baseUrl}/api/generate/tasks/${encodeURIComponent(taskId)}/cancel`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ reason })
  });
  return { response, data: await readJson(response) };
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-generation-stability-'));
  const paths = {
    dataDir: path.join(tempRoot, 'data'),
    dbPath: path.join(tempRoot, 'data', 'data.db'),
    uploadDir: path.join(tempRoot, 'uploads'),
    logDir: path.join(tempRoot, 'logs'),
    workflowDir: path.join(tempRoot, 'workflows'),
    taskInputDir: path.join(tempRoot, 'task-inputs')
  };
  Object.values(paths).filter((value) => !path.extname(value)).forEach((value) => fs.mkdirSync(value, { recursive: true }));
  const expiredTaskDirectory = path.join(paths.taskInputDir, 'expired-task-input');
  fs.mkdirSync(expiredTaskDirectory, { recursive: true });
  fs.writeFileSync(path.join(expiredTaskDirectory, 'reference-1.png'), Buffer.from(pngBase64, 'base64'));
  const expiredAt = new Date(Date.now() - (25 * 60 * 60 * 1000));
  fs.utimesSync(expiredTaskDirectory, expiredAt, expiredAt);

  let providerCalls = 0;
  let activeProviderRequests = 0;
  let maxActiveProviderRequests = 0;
  const providerStarts = [];
  const providerConnections = new Set();
  const promptCalls = new Map();
  const fakeProvider = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      if (req.method !== 'POST' || !['/v1/images/generations', '/v1/images/edits'].includes(req.url)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'unexpected request' } }));
        return;
      }
      const bodyText = Buffer.concat(chunks).toString('utf8');
      let prompt = bodyText;
      try {
        prompt = JSON.parse(bodyText).prompt || bodyText;
      } catch {}
      providerCalls += 1;
      providerConnections.add(req.socket.remotePort);
      activeProviderRequests += 1;
      maxActiveProviderRequests = Math.max(maxActiveProviderRequests, activeProviderRequests);
      providerStarts.push(prompt);
      const promptCount = (promptCalls.get(prompt) || 0) + 1;
      promptCalls.set(prompt, promptCount);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        activeProviderRequests = Math.max(0, activeProviderRequests - 1);
      };
      res.once('close', finish);
      res.once('finish', finish);

      const delay = prompt.includes('restart-slow') ? 5000
        : (prompt.includes('running-cancel') || prompt.includes('pending-blocker') ? 1500 : 70);
      setTimeout(() => {
        if (res.destroyed || res.writableEnded) return finish();
        if (prompt.includes('partial-batch') && promptCount >= 2) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'simulated partial failure' } }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ b64_json: pngBase64 }] }));
      }, delay);
    });
  });

  const providerPort = await listen(fakeProvider);
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  let app = startApp(appPort, providerPort, paths);
  let db;
  try {
    await waitForHealth(baseUrl, app.child, app.stderr);
    for (let attempt = 0; attempt < 50 && fs.existsSync(expiredTaskDirectory); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(fs.existsSync(expiredTaskDirectory), false, '超过 24 小时的任务输入目录必须在启动后清理');
    db = new Database(paths.dbPath);
    const admin = db.prepare("SELECT id FROM users WHERE username='admin'").get();
    assert(admin, 'Disposable admin missing');
    const adminToken = userToken(admin.id, 'admin');

    const routeResponse = await fetch(`${baseUrl}/api/admin/api-providers`, {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: JSON.stringify({
        routeKey: 'stability-provider',
        displayName: 'Stability Provider',
        category: 'image',
        apiFormat: 'lingsuan-images',
        baseUrl: `http://127.0.0.1:${providerPort}/v1`,
        defaultImageModel: 'gpt-image-2'
      })
    });
    const routeData = await readJson(routeResponse);
    assert.equal(routeResponse.status, 200, JSON.stringify(routeData));
    const routeId = routeData.item?.id || routeData.id;
    assert(routeId, 'Route id missing');

    const insertUser = db.prepare(`
      INSERT INTO users (id,username,email,password_hash,role,balance,status)
      VALUES (?,?,?,?,?,?,?)
    `);
    const tokens = new Map();
    for (let index = 1; index <= 13; index += 1) {
      const id = `stability_user_${index}`;
      const passwordHash = crypto.createHash('sha256').update(`test-password-${jwtSecret}`).digest('hex');
      insertUser.run(id, `stability${index}`, `stability${index}@example.test`, passwordHash, 'user', 100, 'active');
      tokens.set(index, userToken(id));
    }

    const acknowledgements = [];
    const taskIds = [];
    for (let round = 1; round <= 3; round += 1) {
      const roundResults = await Promise.all(Array.from({ length: 10 }, (_, offset) => {
        const user = offset + 1;
        return submitTask(
          baseUrl,
          tokens.get(user),
          routeId,
          `normal:user-${user}:round-${round}`,
          `normal-${user}-${round}`
        );
      }));
      roundResults.forEach((result, offset) => {
        assert.equal(result.response.status, 202, JSON.stringify(result.data));
        assert(result.data.taskId, 'Accepted task id missing');
        assert(!result.data.error, JSON.stringify(result.data));
        acknowledgements.push(result.elapsedMs);
        taskIds.push({ user: offset + 1, round, taskId: result.data.taskId });
      });
    }
    const sortedAck = [...acknowledgements].sort((a, b) => a - b);
    const p95Ack = sortedAck[Math.min(sortedAck.length - 1, Math.floor(sortedAck.length * 0.95))];
    assert(p95Ack < 3000, `Submit p95 ${p95Ack.toFixed(1)}ms exceeds 3s`);

    const terminal = await Promise.all(taskIds.map((item) => waitTask(
      baseUrl,
      tokens.get(item.user),
      item.taskId
    )));
    terminal.forEach((task) => assert.equal(task.status, 'success', JSON.stringify(task)));
    assert.equal(providerCalls, 30, '30 logical tasks must produce exactly 30 Provider calls');
    assert(maxActiveProviderRequests <= 1, `Failure-domain concurrency exceeded: ${maxActiveProviderRequests}`);
    assert(providerConnections.size < providerCalls, 'Provider HTTP 连接未复用');
    const firstRoundUsersBeforeSecond = new Set();
    for (const prompt of providerStarts) {
      if (prompt.includes('round-2')) break;
      const match = prompt.match(/normal:user-(\d+):round-1/);
      if (match) firstRoundUsersBeforeSecond.add(match[1]);
    }
    assert.equal(firstRoundUsersBeforeSecond.size, 10, 'All users must receive a first turn before any second-round task');
    for (let user = 1; user <= 10; user += 1) {
      const balance = db.prepare('SELECT balance FROM users WHERE id=?').get(`stability_user_${user}`).balance;
      assert.equal(balance, 70, `User ${user} balance mismatch`);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    const adminTasksResponse = await fetch(`${baseUrl}/api/admin/generate-tasks`, {
      headers: authHeaders(adminToken)
    });
    const adminTasks = await readJson(adminTasksResponse);
    assert.equal(adminTasksResponse.status, 200);
    assert.equal(adminTasks.summary.queue.active, 0, '三轮任务结束后不应残留活动 Worker');
    assert.equal(adminTasks.summary.queue.queued, 0, '三轮任务结束后不应残留进程内队列');

    const replay = await submitTask(baseUrl, tokens.get(1), routeId, 'normal:user-1:round-1', 'normal-1-1');
    assert.equal(replay.response.status, 202);
    assert.equal(replay.data.replayed, true);
    assert.equal(replay.data.taskId, taskIds.find((item) => item.user === 1 && item.round === 1).taskId);
    assert.equal(providerCalls, 30, 'Idempotent replay must not call Provider');

    const partial = await submitTask(
      baseUrl,
      tokens.get(11),
      routeId,
      'partial-batch',
      'partial-batch-1',
      { imageCount: 2 }
    );
    const partialTask = await waitTask(baseUrl, tokens.get(11), partial.data.taskId);
    assert.equal(partialTask.status, 'success');
    assert.equal(partialTask.partial, true);
    assert.equal(partialTask.settledCost, 10);
    assert.equal(db.prepare("SELECT balance FROM users WHERE id='stability_user_11'").get().balance, 90);

    const blocker = await submitTask(baseUrl, tokens.get(12), routeId, 'pending-blocker', 'pending-blocker-1');
    const blockerRunning = await waitTask(baseUrl, tokens.get(12), blocker.data.taskId, ['running'], 3000);
    assert(
      ['connecting', 'upstream_generating'].includes(blockerRunning.stage),
      `运行中任务必须返回真实 Provider 阶段: ${blockerRunning.stage}`
    );
    const pending = await submitTask(baseUrl, tokens.get(12), routeId, 'pending-cancel', 'pending-cancel-1');
    const pendingCancel = await cancelTask(baseUrl, tokens.get(12), pending.data.taskId, '测试等待中取消');
    assert.equal(pendingCancel.response.status, 200);
    assert.equal(pendingCancel.data.status, 'cancelled');
    await waitTask(baseUrl, tokens.get(12), blocker.data.taskId);
    assert.equal(db.prepare("SELECT balance FROM users WHERE id='stability_user_12'").get().balance, 90);

    const running = await submitTask(baseUrl, tokens.get(13), routeId, 'running-cancel', 'running-cancel-1');
    await waitTask(baseUrl, tokens.get(13), running.data.taskId, ['running'], 3000);
    const runningCancel = await cancelTask(baseUrl, tokens.get(13), running.data.taskId, '测试运行中取消');
    assert.equal(runningCancel.response.status, 200);
    assert.equal(runningCancel.data.status, 'cancelled');
    assert.equal(db.prepare("SELECT balance FROM users WHERE id='stability_user_13'").get().balance, 100);

    const callsBeforeOversize = providerCalls;
    const tooManyReferences = await submitTask(
      baseUrl,
      tokens.get(13),
      routeId,
      'too-many-references',
      'too-many-references-1',
      { referenceImages: Array.from({ length: 5 }, () => `data:image/png;base64,${pngBase64}`) }
    );
    assert.equal(tooManyReferences.response.status, 413);
    assert.equal(tooManyReferences.data.code, 'GENERATION_REFERENCE_COUNT_EXCEEDED');
    assert.equal(providerCalls, callsBeforeOversize);
    const oversizedReference = await submitTask(
      baseUrl,
      tokens.get(13),
      routeId,
      'oversized-reference',
      'oversized-reference-1',
      { referenceImages: [`data:image/png;base64,${Buffer.alloc((5 * 1024 * 1024) + 1).toString('base64')}`] }
    );
    assert.equal(oversizedReference.response.status, 413);
    assert.equal(oversizedReference.data.code, 'GENERATION_REFERENCE_IMAGE_TOO_LARGE');
    assert.equal(providerCalls, callsBeforeOversize);

    insertUser.run(
      'restart_user',
      'restart-user',
      'restart@example.test',
      crypto.createHash('sha256').update(`test-password-${jwtSecret}`).digest('hex'),
      'user',
      100,
      'active'
    );
    const restartToken = userToken('restart_user');
    const restartFirst = await submitTask(baseUrl, restartToken, routeId, 'restart-slow', 'restart-first');
    await waitTask(baseUrl, restartToken, restartFirst.data.taskId, ['running'], 3000);
    const restartSecond = await submitTask(baseUrl, restartToken, routeId, 'restart-pending', 'restart-second');
    assert(['pending', 'running'].includes(restartSecond.data.status));
    await stopApp(app.child);
    app = startApp(appPort, providerPort, paths);
    await waitForHealth(baseUrl, app.child, app.stderr);
    const interrupted = await waitTask(baseUrl, restartToken, restartFirst.data.taskId);
    const resumed = await waitTask(baseUrl, restartToken, restartSecond.data.taskId);
    assert.equal(interrupted.status, 'failed');
    assert.equal(interrupted.errorCode, 'WORKER_INTERRUPTED_UNKNOWN');
    assert.equal(resumed.status, 'success');
    assert.equal(promptCalls.get('restart-slow'), 1, 'Interrupted running task must not be replayed');
    assert.equal(db.prepare("SELECT balance FROM users WHERE id='restart_user'").get().balance, 90);

    const negativeBalances = db.prepare('SELECT COUNT(*) AS count FROM users WHERE balance < 0').get().count;
    assert.equal(negativeBalances, 0);
    const duplicateReserveLogs = db.prepare(`
      SELECT task_id,type,COUNT(*) AS count
      FROM balance_logs
      WHERE task_id<>''
      GROUP BY task_id,type
      HAVING COUNT(*) > 1
    `).all();
    assert.deepEqual(duplicateReserveLogs, []);
    console.log(JSON.stringify({
      success: true,
      users: 10,
      tasks: 30,
      submitP95Ms: Number(p95Ack.toFixed(1)),
      maxProviderConcurrency: maxActiveProviderRequests,
      providerConnections: providerConnections.size,
      restartRecovery: true
    }));
  } finally {
    if (db) db.close();
    await stopApp(app.child);
    await new Promise((resolve) => fakeProvider.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
