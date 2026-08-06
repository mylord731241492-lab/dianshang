// 生图任务 → 云端资产库挂钩契约测试（Task 8）。
// 启动 disposable 后端（Fake Provider：ENABLE_REAL_AI=false，不产生任何真实 Provider 调用与费用；
// Fake Storage：ENABLE_REAL_STORAGE=false），验证：
// - POST /api/generate/tasks 幂等：同一 clientRequestId 重放返回原 taskId（replayed=true），不创建第二个任务
// - mock 生图成功后 generations 行写入 asset_id，user_assets 出现 source='generated' 记录
// - 任务轮询响应的结果图带 assetId 与 15 分钟短时同源 accessUrl，且签名内容可读
// - 结算后 billingStatus=settled，预占按成功张数结算
// 不得在断言失败信息中打印图片内容、Base64 或密钥。

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');

const repoRoot = path.resolve(__dirname, '..');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function api(baseUrl, method, apiPath, { token, jsonBody } = {}) {
  return new Promise((resolve, reject) => {
    const headers = {};
    let payload = null;
    if (jsonBody !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = Buffer.from(JSON.stringify(jsonBody));
    }
    if (token) headers.Authorization = `Bearer ${token}`;
    const request = http.request(`${baseUrl}${apiPath}`, { method, headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({ status: response.statusCode, headers: response.headers, json, text });
      });
    });
    request.once('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function waitForHealth(baseUrl, processState) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processState.exited) throw new Error(`生图任务测试服务提前退出：${processState.logs()}`);
    try {
      const response = await api(baseUrl, 'GET', '/api/health');
      if (response.status === 200 && response.json && response.json.success && response.json.database === 'ok') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`生图任务测试服务启动超时：${processState.logs()}`);
}

async function main() {
  const port = await availablePort();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-gen-task-assets-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      DATA_DIR: path.join(tempRoot, 'data'),
      DB_PATH: path.join(tempRoot, 'data', 'data.db'),
      UPLOAD_DIR: path.join(tempRoot, 'uploads'),
      LOG_DIR: path.join(tempRoot, 'logs'),
      JWT_SECRET: 'vK2q8mL5wR7pN4cX9bT6yH3sD1fG0jQ8uZ5eA2nM7rP4xC9k',
      ASSET_URL_SIGNING_SECRET: 'generation-task-asset-test-secret-2026-07-28',
      ADMIN_BOOTSTRAP_USERNAME: 'gen-task-admin',
      ADMIN_BOOTSTRAP_PASSWORD: 'GenTaskAdmin!2026',
      CORS_ORIGINS: `http://127.0.0.1:${port}`,
      CANVAS_RUNTIME: 'legacy',
      ENABLE_REAL_AI: 'false',
      ENABLE_REAL_EMAIL: 'false',
      ENABLE_REAL_PAYMENT: 'false',
      ENABLE_REAL_STORAGE: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  const processState = { exited: false, logs: () => `${stdout}\n${stderr}`.trim() };
  child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
  child.once('exit', () => { processState.exited = true; });
  const baseUrl = `http://127.0.0.1:${port}`;
  const dbPath = path.join(tempRoot, 'data', 'data.db');
  let db = null;

  const stop = async () => {
    if (db) {
      try { db.close(); } catch {}
      db = null;
    }
    if (!processState.exited) {
      child.kill();
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 3000))]);
      if (!processState.exited) child.kill('SIGKILL');
    }
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  };

  try {
    await waitForHealth(baseUrl, processState);

    const suffix = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
    const register = await api(baseUrl, 'POST', '/api/auth/register', {
      jsonBody: { username: `gen-task-${suffix}`, email: `gen-task-${suffix}@test.internal`, password: `GenTask!${suffix}` }
    });
    assert(register.status === 200 && register.json && register.json.token, `注册失败：HTTP ${register.status}`);
    const token = register.json.token;
    const userId = register.json.user.id;

    // disposable 测试账号无初始余额：直接写库充值（不经过支付/兑换码路径）。
    db = new Database(dbPath);
    db.pragma('busy_timeout = 5000');
    db.prepare('UPDATE users SET balance=? WHERE id=?').run(100, userId);

    // 创建任务（imageCount=2，两张都成功 → 全额结算）
    const clientRequestId = `cr_test_${suffix}`;
    const submit = await api(baseUrl, 'POST', '/api/generate/tasks', {
      token,
      jsonBody: { prompt: '电商主图测试', modelKey: 'gpt-image-2', imageCount: 2, ratio: '1:1', clientRequestId }
    });
    assert(submit.status === 202, `创建任务应返回 202，实际 ${submit.status}：${JSON.stringify(submit.json)}`);
    assert(submit.json.taskId, '创建响应缺少 taskId');
    assert(submit.json.replayed === false, '首次创建 replayed 应为 false');
    const taskId = submit.json.taskId;

    // 幂等重放：同一 clientRequestId + 同一请求 → 原任务
    const replay = await api(baseUrl, 'POST', '/api/generate/tasks', {
      token,
      jsonBody: { prompt: '电商主图测试', modelKey: 'gpt-image-2', imageCount: 2, ratio: '1:1', clientRequestId }
    });
    assert(replay.status === 202 && replay.json.taskId === taskId && replay.json.replayed === true,
      `幂等重放应返回原任务且 replayed=true，实际 ${replay.status} taskId=${replay.json && replay.json.taskId}`);

    // 轮询到终态
    let task = null;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const poll = await api(baseUrl, 'GET', `/api/generate/tasks/${taskId}`, { token });
      assert(poll.status === 200, `轮询应返回 200，实际 ${poll.status}`);
      task = poll.json;
      if (['success', 'failed', 'cancelled'].includes(task.status)) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert(task && task.status === 'success', `任务应成功，实际 ${task && task.status}（${task && task.errorCode} ${task && task.errorMessage}）`);
    assert(task.billingStatus === 'settled', `两张全部成功应全额结算，实际 billingStatus=${task.billingStatus}`);
    assert(Array.isArray(task.images) && task.images.length === 2, `应返回 2 张结果图，实际 ${task.images && task.images.length}`);
    const assetIds = task.images.map(image => image.assetId);
    assert(assetIds.every(id => typeof id === 'string' && id.startsWith('asset_')), `每张结果图必须带 assetId，实际 ${JSON.stringify(assetIds)}`);
    assert(task.images.every(image => typeof image.accessUrl === 'string' && image.accessUrl.startsWith('/api/asset-content/')),
      '每张结果图必须带同源 /api/asset-content/ 短时 accessUrl');
    assert(typeof task.assetId === 'string' && task.assetId.startsWith('asset_'), '任务响应顶层应返回首张结果的 assetId');
    assert(typeof task.accessUrl === 'string' && task.accessUrl.startsWith('/api/asset-content/'), '任务响应顶层应返回首张结果的 accessUrl');

    // generations.asset_id 回写 + user_assets(source='generated')
    const generationRows = db.prepare('SELECT id,asset_id FROM generations WHERE task_id=? AND user_id=?').all(taskId, userId);
    assert(generationRows.length === 2, `generations 应有 2 条任务记录，实际 ${generationRows.length}`);
    assert(generationRows.every(row => row.asset_id && assetIds.includes(row.asset_id)), 'generations.asset_id 必须回写并与任务响应一致');
    const assetRows = db.prepare("SELECT id,source,kind,mime_type FROM user_assets WHERE user_id=? AND source='generated'").all(userId);
    assert(assetRows.length === 2, `user_assets 应有 2 条 source='generated' 记录，实际 ${assetRows.length}`);
    assert(assetRows.every(row => assetIds.includes(row.id) && row.kind === 'image' && row.mime_type === 'image/png'),
      `资产记录必须为 image/png，实际 ${JSON.stringify(assetRows.map(row => row.mime_type))}`);

    // 短时 accessUrl 内容可读且为 PNG
    const content = await api(baseUrl, 'GET', task.images[0].accessUrl);
    assert(content.status === 200, `签名内容 URL 应返回 200，实际 ${content.status}`);
    assert(String(content.headers['content-type'] || '').includes('image/png'), `资产内容应为 image/png，实际 ${content.headers['content-type']}`);

    // 任务历史幂等：重放不产生额外 generations / user_assets
    const generationCount = db.prepare('SELECT COUNT(*) AS count FROM generations WHERE user_id=?').get(userId).count;
    const assetCount = db.prepare("SELECT COUNT(*) AS count FROM user_assets WHERE user_id=? AND source='generated'").get(userId).count;
    assert(generationCount === 2 && assetCount === 2, `幂等重放不得产生额外记录，generations=${generationCount} assets=${assetCount}`);

    console.log(JSON.stringify({ total: 1, failed: 0, taskId, assetIds, billingStatus: task.billingStatus }, null, 2));
  } finally {
    await stop();
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
