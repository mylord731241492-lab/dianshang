'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
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
      GENERATION_CIRCUIT_THRESHOLD: '3',
      GENERATION_CIRCUIT_WINDOW_MS: '5000',
      GENERATION_CIRCUIT_OPEN_MS: '1000',
      GENERATION_INPUT_CLEANUP_INTERVAL_MS: '100',
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

function processRssBytes(pid) {
  if (!pid) return 0;
  if (process.platform === 'win32') {
    const output = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true
    });
    const match = output.match(/"([\d,]+) K"\s*$/m);
    return match ? Number(match[1].replace(/,/g, '')) * 1024 : 0;
  }
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
    return match ? Number(match[1]) * 1024 : 0;
  } catch {
    return 0;
  }
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

      if (prompt.includes('provider-disconnect') || prompt.includes('circuit-transient-disconnect')) {
        const disconnectTimer = setTimeout(() => {
          finish();
          req.socket.destroy();
        }, 20);
        if (typeof disconnectTimer.unref === 'function') disconnectTimer.unref();
        return;
      }

      const delay = prompt.includes('restart-slow') ? 5000
        : (prompt.includes('queue-pressure') ? 3000
            : (prompt.includes('mixed-domain') ? 500
              : (prompt.includes('provider-timeout') ? 500
                : (prompt.includes('running-cancel') || prompt.includes('pending-blocker') ? 1500 : 70))));
      const responseTimer = setTimeout(() => {
        if (res.destroyed || res.writableEnded) return finish();
        if (prompt.includes('provider-400') || prompt.includes('circuit-nontransient-400')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'simulated non-transient rejection' } }));
          return;
        }
        if (prompt.includes('provider-503') || prompt.includes('circuit-transient-503')) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'simulated transient upstream failure' } }));
          return;
        }
        if (prompt.includes('partial-batch') && promptCount >= 2) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: { message: 'simulated partial failure' } }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ b64_json: pngBase64 }] }));
      }, delay);
      if (typeof responseTimer.unref === 'function') responseTimer.unref();
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
    for (let index = 1; index <= 20; index += 1) {
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
    const maxSameDomainProviderRequests = maxActiveProviderRequests;
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

    const callsBeforeIdempotencyStorm = providerCalls;
    const idempotencyStorm = await Promise.all(Array.from({ length: 50 }, () => submitTask(
      baseUrl,
      tokens.get(14),
      routeId,
      'idempotency-storm',
      'idempotency-storm-1'
    )));
    idempotencyStorm.forEach((result) => assert.equal(result.response.status, 202, JSON.stringify(result.data)));
    const stormTaskIds = new Set(idempotencyStorm.map((result) => result.data.taskId));
    assert.equal(stormTaskIds.size, 1, '50 个同键并发请求必须复用同一任务');
    const stormTaskId = [...stormTaskIds][0];
    await waitTask(baseUrl, tokens.get(14), stormTaskId);
    assert.equal(providerCalls, callsBeforeIdempotencyStorm + 1, '同键并发风暴只能调用 Provider 一次');
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM balance_logs WHERE task_id=? AND type='generation_reserve'").get(stormTaskId).count,
      1,
      '同键并发风暴只能预占一次'
    );
    assert.equal(db.prepare("SELECT balance FROM users WHERE id='stability_user_14'").get().balance, 90);

    const createStressRoute = async (routeKey, apiFormat, extra = {}) => {
      const response = await fetch(`${baseUrl}/api/admin/api-providers`, {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          routeKey,
          displayName: routeKey,
          category: 'image',
          apiFormat,
          baseUrl: `http://127.0.0.1:${providerPort}/v1`,
          defaultImageModel: 'gpt-image-2',
          ...extra
        })
      });
      const data = await readJson(response);
      assert.equal(response.status, 200, JSON.stringify(data));
      const createdRouteId = data.item?.id || data.id;
      assert(createdRouteId, `${routeKey} route id missing`);
      return createdRouteId;
    };
    const packyRouteId = await createStressRoute('stability-provider-packy', 'packy-images');
    const genericRouteId = await createStressRoute('stability-provider-generic', 'new-api');
    maxActiveProviderRequests = 0;
    const mixedDomainTasks = await Promise.all([
      submitTask(baseUrl, tokens.get(15), routeId, 'mixed-domain:lingsuan', 'mixed-domain-1'),
      submitTask(baseUrl, tokens.get(16), packyRouteId, 'mixed-domain:packy', 'mixed-domain-2'),
      submitTask(baseUrl, tokens.get(17), genericRouteId, 'mixed-domain:generic', 'mixed-domain-3')
    ]);
    const mixedDomainTerminal = await Promise.all(mixedDomainTasks.map((result, index) => {
      assert.equal(result.response.status, 202, JSON.stringify(result.data));
      return waitTask(baseUrl, tokens.get(index + 15), result.data.taskId);
    }));
    mixedDomainTerminal.forEach((task) => assert.equal(task.status, 'success', JSON.stringify(task)));
    assert.equal(maxActiveProviderRequests, 3, '三个独立失败域应利用全局 3 并发');

    const timeoutRouteId = await createStressRoute(
      'stability-provider-timeout',
      'timeout-openai',
      { imageTimeoutMs: 150 }
    );
    const timeoutTask = await submitTask(
      baseUrl,
      tokens.get(18),
      timeoutRouteId,
      'provider-timeout',
      'provider-timeout-1'
    );
    const timeoutTerminal = await waitTask(baseUrl, tokens.get(18), timeoutTask.data.taskId);
    assert.equal(timeoutTerminal.status, 'failed');
    assert.equal(timeoutTerminal.errorCode, 'PROVIDER_IMAGE_TIMEOUT');

    const faultRouteId = await createStressRoute('stability-provider-faults', 'fault-openai');
    const runFault = async (user, prompt, key, expectedCode) => {
      const submitted = await submitTask(baseUrl, tokens.get(user), faultRouteId, prompt, key);
      assert.equal(submitted.response.status, 202, JSON.stringify(submitted.data));
      const terminalTask = await waitTask(baseUrl, tokens.get(user), submitted.data.taskId);
      assert.equal(terminalTask.status, 'failed');
      assert.equal(terminalTask.errorCode, expectedCode);
      return terminalTask;
    };
    await runFault(18, 'circuit-transient-disconnect-1', 'circuit-fault-1', 'PROVIDER_IMAGE_ERROR');
    await runFault(19, 'circuit-nontransient-400', 'circuit-fault-2', 'PROVIDER_IMAGE_FAILED');
    await runFault(18, 'circuit-transient-disconnect-2', 'circuit-fault-3', 'PROVIDER_IMAGE_ERROR');
    await runFault(19, 'circuit-transient-503-2', 'circuit-fault-4', 'PROVIDER_IMAGE_FAILED');
    let circuitResponse = await fetch(`${baseUrl}/api/admin/generate-tasks`, {
      headers: authHeaders(adminToken)
    });
    let circuitData = await readJson(circuitResponse);
    const faultDomain = Object.keys(circuitData.summary.queue.circuits)
      .find((domain) => domain.includes('fault-openai'));
    assert(faultDomain, '故障线路必须暴露熔断状态');
    assert.equal(circuitData.summary.queue.circuits[faultDomain].consecutiveFailures, 2);
    assert.equal(circuitData.summary.queue.circuits[faultDomain].open, false);
    await runFault(20, 'circuit-transient-503-3', 'circuit-fault-5', 'PROVIDER_IMAGE_FAILED');
    circuitResponse = await fetch(`${baseUrl}/api/admin/generate-tasks`, {
      headers: authHeaders(adminToken)
    });
    circuitData = await readJson(circuitResponse);
    assert.equal(circuitData.summary.queue.circuits[faultDomain].open, true);
    const callsBeforeCircuitRecovery = providerCalls;
    const circuitRecovery = await submitTask(
      baseUrl,
      tokens.get(20),
      faultRouteId,
      'circuit-recover',
      'circuit-recover-1'
    );
    assert.equal(circuitRecovery.response.status, 202, JSON.stringify(circuitRecovery.data));
    await new Promise((resolve) => setTimeout(resolve, 80));
    const circuitPending = await getTask(baseUrl, tokens.get(20), circuitRecovery.data.taskId);
    assert.equal(circuitPending.status, 'pending');
    assert(circuitPending.retryAfterMs > 0, '熔断窗口内必须返回 retryAfterMs');
    assert.equal(providerCalls, callsBeforeCircuitRecovery, '熔断窗口内不得向上游发送请求');
    const circuitRecovered = await waitTask(baseUrl, tokens.get(20), circuitRecovery.data.taskId, ['success'], 5000);
    assert.equal(circuitRecovered.status, 'success');

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
    assert(Array.isArray(partialTask.warnings) && partialTask.warnings.length > 0);
    assert.equal(partialTask.settledCost, 10);
    assert.equal(db.prepare("SELECT balance FROM users WHERE id='stability_user_11'").get().balance, 90);

    const blocker = await submitTask(baseUrl, tokens.get(12), routeId, 'pending-blocker', 'pending-blocker-1');
    const blockerRunning = await waitTask(baseUrl, tokens.get(12), blocker.data.taskId, ['running'], 3000);
    assert(
      ['connecting', 'upstream_generating'].includes(blockerRunning.stage),
      `运行中任务必须返回真实 Provider 阶段: ${blockerRunning.stage}`
    );
    const pending = await submitTask(baseUrl, tokens.get(12), routeId, 'pending-cancel', 'pending-cancel-1');
    const pendingTaskDirectory = path.join(paths.taskInputDir, pending.data.taskId);
    fs.utimesSync(pendingTaskDirectory, expiredAt, expiredAt);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(fs.existsSync(pendingTaskDirectory), true, '清理器不得删除等待中的任务输入目录');
    const pendingCancel = await cancelTask(baseUrl, tokens.get(12), pending.data.taskId, '测试等待中取消');
    assert.equal(pendingCancel.response.status, 200);
    assert.equal(pendingCancel.data.status, 'cancelled');
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(fs.existsSync(pendingTaskDirectory), false, '终态任务输入目录超过保留期后必须清理');
    await waitTask(baseUrl, tokens.get(12), blocker.data.taskId);
    assert.equal(db.prepare("SELECT balance FROM users WHERE id='stability_user_12'").get().balance, 90);

    const running = await submitTask(baseUrl, tokens.get(13), routeId, 'running-cancel', 'running-cancel-1');
    await waitTask(baseUrl, tokens.get(13), running.data.taskId, ['running'], 3000);
    const runningCancel = await cancelTask(baseUrl, tokens.get(13), running.data.taskId, '测试运行中取消');
    assert.equal(runningCancel.response.status, 200);
    assert.equal(runningCancel.data.status, 'cancelled');
    assert.equal(runningCancel.data.errorCode, 'TASK_CANCELLED_UPSTREAM_UNKNOWN');
    assert.equal(runningCancel.data.request.upstreamBillingAmbiguous, true);
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

    const queueBalancesBefore = new Map();
    for (let user = 1; user <= 10; user += 1) {
      queueBalancesBefore.set(
        user,
        db.prepare('SELECT balance FROM users WHERE id=?').get(`stability_user_${user}`).balance
      );
    }
    const queuePressure = await Promise.all(Array.from({ length: 30 }, (_, index) => {
      const user = (index % 10) + 1;
      return submitTask(
        baseUrl,
        tokens.get(user),
        routeId,
        `queue-pressure:user-${user}:task-${index + 1}`,
        `queue-pressure-${index + 1}`
      ).then((result) => ({ ...result, user }));
    }));
    queuePressure.forEach((result) => assert.equal(result.response.status, 202, JSON.stringify(result.data)));
    const overflow = await submitTask(
      baseUrl,
      tokens.get(18),
      routeId,
      'queue-pressure-overflow',
      'queue-pressure-overflow-1'
    );
    assert.equal(overflow.response.status, 429);
    assert.equal(overflow.data.code, 'GENERATION_QUEUE_FULL');
    assert.equal(overflow.response.headers.get('retry-after'), '5');
    const queueCancelled = await Promise.all(queuePressure.map((result) => cancelTask(
      baseUrl,
      tokens.get(result.user),
      result.data.taskId,
      '压力测试批量取消'
    )));
    queueCancelled.forEach((result) => {
      assert.equal(result.response.status, 200, JSON.stringify(result.data));
      assert.equal(result.data.status, 'cancelled');
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const queueSummaryResponse = await fetch(`${baseUrl}/api/admin/generate-tasks`, {
      headers: authHeaders(adminToken)
    });
    const queueSummary = await readJson(queueSummaryResponse);
    assert.equal(queueSummary.summary.queue.active, 0, '批量取消后不得残留活动 Provider 请求');
    assert.equal(queueSummary.summary.queue.queued, 0, '批量取消后不得残留进程内排队任务');
    for (let user = 1; user <= 10; user += 1) {
      assert.equal(
        db.prepare('SELECT balance FROM users WHERE id=?').get(`stability_user_${user}`).balance,
        queueBalancesBefore.get(user),
        `用户 ${user} 批量取消后余额未恢复`
      );
    }

    const soakCycles = Math.max(0, Math.min(20, Number(process.env.GENERATION_SOAK_CYCLES || 0)));
    const rssSamples = [];
    const heapUsedSamples = [];
    const externalSamples = [];
    if (soakCycles > 0) {
      db.prepare("UPDATE users SET balance=10000 WHERE id LIKE 'stability_user_%'").run();
      rssSamples.push(processRssBytes(app.child.pid));
      heapUsedSamples.push(Number(queueSummary.summary.processMemory?.heapUsed || 0));
      externalSamples.push(Number(queueSummary.summary.processMemory?.external || 0));
      for (let cycle = 1; cycle <= soakCycles; cycle += 1) {
        const soakTasks = await Promise.all(Array.from({ length: 30 }, (_, index) => {
          const user = (index % 10) + 1;
          const round = Math.floor(index / 10) + 1;
          return submitTask(
            baseUrl,
            tokens.get(user),
            routeId,
            `soak:cycle-${cycle}:user-${user}:round-${round}`,
            `soak-${cycle}-${user}-${round}`
          ).then((result) => ({ ...result, user }));
        }));
        soakTasks.forEach((result) => assert.equal(result.response.status, 202, JSON.stringify(result.data)));
        const soakTerminal = await Promise.all(soakTasks.map((result) => waitTask(
          baseUrl,
          tokens.get(result.user),
          result.data.taskId,
          ['success', 'failed', 'cancelled'],
          15000
        )));
        soakTerminal.forEach((task) => assert.equal(task.status, 'success', JSON.stringify(task)));
        await new Promise((resolve) => setTimeout(resolve, 50));
        const response = await fetch(`${baseUrl}/api/admin/generate-tasks`, {
          headers: authHeaders(adminToken)
        });
        const data = await readJson(response);
        assert.equal(data.summary.queue.active, 0, `浸泡轮次 ${cycle} 后存在活动任务`);
        assert.equal(data.summary.queue.queued, 0, `浸泡轮次 ${cycle} 后存在残留队列`);
        rssSamples.push(processRssBytes(app.child.pid));
        heapUsedSamples.push(Number(data.summary.processMemory?.heapUsed || 0));
        externalSamples.push(Number(data.summary.processMemory?.external || 0));
      }
      for (let user = 1; user <= 10; user += 1) {
        assert.equal(
          db.prepare('SELECT balance FROM users WHERE id=?').get(`stability_user_${user}`).balance,
          10000 - (soakCycles * 30),
          `用户 ${user} 浸泡测试余额不一致`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const idleMemoryResponse = await fetch(`${baseUrl}/api/admin/generate-tasks`, {
        headers: authHeaders(adminToken)
      });
      const idleMemoryData = await readJson(idleMemoryResponse);
      rssSamples.push(processRssBytes(app.child.pid));
      heapUsedSamples.push(Number(idleMemoryData.summary.processMemory?.heapUsed || 0));
      externalSamples.push(Number(idleMemoryData.summary.processMemory?.external || 0));
      const validRss = rssSamples.filter((value) => value > 0);
      if (validRss.length >= 2) {
        const rssGrowth = validRss[validRss.length - 1] - Math.min(...validRss);
        const maxRssGrowthMiB = Math.max(
          1,
          Number(process.env.GENERATION_STRESS_MAX_RSS_GROWTH_MIB || 256)
        );
        const maxRssMiB = Math.max(64, Number(process.env.GENERATION_STRESS_MAX_RSS_MIB || 384));
        assert(
          rssGrowth < maxRssGrowthMiB * 1024 * 1024,
          `浸泡测试 RSS 增长过大: ${(rssGrowth / 1024 / 1024).toFixed(1)} MiB`
        );
        assert(
          validRss[validRss.length - 1] < maxRssMiB * 1024 * 1024,
          `浸泡测试空闲 RSS 超限: ${(validRss[validRss.length - 1] / 1024 / 1024).toFixed(1)} MiB`
        );
      }
      if (heapUsedSamples.length >= 2) {
        const heapGrowth = heapUsedSamples[heapUsedSamples.length - 1] - heapUsedSamples[0];
        assert(heapGrowth < 64 * 1024 * 1024, `浸泡测试存活堆增长过大: ${(heapGrowth / 1024 / 1024).toFixed(1)} MiB`);
      }
      if (externalSamples.length >= 2) {
        const externalGrowth = externalSamples[externalSamples.length - 1] - externalSamples[0];
        assert(externalGrowth < 32 * 1024 * 1024, `浸泡测试外部内存增长过大: ${(externalGrowth / 1024 / 1024).toFixed(1)} MiB`);
      }
    }
    const validRssSamples = rssSamples.filter((value) => value > 0);

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
      maxSameDomainConcurrency: maxSameDomainProviderRequests,
      maxMixedDomainConcurrency: maxActiveProviderRequests,
      providerConnections: providerConnections.size,
      idempotencyStormRequests: idempotencyStorm.length,
      queueCapacity: 30,
      soakCycles,
      soakTasks: soakCycles * 30,
      rssSamplesMiB: validRssSamples.map((value) => Number((value / 1024 / 1024).toFixed(1))),
      heapUsedSamplesMiB: heapUsedSamples.map((value) => Number((value / 1024 / 1024).toFixed(1))),
      externalSamplesMiB: externalSamples.map((value) => Number((value / 1024 / 1024).toFixed(1))),
      rssGrowthMiB: validRssSamples.length >= 2
        ? Number(((validRssSamples[validRssSamples.length - 1] - Math.min(...validRssSamples)) / 1024 / 1024).toFixed(1))
        : 0,
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
