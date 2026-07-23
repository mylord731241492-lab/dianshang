const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');

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
    if (processState.exited) throw new Error(`安全测试服务提前退出：${processState.logs()}`);
    try {
      const response = await requestJson(`${baseUrl}/api/health`);
      if (response.status === 200 && response.body.success && response.body.database === 'ok') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`安全测试服务启动超时：${processState.logs()}`);
}

async function main() {
  const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  const authBridgeSource = fs.readFileSync(path.join(repoRoot, 'assets', 'auth-direct-register-bridge.js'), 'utf8');
  assert(indexHtml.includes('/assets/auth-direct-register-bridge.js?v=20260715directreset1'), '首页必须命中新版账号直重置桥接资源');
  assert(authBridgeSource.includes("fetch('/api/auth/reset-password'"), '账号直重置桥接必须调用重置接口');
  assert(authBridgeSource.includes('JSON.stringify({ username: account, newPassword: newPassword })'), '账号直重置桥接只能提交用户名和新密码');
  assert(authBridgeSource.includes("hideDirectResetField(email)"), '账号直重置界面必须隐藏邮箱字段');
  assert(authBridgeSource.includes("hideDirectResetField(code)"), '账号直重置界面必须隐藏验证码字段');
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-launch-security-'));
  const jwtSecret = 'vK2q8mL5wR7pN4cX9bT6yH3sD1fG0jQ8uZ5eA2nM7rP4xC9k';
  const resetEmail = 'security-reset@example.invalid';
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
      JWT_SECRET: jwtSecret,
      ADMIN_BOOTSTRAP_PASSWORD: 'LaunchSecurityAdmin!2026',
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

    const resetResponse = await requestJson(`${baseUrl}/api/auth/send-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmail })
    });
    assert(resetResponse.status === 410, `旧重置验证码流程应返回 410，实际 ${resetResponse.status}`);
    assert(resetResponse.body.code === 'RESET_CODE_FLOW_DISABLED', '旧重置验证码流程应返回 RESET_CODE_FLOW_DISABLED');
    assert(!Object.prototype.hasOwnProperty.call(resetResponse.body, 'codeValue'), '响应不应包含验证码值');
    assert(!/\b\d{6}\b/.test(JSON.stringify(resetResponse.body)), '生产重置响应不应包含六位验证码');

    const privateUrl = 'http://127.0.0.1/api/mock-image/security.svg';
    const unsignedResponse = await requestJson(`${baseUrl}/api/proxy-image?url=${encodeURIComponent(privateUrl)}`);
    assert(unsignedResponse.status === 403, `未签名图片代理应返回 403，实际 ${unsignedResponse.status}`);
    assert(unsignedResponse.body.code === 'IMAGE_PROXY_FORBIDDEN', '未签名图片代理应返回 IMAGE_PROXY_FORBIDDEN');

    const privateSignature = crypto.createHmac('sha256', jwtSecret).update(privateUrl, 'utf8').digest('hex');
    const privateResponse = await requestJson(`${baseUrl}/api/proxy-image?url=${encodeURIComponent(privateUrl)}&sig=${privateSignature}`);
    assert(privateResponse.status === 403, `已签名内网图片地址应返回 403，实际 ${privateResponse.status}`);
    assert(privateResponse.body.code === 'IMAGE_PROXY_PRIVATE_ADDRESS', `内网图片地址应返回 IMAGE_PROXY_PRIVATE_ADDRESS，实际 ${JSON.stringify(privateResponse.body)}`);

    const localhostUrl = 'http://localhost/image.png';
    const localhostSignature = crypto.createHmac('sha256', jwtSecret).update(localhostUrl, 'utf8').digest('hex');
    const localhostResponse = await requestJson(`${baseUrl}/api/proxy-image?url=${encodeURIComponent(localhostUrl)}&sig=${localhostSignature}`);
    assert(localhostResponse.status === 403, `localhost 图片地址应返回 403，实际 ${localhostResponse.status}`);
    assert(localhostResponse.body.code === 'IMAGE_PROXY_PRIVATE_ADDRESS', 'localhost 应被内网地址门禁拦截');

    const projectTarget = 'https://project-controlled.example/image.png';
    const projectLegacyUrl = `/api/proxy-image?url=${encodeURIComponent(projectTarget)}`;
    const legacyTarget = 'http://127.0.0.1/legacy-image.png';
    const legacyUrl = `/api/proxy-image?url=${encodeURIComponent(legacyTarget)}`;
    const expectedLegacyUrl = `${legacyUrl}&sig=${crypto.createHmac('sha256', jwtSecret).update(legacyTarget, 'utf8').digest('hex')}`;
    const userId = 'security_user';
    const projectId = 'security_project';
    const generationId = 'security_generation';
    const database = new Database(path.join(tempRoot, 'data', 'data.db'));
    try {
      database.prepare('INSERT INTO users (id,username,email,password_hash,role,balance) VALUES (?,?,?,?,?,?)')
        .run(userId, 'security-user', 'security-user@example.invalid', 'unused', 'user', 0);
      database.prepare('INSERT INTO projects (id,user_id,name,data) VALUES (?,?,?,?)')
        .run(projectId, userId, 'security-project', JSON.stringify({ node: { image: projectLegacyUrl } }));
      database.prepare('INSERT INTO generations (id,user_id,model_key,prompt,result_url,cost,status) VALUES (?,?,?,?,?,?,?)')
        .run(generationId, userId, 'mock-model', 'security prompt', legacyUrl, 0, 'completed');
    } finally {
      database.close();
    }
    const directResetResponse = await requestJson(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'security-user', newPassword: 'security-reset-2026' })
    });
    assert(directResetResponse.status === 200 && directResetResponse.body.success, `普通用户账号直重置应成功，实际 ${JSON.stringify(directResetResponse)}`);
    const loginAfterResetResponse = await requestJson(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'security-user', password: 'security-reset-2026' })
    });
    assert(loginAfterResetResponse.status === 200 && loginAfterResetResponse.body.token, '普通用户应能使用重置后的密码登录');
    const shortPasswordResponse = await requestJson(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'security-user', newPassword: '12345' })
    });
    assert(shortPasswordResponse.status === 400 && shortPasswordResponse.body.code === 'PASSWORD_TOO_SHORT', '少于 6 位的新密码应被拒绝');
    const adminResetResponse = await requestJson(`${baseUrl}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', newPassword: 'should-not-change' })
    });
    assert(adminResetResponse.status === 403 && adminResetResponse.body.code === 'ADMIN_SELF_RESET_FORBIDDEN', '公开找回密码入口应拒绝管理员账号');
    const userToken = jwt.sign({ userId, role: 'user' }, jwtSecret, { expiresIn: '5m' });
    const authHeaders = { Authorization: `Bearer ${userToken}` };
    const projectResponse = await requestJson(`${baseUrl}/api/user/projects/${projectId}`, { headers: authHeaders });
    assert(projectResponse.status === 200, `历史项目读取应返回 200，实际 ${projectResponse.status}`);
    assert(projectResponse.body.data?.node?.image === projectLegacyUrl, '项目数据不应成为任意代理 URL 的签名入口');
    const projectProxyResponse = await requestJson(`${baseUrl}/api/proxy-image?url=${encodeURIComponent(projectTarget)}`);
    assert(projectProxyResponse.status === 403 && projectProxyResponse.body.code === 'IMAGE_PROXY_FORBIDDEN', '项目写入的任意代理 URL 不应获得未签名访问权限');
    const knownLegacyResponse = await requestJson(`${baseUrl}/api/proxy-image?url=${encodeURIComponent(legacyTarget)}`);
    assert(knownLegacyResponse.status === 403 && knownLegacyResponse.body.code === 'IMAGE_PROXY_PRIVATE_ADDRESS', '数据库中已有的旧代理目标应通过兼容门禁后继续接受地址安全检查');
    const generationsResponse = await requestJson(`${baseUrl}/api/user/generations`, { headers: authHeaders });
    assert(generationsResponse.status === 200, `生成历史读取应返回 200，实际 ${generationsResponse.status}`);
    assert(generationsResponse.body.items?.[0]?.url === expectedLegacyUrl, '生成历史中的未签名代理 URL 应在响应时升级为签名 URL');
    const deleteResponse = await requestJson(`${baseUrl}/api/user/generations?resultUrl=${encodeURIComponent(expectedLegacyUrl)}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(deleteResponse.status === 200 && deleteResponse.body.deleted, `签名 URL 应能删除旧版未签名生成记录，实际 ${JSON.stringify(deleteResponse)}`);

    await new Promise(resolve => setTimeout(resolve, 100));
    const logs = processState.logs();
    assert(!logs.includes(resetEmail), '生产日志不应记录密码重置邮箱和验证码');
    assert(!logs.includes('[RESET]') && !logs.includes('[RESET_DEV_CODE]'), '生产日志不应记录密码重置验证码');

    console.log(JSON.stringify({
      resetCodeFlow: 'disabled',
      directPasswordReset: 'user-only',
      directResetFrontend: 'username-and-password-only',
      unsignedProxy: unsignedResponse.body.code,
      privateProxy: privateResponse.body.code,
      localhostProxy: localhostResponse.body.code,
      projectSigningOracle: 'blocked',
      legacyProxyAllowlist: 'validated',
      legacyGenerationUrl: 'upgraded-and-deletable'
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
