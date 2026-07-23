const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');

const repoRoot = path.resolve(__dirname, '..');
const generatedPngBase64 =
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
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForHealth(baseUrl, child, stderr) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Disposable app exited early (${child.exitCode}): ${stderr.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const data = await response.json();
      if (response.ok && data.success && data.database === 'ok') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Disposable app did not become healthy: ${stderr.join('')}`);
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${response.url}: ${response.status} ${text}`);
  }
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-image-multi-submit-'));
  const dataDir = path.join(tempRoot, 'data');
  const uploadDir = path.join(tempRoot, 'uploads');
  const logDir = path.join(tempRoot, 'logs');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  let providerCalls = 0;
  const fakeProvider = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      if (req.method !== 'POST' || !['/v1/images/generations', '/v1/images/edits'].includes(req.url)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: `Unexpected request: ${req.method} ${req.url}` } }));
        return;
      }
      providerCalls += 1;
      const bodyText = Buffer.concat(chunks).toString('utf8');
      if (bodyText.includes('[SKIPPED-200]')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ skipped_mainline: true }));
        return;
      }
      if (bodyText.includes('[EMPTY-200]')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ revised_prompt: 'no image returned' }], usage: { total_tokens: 1 } }));
        return;
      }
      if (bodyText.includes('[FAIL-524]')) {
        res.writeHead(524, {
          'Content-Type': 'application/json',
          'CF-Ray': 'fake-524-ray-SIN',
          'X-Request-Id': 'fake-provider-request-524'
        });
        res.end(JSON.stringify({ error: { message: 'upstream origin timeout' } }));
        return;
      }
      setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ b64_json: generatedPngBase64 }] }));
      }, 750);
    });
  });

  const providerPort = await listen(fakeProvider);
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const stderr = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(appPort),
      DATA_DIR: dataDir,
      DB_PATH: path.join(dataDir, 'data.db'),
      UPLOAD_DIR: uploadDir,
      LOG_DIR: logDir,
      ENABLE_REAL_AI: 'true',
      ENABLE_REAL_EMAIL: 'false',
      ENABLE_REAL_PAYMENT: 'false',
      ENABLE_REAL_STORAGE: 'false',
      AI_PROVIDER_GATEWAY: 'legacy',
      AI_API_BASE: `http://127.0.0.1:${providerPort}/v1`,
      AI_IMAGE_KEY: 'sk-fake-image-multi-submit',
      AI_TEXT_KEY: 'sk-fake-text-multi-submit',
      IMAGE_PROVIDER_REQUEST_DELAY_MS: '0',
      GENERATION_DOMAIN_START_INTERVAL_MS: '0',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  child.stderr.on('data', chunk => stderr.push(chunk.toString('utf8')));

  let db;
  try {
    await waitForHealth(baseUrl, child, stderr);
    db = new Database(path.join(dataDir, 'data.db'));
    const initialUser = db.prepare("SELECT id,balance FROM users WHERE username='admin'").get();
    assert(initialUser, 'Disposable admin user was not created');

    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const login = await readJson(loginResponse);
    assert.equal(loginResponse.status, 200, `Disposable admin login failed: ${JSON.stringify(login)}`);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.token}` };

    const routeResponse = await fetch(`${baseUrl}/api/admin/api-providers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        routeKey: 'multi-submit-lingsuan',
        displayName: 'Multi Submit Lingsuan',
        category: 'image',
        apiFormat: 'lingsuan-images',
        baseUrl: `http://127.0.0.1:${providerPort}/v1`,
        defaultImageModel: 'gpt-image-2',
      }),
    });
    const route = await readJson(routeResponse);
    assert.equal(routeResponse.status, 200, `Disposable image route creation failed: ${JSON.stringify(route)}`);
    const routeId = route.item?.id || route.id;
    assert(routeId, 'Disposable image route did not return an id');
    const faultRouteResponse = await fetch(`${baseUrl}/api/admin/api-providers`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        routeKey: 'multi-submit-fault-domain',
        displayName: 'Multi Submit Fault Domain',
        category: 'image',
        apiFormat: 'new-api',
        baseUrl: `http://127.0.0.1:${providerPort}/v1`,
        defaultImageModel: 'gpt-image-2',
      }),
    });
    const faultRoute = await readJson(faultRouteResponse);
    assert.equal(faultRouteResponse.status, 200, `Disposable fault route creation failed: ${JSON.stringify(faultRoute)}`);
    const faultRouteId = faultRoute.item?.id || faultRoute.id;
    assert(faultRouteId, 'Disposable fault route did not return an id');

    const preferenceResponse = await fetch(`${baseUrl}/api/user/preferences/api-route`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ routeId }),
    });
    assert.equal(preferenceResponse.status, 200, `Disposable route selection failed: ${await preferenceResponse.text()}`);

    const payload = {
      prompt: '[MULTI-SUBMIT-SLOW] generate one clean ecommerce image',
      modelKey: 'gpt-image-2',
      imageCount: 1,
      ratio: '1:1',
      clarity: '1k',
    };
    const firstResponse = await fetch(`${baseUrl}/api/generate/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const first = await readJson(firstResponse);
    assert.equal(firstResponse.status, 202, `First image task was not accepted: ${JSON.stringify(first)}`);
    assert(
      ['pending', 'running'].includes(first.status),
      'A newly accepted task must expose whether it is queued or already owns the Provider slot'
    );
    assert(first.taskId, 'First image task did not return a task id');

    const secondResponse = await fetch(`${baseUrl}/api/generate/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const second = await readJson(secondResponse);
    assert.equal(secondResponse.status, 202, `Second image task was not accepted: ${JSON.stringify(second)}`);
    assert(second.taskId, 'Second image task did not return a task id');
    assert.notEqual(second.taskId, first.taskId, 'Two intentional submissions must create independent tasks');
    assert(['pending', 'running'].includes(second.status), 'Second image task must expose a real queue state');

    const completedTasks = new Map([[first.taskId, first], [second.taskId, second]]);
    for (let attempt = 0; attempt < 120; attempt += 1) {
      if ([...completedTasks.values()].every(task => ['success', 'failed'].includes(task.status))) break;
      await new Promise(resolve => setTimeout(resolve, 50));
      for (const taskId of completedTasks.keys()) {
        const pollResponse = await fetch(`${baseUrl}/api/generate/tasks/${taskId}`, {
          headers: { Authorization: `Bearer ${login.token}` },
        });
        completedTasks.set(taskId, await readJson(pollResponse));
      }
    }
    for (const task of completedTasks.values()) {
      assert.equal(task.status, 'success', `Accepted image task did not complete: ${JSON.stringify(task)}`);
    }
    assert.equal(providerCalls, 2, 'Two intentional submissions must both call the Provider');

    const referenceResponse = await fetch(`${baseUrl}/api/generate/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        prompt: '[REFERENCE-METADATA] generate from one small reference',
        referenceImages: [`data:image/png;base64,${generatedPngBase64}`],
      }),
    });
    const referenceTask = await readJson(referenceResponse);
    assert.equal(referenceResponse.status, 202, `Reference task was not accepted: ${JSON.stringify(referenceTask)}`);
    let referenceResult = referenceTask;
    for (let attempt = 0; attempt < 120 && !['success', 'failed'].includes(referenceResult.status); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const pollResponse = await fetch(`${baseUrl}/api/generate/tasks/${referenceTask.taskId}`, {
        headers: { Authorization: `Bearer ${login.token}` },
      });
      referenceResult = await readJson(pollResponse);
    }
    assert.equal(referenceResult.status, 'success', `Reference task did not complete: ${JSON.stringify(referenceResult)}`);
    assert.deepEqual(referenceResult.request?.referenceImageBytes, [Buffer.from(generatedPngBase64, 'base64').length]);
    assert.equal(referenceResult.request?.referenceImageTotalBytes, Buffer.from(generatedPngBase64, 'base64').length);
    assert.equal(referenceResult.request?.transportMode, 'http-direct');
    assert.equal(referenceResult.request?.preTlsRetryCount, 0);
    assert.equal(providerCalls, 3, 'Normal reference task must reach the Provider once');

    const emptyResponse = await fetch(`${baseUrl}/api/generate/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, prompt: '[EMPTY-200] verify billed empty response metadata' }),
    });
    const emptyTask = await readJson(emptyResponse);
    assert.equal(emptyResponse.status, 202, `Empty response task was not accepted: ${JSON.stringify(emptyTask)}`);
    let emptyResult = emptyTask;
    for (let attempt = 0; attempt < 120 && !['success', 'failed'].includes(emptyResult.status); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const pollResponse = await fetch(`${baseUrl}/api/generate/tasks/${emptyTask.taskId}`, {
        headers: { Authorization: `Bearer ${login.token}` },
      });
      emptyResult = await readJson(pollResponse);
    }
    assert.equal(emptyResult.status, 'failed');
    assert.equal(emptyResult.errorCode, 'PROVIDER_IMAGE_EMPTY_BILLED_RESPONSE');
    assert.equal(emptyResult.billingStatus, 'refunded');
    assert.equal(emptyResult.request?.providerBillingStatus, 'unknown');
    assert.equal(emptyResult.request?.upstreamBillingAmbiguous, true);
    assert.equal(emptyResult.request?.billingAuditRequired, true);
    assert.equal(providerCalls, 4, 'Empty HTTP 200 response must not trigger automatic replay');

    const skippedResponse = await fetch(`${baseUrl}/api/generate/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, prompt: '[SKIPPED-200] verify special cooldown classification' }),
    });
    const skippedTask = await readJson(skippedResponse);
    assert.equal(skippedResponse.status, 202, `Skipped-mainline task was not accepted: ${JSON.stringify(skippedTask)}`);
    let skippedResult = skippedTask;
    for (let attempt = 0; attempt < 120 && !['success', 'failed'].includes(skippedResult.status); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const pollResponse = await fetch(`${baseUrl}/api/generate/tasks/${skippedTask.taskId}`, {
        headers: { Authorization: `Bearer ${login.token}` },
      });
      skippedResult = await readJson(pollResponse);
    }
    assert.equal(skippedResult.status, 'failed');
    assert.equal(skippedResult.errorCode, 'LINGSUAN_SKIPPED_MAINLINE');
    assert.equal(skippedResult.request?.retryAfterMs, 60000);
    assert.equal(skippedResult.request?.upstreamBillingAmbiguous, true);
    assert.equal(providerCalls, 5, 'HTTP 200 skipped_mainline must fail once without replay');

    const failedResponse = await fetch(`${baseUrl}/api/generate/tasks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        prompt: '[FAIL-524] verify diagnostics and manual retry guard',
        routeId: faultRouteId,
        referenceImages: [`data:image/png;base64,${generatedPngBase64}`],
      }),
    });
    const failedTask = await readJson(failedResponse);
    assert.equal(failedResponse.status, 202, `Failure diagnostic task was not accepted: ${JSON.stringify(failedTask)}`);
    let failedResult = failedTask;
    for (let attempt = 0; attempt < 120 && !['success', 'failed'].includes(failedResult.status); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const pollResponse = await fetch(`${baseUrl}/api/generate/tasks/${failedTask.taskId}`, {
        headers: { Authorization: `Bearer ${login.token}` },
      });
      failedResult = await readJson(pollResponse);
    }
    assert.equal(failedResult.status, 'failed');
    assert.equal(failedResult.errorCode, 'PROVIDER_ORIGIN_TIMEOUT_524');
    assert.equal(failedResult.billingStatus, 'refunded');
    assert.equal(failedResult.request?.providerBillingStatus, 'unknown');
    assert.equal(failedResult.request?.upstreamBillingAmbiguous, true);
    assert.equal(failedResult.request?.responseDiagnostics?.cfRay, 'fake-524-ray-SIN');
    assert.equal(failedResult.request?.responseDiagnostics?.requestId, 'fake-provider-request-524');

    const unconfirmedRetryResponse = await fetch(`${baseUrl}/api/generate/tasks/${failedTask.taskId}/retry`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    const unconfirmedRetry = await readJson(unconfirmedRetryResponse);
    assert.equal(unconfirmedRetryResponse.status, 409);
    assert.equal(unconfirmedRetry.code, 'GENERATION_RETRY_BILLING_CONFIRMATION_REQUIRED');

    const confirmedRetryResponse = await fetch(`${baseUrl}/api/generate/tasks/${failedTask.taskId}/retry`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmUpstreamBillingRisk: true }),
    });
    const confirmedRetry = await readJson(confirmedRetryResponse);
    assert.equal(confirmedRetryResponse.status, 202, `Confirmed retry was not accepted: ${JSON.stringify(confirmedRetry)}`);
    assert.notEqual(confirmedRetry.taskId, failedTask.taskId);
    assert.equal(confirmedRetry.retryOfTaskId, failedTask.taskId);
    assert.equal(confirmedRetry.status, 'pending', 'Provider cooldown should keep the manual retry queued');
    const cancelRetryResponse = await fetch(`${baseUrl}/api/generate/tasks/${confirmedRetry.taskId}/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: '测试完成，取消冷却中的人工重试任务' }),
    });
    assert.equal(cancelRetryResponse.status, 200, `Retry cleanup cancellation failed: ${await cancelRetryResponse.text()}`);
    assert.equal(providerCalls, 6, 'Manual retry must not bypass the active Provider cooldown');

    const expiredInputDirectory = path.join(dataDir, 'generation-task-inputs', failedTask.taskId);
    const expiredInputAt = new Date(Date.now() - (25 * 60 * 60 * 1000));
    fs.utimesSync(expiredInputDirectory, expiredInputAt, expiredInputAt);
    const expiredRetryResponse = await fetch(`${baseUrl}/api/generate/tasks/${failedTask.taskId}/retry`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ confirmUpstreamBillingRisk: true }),
    });
    const expiredRetry = await readJson(expiredRetryResponse);
    assert.equal(expiredRetryResponse.status, 410);
    assert.equal(expiredRetry.code, 'GENERATION_RETRY_INPUT_EXPIRED');
    assert.equal(providerCalls, 6, '过期参考图必须在创建新任务前拒绝，不能触发 Provider');

    const finalUser = db.prepare('SELECT balance FROM users WHERE id=?').get(initialUser.id);
    const generationCount = db.prepare('SELECT COUNT(*) AS count FROM generations WHERE user_id=?').get(initialUser.id).count;
    assert.equal(finalUser.balance, initialUser.balance - 30, 'Three completed image tasks must deduct their quoted points');
    assert.equal(generationCount, 3, 'Three completed image tasks must create generation history');
    console.log('Image generation multi-submit and reference metadata regression passed.');
  } finally {
    if (db) db.close();
    if (child.exitCode === null) {
      child.kill();
      await new Promise(resolve => {
        child.once('exit', resolve);
        setTimeout(resolve, 3000);
      });
    }
    await new Promise(resolve => fakeProvider.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

main().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
