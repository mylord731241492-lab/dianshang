const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
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

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, options, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let body = {};
        try {
          body = text ? JSON.parse(text) : {};
        } catch {
          body = { text };
        }
        resolve({ status: response.statusCode, body });
      });
    });
    request.once('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

async function waitForHealth(baseUrl, processState) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processState.exited) throw new Error(`上线门禁测试服务提前退出：${processState.logs()}`);
    try {
      const response = await requestJson(`${baseUrl}/api/health`);
      if (response.status === 200 && response.body.success && response.body.database === 'ok') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`上线门禁测试服务启动超时：${processState.logs()}`);
}

function jsonRequest(method, token, body) {
  return {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  };
}

function assertDockerBuildContract() {
  const dockerfile = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
  const dockerignore = fs.readFileSync(path.join(repoRoot, '.dockerignore'), 'utf8');
  assert(/FROM\s+\$\{NODE_IMAGE\}\s+AS\s+frontend-build/i.test(dockerfile), 'Dockerfile 必须包含 frontend-build 阶段');
  assert(/COPY\s+frontend\/package\*\.json/.test(dockerfile), 'Dockerfile 必须先复制 frontend package lock');
  assert(/RUN\s+npm\s+ci\b/.test(dockerfile), 'Dockerfile 前端阶段必须执行 npm ci');
  assert(/RUN\s+npm\s+run\s+build\b/.test(dockerfile), 'Dockerfile 前端阶段必须执行 npm run build');
  assert(/COPY\s+--from=frontend-build\s+\/build\/frontend\/dist\s+\/app\/frontend\/dist/.test(dockerfile), '运行镜像必须复制前端构建产物');
  assert(/^\*\*\/node_modules\/?$/m.test(dockerignore), '.dockerignore 必须排除任意层级 node_modules');
  assert(/^frontend\/dist\/?$/m.test(dockerignore), '.dockerignore 必须排除宿主机 frontend/dist');
  assert(/^docker\/\.env$/m.test(dockerignore), '.dockerignore 必须排除 docker/.env');
  assert(/^docker\/backup\/?$/m.test(dockerignore), '.dockerignore 必须排除生产备份');
}

function assertChatEntryContract() {
  const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  const source = fs.readFileSync(path.join(repoRoot, 'assets', 'chat-entry-link.js'), 'utf8');
  assert(indexHtml.includes('/assets/chat-entry-link.js?v=20260715availability1'), '首页必须命中新版 Chat 可用性门禁资源');
  assert(source.includes("fetch('/api/chat/status'"), 'Chat 入口必须先查询公开部署状态');
  assert(source.includes('if (!availability.accessReady)'), 'Chat 不可用时必须拒绝插入入口');
}

async function main() {
  assertDockerBuildContract();
  assertChatEntryContract();

  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-launch-gates-'));
  const adminUsername = 'launch-admin';
  const adminPassword = 'LaunchGateAdmin!2026';
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
      ADMIN_BOOTSTRAP_USERNAME: adminUsername,
      ADMIN_BOOTSTRAP_PASSWORD: adminPassword,
      CORS_ORIGINS: baseUrl,
      ENABLE_REAL_AI: 'false',
      ENABLE_REAL_EMAIL: 'false',
      ENABLE_REAL_PAYMENT: 'false',
      ENABLE_REAL_STORAGE: 'false',
      ENABLE_LIBRECHAT: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  const processState = {
    exited: false,
    logs: () => `${stdout}\n${stderr}`.trim()
  };
  child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
  child.once('exit', () => { processState.exited = true; });

  try {
    await waitForHealth(baseUrl, processState);

    const databasePath = path.join(tempRoot, 'data', 'data.db');
    const database = new Database(databasePath);
    try {
      database.prepare('INSERT INTO users (id,username,email,password_hash,role,balance,status,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run('launch-user', 'launch-user', 'launch-user@example.invalid', 'unused', 'user', 50, 'active', new Date().toISOString());
      database.prepare('INSERT INTO users (id,username,email,password_hash,role,balance,status,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run('old-user', 'old-user', 'old-user@example.invalid', 'unused', 'user', 10, 'active', '2020-01-02T03:04:05.000Z');
      database.prepare('INSERT INTO generations (id,user_id,model_key,prompt,result_url,cost,status,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run('generation-today', 'launch-user', 'real-model', 'today prompt', '/uploads/generated/today.png', 5, 'completed', new Date().toISOString());
      database.prepare('INSERT INTO generations (id,user_id,model_key,prompt,result_url,cost,status,created_at) VALUES (?,?,?,?,?,?,?,?)')
        .run('generation-old', 'old-user', 'old-model', 'old prompt', '/uploads/generated/old.png', 3, 'completed', '2020-01-02T03:04:05.000Z');
    } finally {
      database.close();
    }

    const login = await requestJson(`${baseUrl}/api/admin/login`, jsonRequest('POST', '', {
      username: adminUsername,
      password: adminPassword
    }));
    assert(login.status === 200 && login.body.token, `管理员登录失败：${JSON.stringify(login)}`);
    const token = login.body.token;

    const chatStatus = await requestJson(`${baseUrl}/api/chat/status`);
    assert(chatStatus.status === 200, `Chat 状态接口应返回 200，实际 ${chatStatus.status}`);
    assert(chatStatus.body.enabled === false && chatStatus.body.accessReady === false, 'Chat 未部署时必须明确不可用');
    assert(!JSON.stringify(chatStatus.body).match(/secret|key|mongo|internalUrl/i), 'Chat 公开状态不得泄露内部配置字段');

    const orders = await requestJson(`${baseUrl}/api/admin/orders`, jsonRequest('GET', token));
    assert(orders.status === 200, `订单接口应返回 200，实际 ${orders.status}`);
    assert(orders.body.available === false, '支付关闭时订单接口必须标记 available=false');
    assert(Array.isArray(orders.body.orders) && orders.body.orders.length === 0, '支付关闭时不得从用户伪造订单');
    const orderUpdate = await requestJson(`${baseUrl}/api/admin/orders/fake-order/status`, jsonRequest('PATCH', token, { status: 'paid' }));
    assert(orderUpdate.status === 409 && orderUpdate.body.code === 'PAYMENT_DISABLED', '订单写接口不得假装更新成功');

    const dashboard = await requestJson(`${baseUrl}/api/admin/dashboard`, jsonRequest('GET', token));
    assert(dashboard.status === 200, `Dashboard 应返回 200，实际 ${dashboard.status}`);
    assert(dashboard.body.summary.todayNewUsers < dashboard.body.summary.totalUsers, '今日新增用户不能等于历史用户总数');
    assert(dashboard.body.summary.todayGenerations < dashboard.body.summary.totalGenerations, '今日生成不能等于历史生成总数');
    assert(dashboard.body.dataQuality?.ordersAvailable === false, 'Dashboard 必须标记支付统计不可用');
    assert(dashboard.body.routeUsage?.available === false, '缺少线路历史字段时必须标记线路统计不可用');
    assert(Array.isArray(dashboard.body.routeUsage?.list) && dashboard.body.routeUsage.list.length === 0, '不得平均伪造线路用量');

    const tasks = await requestJson(`${baseUrl}/api/admin/generate-tasks`, jsonRequest('GET', token));
    assert(tasks.status === 200, `任务接口应返回 200，实际 ${tasks.status}`);
    const historicalTask = tasks.body.tasks.find(item => item.id === 'generation-old');
    assert(historicalTask, '任务历史应包含真实 generation 记录');
    assert(!historicalTask.routeDisplayName && !historicalTask.lineKey, '历史任务不得伪造默认线路');
    assert(!historicalTask.resolvedSize && !historicalTask.size, '历史任务不得伪造固定尺寸');
    assert(!Object.prototype.hasOwnProperty.call(historicalTask, 'referenceImageCount'), '历史任务不得伪造参考图数量');
    assert(tasks.body.summary.queueMode === 'runtime-memory+history', '任务汇总必须准确描述数据来源');

    const reset = await requestJson(`${baseUrl}/api/admin/users/launch-user/reset-password`, jsonRequest('POST', token, {
      newPassword: 'LaunchUserReset!2026'
    }));
    assert(reset.status === 200 && reset.body.success, `管理员重置密码失败：${JSON.stringify(reset)}`);
    assert(!Object.prototype.hasOwnProperty.call(reset.body, 'password'), '管理员重置密码响应不得包含明文密码');
    const loginAfterReset = await requestJson(`${baseUrl}/api/auth/login`, jsonRequest('POST', '', {
      username: 'launch-user',
      password: 'LaunchUserReset!2026'
    }));
    assert(loginAfterReset.status === 200 && loginAfterReset.body.token, '用户应能使用管理员设置的新密码登录');

    console.log(JSON.stringify({
      dockerFrontendBuild: 'source-only',
      chatEntry: 'hidden-when-unavailable',
      dashboard: 'traceable-data-only',
      orders: 'disabled-no-fake-data',
      generationTasks: 'unknown-fields-not-fabricated',
      adminPasswordReset: 'response-redacted'
    }, null, 2));
  } finally {
    if (!processState.exited) {
      child.kill();
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      if (!processState.exited) child.kill('SIGKILL');
    }
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
