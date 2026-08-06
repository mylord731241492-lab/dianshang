const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const legacyIndexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const candidateIndexPath = path.join(repoRoot, 'integrations', 'infinite-canvas', 'web', 'dist', 'index.html');
const candidateIndexHtml = fs.readFileSync(candidateIndexPath, 'utf8');

// /login 属于源码前端路由白名单，应返回 frontend/dist/index.html。
// 工作树通常不含 frontend/dist 构建产物，测试写入临时 marker 文件以便区分两个 index.html，结束后清理。
const sourceFrontendDistDir = path.join(repoRoot, 'frontend', 'dist');
const sourceFrontendIndexPath = path.join(sourceFrontendDistDir, 'index.html');
const sourceFrontendIndexExisted = fs.existsSync(sourceFrontendIndexPath);
const sourceFrontendMarkerHtml = '<!doctype html><html><head><meta charset="utf-8"><title>source-frontend-marker</title></head><body>source frontend marker</body></html>';

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

function requestText(url) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method: 'GET' }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let body = null;
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = null;
        }
        resolve({ status: response.statusCode, headers: response.headers, text, body });
      });
    });
    request.once('error', reject);
    request.end();
  });
}

async function waitForHealth(baseUrl, processState) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processState.exited) throw new Error(`画布运行时测试服务提前退出：${processState.logs()}`);
    try {
      const response = await requestText(`${baseUrl}/api/health`);
      if (response.status === 200 && response.body && response.body.success && response.body.database === 'ok') {
        return response.body;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`画布运行时测试服务启动超时：${processState.logs()}`);
}

async function startServer(extraEnv) {
  const port = await availablePort();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-canvas-runtime-'));
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
      ADMIN_BOOTSTRAP_USERNAME: 'canvas-runtime-admin',
      ADMIN_BOOTSTRAP_PASSWORD: 'CanvasRuntimeAdmin!2026',
      CORS_ORIGINS: `http://127.0.0.1:${port}`,
      ENABLE_REAL_AI: 'false',
      ENABLE_REAL_EMAIL: 'false',
      ENABLE_REAL_PAYMENT: 'false',
      ENABLE_REAL_STORAGE: 'false',
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  const processState = {
    exited: false,
    exitCode: null,
    logs: () => `${stdout}\n${stderr}`.trim()
  };
  child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
  child.once('exit', code => {
    processState.exited = true;
    processState.exitCode = code;
  });
  return {
    child,
    processState,
    tempRoot,
    baseUrl: `http://127.0.0.1:${port}`
  };
}

async function stopServer(instance) {
  if (!instance.processState.exited) {
    instance.child.kill();
    await Promise.race([
      new Promise(resolve => instance.child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
    if (!instance.processState.exited) instance.child.kill('SIGKILL');
  }
  fs.rmSync(instance.tempRoot, { recursive: true, force: true });
}

async function main() {
  if (!sourceFrontendIndexExisted) {
    fs.mkdirSync(sourceFrontendDistDir, { recursive: true });
    fs.writeFileSync(sourceFrontendIndexPath, sourceFrontendMarkerHtml);
  }
  const sourceFrontendIndexHtml = fs.readFileSync(sourceFrontendIndexPath, 'utf8');
  try {
  const assetMatch = candidateIndexHtml.match(/\/canvas-app\/assets\/[^"'\s]+\.js/);
  assert(assetMatch, '候选 index.html 必须引用 /canvas-app/assets/ 下的入口脚本（需以 VITE_BASE=/canvas-app/ 构建）');
  const candidateAssetPath = assetMatch[0];

  // legacy：/canvas 保持当前旧入口，候选路由完全不注册
  const legacy = await startServer({ CANVAS_RUNTIME: 'legacy' });
  try {
    const health = await waitForHealth(legacy.baseUrl, legacy.processState);
    assert(health.canvasRuntime === 'legacy', `legacy 模式 /api/health 必须报告 canvasRuntime=legacy，实际 ${JSON.stringify(health.canvasRuntime)}`);

    const canvasPage = await requestText(`${legacy.baseUrl}/canvas`);
    assert(canvasPage.status === 200, `legacy 模式 /canvas 应返回 200，实际 ${canvasPage.status}`);
    assert(canvasPage.text === legacyIndexHtml, 'legacy 模式 /canvas 必须返回当前旧入口 index.html');
    assert(canvasPage.text !== candidateIndexHtml, 'legacy 模式 /canvas 不得返回候选画布 index.html');

    const candidateAsset = await requestText(`${legacy.baseUrl}${candidateAssetPath}`);
    assert(candidateAsset.text !== fs.readFileSync(path.join(repoRoot, 'integrations', 'infinite-canvas', 'web', 'dist', candidateAssetPath.replace('/canvas-app/', '')), 'utf8'),
      'legacy 模式不得注册 /canvas-app/* 静态资源路由');
  } finally {
    await stopServer(legacy);
  }

  // infinite：/canvas 与 /canvas/:projectId 指向候选画布，静态资源经 /canvas-app/*
  const infinite = await startServer({ CANVAS_RUNTIME: 'infinite' });
  try {
    const health = await waitForHealth(infinite.baseUrl, infinite.processState);
    assert(health.canvasRuntime === 'infinite', `infinite 模式 /api/health 必须报告 canvasRuntime=infinite，实际 ${JSON.stringify(health.canvasRuntime)}`);

    const canvasPage = await requestText(`${infinite.baseUrl}/canvas`);
    assert(canvasPage.status === 200, `infinite 模式 /canvas 应返回 200，实际 ${canvasPage.status}`);
    assert(canvasPage.text === candidateIndexHtml, 'infinite 模式 /canvas 必须返回候选画布 index.html');

    const canvasProjectPage = await requestText(`${infinite.baseUrl}/canvas/proj_test`);
    assert(canvasProjectPage.status === 200, `infinite 模式 /canvas/proj_test 应返回 200，实际 ${canvasProjectPage.status}`);
    assert(canvasProjectPage.text === candidateIndexHtml, 'infinite 模式 /canvas/proj_test 必须返回候选画布 index.html');

    const candidateAsset = await requestText(`${infinite.baseUrl}${candidateAssetPath}`);
    assert(candidateAsset.status === 200, `infinite 模式候选静态资源 ${candidateAssetPath} 应返回 200，实际 ${candidateAsset.status}`);

    const loginPage = await requestText(`${infinite.baseUrl}/login`);
    assert(loginPage.status === 200, `infinite 模式 /login 应返回 200，实际 ${loginPage.status}`);
    assert(loginPage.text === sourceFrontendIndexHtml, 'infinite 模式 /login 必须返回源码前端 frontend/dist/index.html');
    assert(loginPage.text !== legacyIndexHtml, 'infinite 模式 /login 不得落入旧 SPA 根 index.html');
    assert(loginPage.text !== candidateIndexHtml, 'infinite 模式 /login 不得返回候选画布 index.html');

    const loginSlashPage = await requestText(`${infinite.baseUrl}/login/`);
    assert(loginSlashPage.status === 200, `infinite 模式 /login/ 应返回 200，实际 ${loginSlashPage.status}`);
    assert(loginSlashPage.text === sourceFrontendIndexHtml, 'infinite 模式 /login/ 必须返回源码前端 frontend/dist/index.html');

    const unknownApi = await requestText(`${infinite.baseUrl}/api/definitely-not-exists`);
    assert(unknownApi.status === 404, `未知 /api/* 应返回 404，实际 ${unknownApi.status}`);
    assert(unknownApi.body && unknownApi.body.success === false, '未知 /api/* 必须返回 API 404 JSON，不得落入候选 HTML');
    assert(!unknownApi.text.startsWith('<!'), '未知 /api/* 响应不得是候选 HTML');
  } finally {
    await stopServer(infinite);
  }

  // 未知值：启动必须明确失败，不静默猜测
  const bogus = await startServer({ CANVAS_RUNTIME: 'bogus' });
  try {
    await new Promise(resolve => bogus.child.once('exit', resolve));
    assert(bogus.processState.exitCode !== 0, `CANVAS_RUNTIME=bogus 时进程必须非 0 退出，实际 ${bogus.processState.exitCode}`);
    assert(/CANVAS_RUNTIME/.test(bogus.processState.logs()), 'CANVAS_RUNTIME=bogus 时启动失败日志必须点名 CANVAS_RUNTIME');
  } finally {
    await stopServer(bogus);
  }

  console.log(JSON.stringify({
    legacyCanvas: 'root-index.html',
    infiniteCanvas: 'candidate-index.html',
    infiniteProjectRoute: 'candidate-index.html',
    infiniteLoginRoute: 'source-frontend-index.html',
    candidateAssets: candidateAssetPath,
    unknownApi: '404-json',
    invalidRuntime: 'startup-blocked'
  }, null, 2));
  } finally {
    if (!sourceFrontendIndexExisted) {
      fs.rmSync(sourceFrontendIndexPath, { force: true });
      try { fs.rmdirSync(sourceFrontendDistDir); } catch {}
    }
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
