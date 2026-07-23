const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const Database = require('better-sqlite3');

const repoRoot = path.resolve(__dirname, '..');
const bridgeSecret = 'sk-bridge-image-tools-test-123456';
const referencePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nH0AAAAASUVORK5CYII=',
  'base64',
);
const referencePngBase64 = referencePng.toString('base64');

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
  for (let attempt = 0; attempt < 60; attempt += 1) {
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

function parseMcpResponse(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const events = trimmed
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .filter(line => line && line !== '[DONE]')
    .map(line => JSON.parse(line));
  const response = events.findLast(event => event.result || event.error);
  if (!response) throw new Error(`No MCP JSON-RPC response found: ${text}`);
  return response;
}

async function mcpCall(baseUrl, user, messageId, name, args, referenceImages = [], expectFailure = false, agentId = 'ecommerce-main-image') {
  const encodedReferenceImages = `b64url:${Buffer.from(JSON.stringify(referenceImages), 'utf8').toString('base64url')}`;
  const response = await fetch(`${baseUrl}/api/integrations/librechat/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${bridgeSecret}`,
      'X-Chat-User-Id': `hjm:${user.id}`,
      'X-Chat-User-Email': user.email,
      'X-Chat-Message-Id': messageId,
      'X-Chat-Conversation-Id': 'chat-image-tools-test-conversation',
      'X-Chat-Reference-Images': encodedReferenceImages,
      ...(agentId ? { 'X-Chat-Agent-Id': agentId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `${messageId}-${name}`,
      method: 'tools/call',
      params: { name, arguments: args },
    }),
  });
  const text = await response.text();
  assert.equal(response.status, 200, `MCP ${name} failed: ${response.status} ${text}`);
  const rpc = parseMcpResponse(text);
  if (expectFailure) {
    assert(rpc.error || rpc.result?.isError, `MCP ${name} was expected to fail: ${JSON.stringify(rpc)}`);
    return JSON.stringify(rpc.error || rpc.result);
  }
  assert(!rpc.error, `MCP ${name} returned an error: ${JSON.stringify(rpc.error)}`);
  assert(!rpc.result?.isError, `MCP ${name} tool failed: ${JSON.stringify(rpc.result)}`);
  const result = rpc.result.structuredContent || JSON.parse(rpc.result.content?.[0]?.text || '{}');
  Object.defineProperty(result, 'contentText', {
    value: String(rpc.result.content?.[0]?.text || ''),
    enumerable: false,
  });
  return result;
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-image-tools-'));
  const dataDir = path.join(tempRoot, 'data');
  const uploadDir = path.join(tempRoot, 'uploads');
  const logDir = path.join(tempRoot, 'logs');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
  fs.mkdirSync(logDir, { recursive: true });

  let generationCalls = 0;
  let editCalls = 0;
  const generationSizes = [];
  const editPayloads = [];
  let providerPort = 0;
  const fakeProvider = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/images/reference.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(referencePng);
      return;
    }
    if (req.method === 'GET' && req.url === '/images/generated-edit.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(referencePng);
      return;
    }
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (req.method === 'POST' && req.url === '/v1/images/generations') {
        generationCalls += 1;
        const payload = JSON.parse(body.toString('utf8'));
        assert.equal(payload.model, 'gpt-image-2');
        assert.equal(payload.n, 1);
        generationSizes.push(payload.size);
        if (req.headers.accept === '*/*') {
          assert.deepEqual(
            Object.keys(payload).sort(),
            ['model', 'n', 'output_format', 'prompt', 'quality', 'size'],
            'Packy generation must use only the image-group whitelist',
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${providerPort}/images/generated-edit.png` }] }));
          return;
        }
        assert.deepEqual(
          Object.keys(payload).sort(),
          ['model', 'n', 'output_format', 'prompt', 'quality', 'size'],
          'Lingsuan generation must use only the verified official OpenAI fields',
        );
        assert.equal(req.headers.accept, 'application/json', 'Lingsuan generation selected in admin must request official JSON');
        if (payload.prompt.includes('模拟上游付费空结果')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            data: [{ revised_prompt: 'only prompt, no image' }],
            usage: { input_tokens: 10, output_tokens: 20 },
          }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ b64_json: referencePngBase64, revised_prompt: 'fake completed image' }] }));
        return;
      }
      if (req.method === 'POST' && req.url === '/v1/images/edits') {
        editCalls += 1;
        const multipart = body.toString('latin1');
        editPayloads.push(body.toString('utf8'));
        assert.match(multipart, /filename="reference\.png"/);
        const fieldNames = [...multipart.matchAll(/Content-Disposition: form-data; name="([^"]+)"/g)].map(match => match[1]);
        if (req.headers.accept === '*/*') {
          assert.match(multipart, /name="image"/);
          assert.doesNotMatch(multipart, /name="image\[\]"/);
          assert.deepEqual(
            Array.from(new Set(fieldNames)).sort(),
            ['image', 'model', 'n', 'output_format', 'prompt', 'quality', 'size'],
            'Packy edit must use singular image and omit unsupported extension fields',
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${providerPort}/images/generated-edit.png` }] }));
          return;
        }
        assert.equal(req.headers.accept, 'application/json', 'Lingsuan edit selected in admin must request official JSON');
        assert.match(multipart, /name="image\[\]"/);
        assert.deepEqual(
          Array.from(new Set(fieldNames)).sort(),
          ['image[]', 'model', 'n', 'output_format', 'prompt', 'quality', 'size'],
          'Lingsuan edit must omit stream and all unverified extension fields',
        );
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: [{ b64_json: referencePngBase64 }] }));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: `Unexpected fake provider request: ${req.method} ${req.url}` } }));
    });
  });

  providerPort = await listen(fakeProvider);
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
      ENABLE_LIBRECHAT: 'true',
      LIBRECHAT_BRIDGE_SECRET: bridgeSecret,
      LIBRECHAT_INTERNAL_URL: `http://127.0.0.1:${providerPort}`,
      AI_PROVIDER_GATEWAY: 'legacy',
      AI_API_BASE: `http://127.0.0.1:${providerPort}/v1`,
      AI_IMAGE_KEY: 'sk-fake-image-provider-123456',
      AI_TEXT_KEY: 'sk-fake-text-provider-123456',
      ALLOW_PRIVATE_PROVIDER_IMAGE_PERSIST: 'true',
    },
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });
  child.stderr.on('data', chunk => stderr.push(chunk.toString('utf8')));

  let db;
  try {
    await waitForHealth(baseUrl, child, stderr);
    db = new Database(path.join(dataDir, 'data.db'));
    const user = db.prepare("SELECT id,email,balance FROM users WHERE username='admin'").get();
    assert(user, 'Disposable admin user was not created');

    const loginResponse = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    const loginData = await loginResponse.json();
    assert.equal(loginResponse.status, 200, `Disposable admin login failed: ${JSON.stringify(loginData)}`);
    const createRuleRouteResponse = await fetch(`${baseUrl}/api/admin/api-providers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({
        routeKey: 'future-lingsuan-images-route',
        displayName: 'Future Lingsuan Images Route',
        category: 'image',
        apiFormat: 'lingsuan-images',
        baseUrl: `http://127.0.0.1:${providerPort}/v1`,
        defaultImageModel: 'gpt-image-2',
        imageStream: true,
        imageResponseFormat: 'url',
      }),
    });
    const createRuleRouteData = await createRuleRouteResponse.json();
    assert.equal(createRuleRouteResponse.status, 200, `Future lingsuan rule route creation failed: ${JSON.stringify(createRuleRouteData)}`);
    assert.equal(createRuleRouteData.item?.apiFormat, 'lingsuan-images');
    assert.equal(createRuleRouteData.item?.imageEditEndpoint, '/v1/images/edits');
    assert.equal(createRuleRouteData.item?.imageStream, false);
    assert.equal(createRuleRouteData.item?.imageResponseFormat, 'b64_json');
    const deleteRuleRouteResponse = await fetch(`${baseUrl}/api/admin/api-providers/${encodeURIComponent(createRuleRouteData.item.id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    assert.equal(deleteRuleRouteResponse.status, 200, `Future lingsuan rule route cleanup failed: ${await deleteRuleRouteResponse.text()}`);
    const routeUpdateResponse = await fetch(`${baseUrl}/api/admin/api-providers/pub_route_mr5yltmuc7edcb2b`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({
        apiFormat: 'lingsuan-images',
        requestFormat: 'lingsuan-images',
        baseUrl: `http://127.0.0.1:${providerPort}/v1`,
        imageEndpoint: '/legacy/images/generations',
        imageEditEndpoint: '/legacy/images/edits',
        imageResponseFormat: 'url',
        imageStream: true,
        imagePartialImages: 3,
      }),
    });
    const routeUpdateData = await routeUpdateResponse.json();
    assert.equal(routeUpdateResponse.status, 200, `Disposable lingsuan route update failed: ${JSON.stringify(routeUpdateData)}`);
    assert.equal(routeUpdateData.item?.apiFormat, 'lingsuan-images');
    assert.equal(routeUpdateData.item?.requestFormat, 'lingsuan-images');
    assert.equal(routeUpdateData.item?.imageEndpoint, '/v1/images/generations');
    assert.equal(routeUpdateData.item?.imageEditEndpoint, '/v1/images/edits');
    assert.equal(routeUpdateData.item?.imageResponseFormat, 'b64_json');
    assert.equal(routeUpdateData.item?.imageStream, false);
    assert.equal(routeUpdateData.item?.imagePartialImages, 0);
    assert.equal(routeUpdateData.item?.requestExamples?.[0]?.body?.response_format, undefined);
    assert.equal(routeUpdateData.item?.requestExamples?.[0]?.body?.stream, undefined);
    assert.equal(routeUpdateData.item?.requestExamples?.[1]?.body?.['image[]'], '<file>');
    const packyRouteUpdateResponse = await fetch(`${baseUrl}/api/admin/api-providers/pub_route_openai_gpt_image_2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({
        apiFormat: 'packy-images',
        requestFormat: 'packy-images',
        baseUrl: `http://127.0.0.1:${providerPort}/v1`,
        imageEndpoint: '/legacy/images/generations',
        imageEditEndpoint: '/legacy/images/edits',
        imageResponseFormat: 'b64_json',
        imageStream: true,
        imagePartialImages: 3,
      }),
    });
    const packyRouteUpdateData = await packyRouteUpdateResponse.json();
    assert.equal(packyRouteUpdateResponse.status, 200, `Disposable Packy route update failed: ${JSON.stringify(packyRouteUpdateData)}`);
    assert.equal(packyRouteUpdateData.item?.apiFormat, 'packy-images');
    assert.equal(packyRouteUpdateData.item?.requestFormat, 'packy-images');
    assert.equal(packyRouteUpdateData.item?.imageEndpoint, '/v1/images/generations');
    assert.equal(packyRouteUpdateData.item?.imageEditEndpoint, '/v1/images/edits');
    assert.equal(packyRouteUpdateData.item?.imageResponseFormat, 'url');
    assert.equal(packyRouteUpdateData.item?.imageStream, false);
    assert.equal(packyRouteUpdateData.item?.imagePartialImages, 0);
    assert.equal(packyRouteUpdateData.item?.requestExamples?.[0]?.body?.response_format, undefined);
    assert.equal(packyRouteUpdateData.item?.requestExamples?.[0]?.body?.background, undefined);
    assert.equal(packyRouteUpdateData.item?.requestExamples?.[1]?.body?.image, '<file>');
    assert.equal(packyRouteUpdateData.item?.requestExamples?.[1]?.body?.['image[]'], undefined);
    const routePreferenceResponse = await fetch(`${baseUrl}/api/user/preferences/api-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({ routeId: 'pub_route_mr5yltmuc7edcb2b' }),
    });
    assert.equal(routePreferenceResponse.status, 200, `Disposable lingsuan route selection failed: ${await routePreferenceResponse.text()}`);

    const planProviderCallsBefore = generationCalls + editCalls;
    const imagePlan = await mcpCall(
      baseUrl,
      user,
      'image-plan-message',
      'prepare_ecommerce_image_plan',
      {
        originalRequest: '参考图1排版，用图2产品生成电商主图',
        designPrompt: 'GPT 根据用户要求生成完整设计方案：参考图1的粉色樱花背景、双瓶构图与卖点排版，使用图2绿色洗衣液作为唯一商品主体，保持瓶型、标签和2KG规格。',
        referenceRoles: [
          { imageIndex: 1, roleDescription: '仅参考粉色樱花背景、双瓶构图和卖点排版' },
          { imageIndex: 2, roleDescription: '作为最终绿色洗衣液商品主体' },
        ],
        copyItems: [
          { id: 'main-title', label: '主标题', text: '打开衣柜都是香的', source: 'GPT 拟定' },
          { id: 'subtitle', label: '副标题', text: '茉莉白茶香氛', source: '识别自图片 2' },
          { id: 'selling-points', label: '核心卖点', text: '深层洁净｜护色柔顺', source: 'GPT 拟定' },
          { id: 'badges', label: '圆形卖点章', text: '168h持久留香｜洁净去渍', source: '识别自图片 2' },
          { id: 'footer', label: '底部横幅', text: '香氛洗衣', source: 'GPT 拟定' },
          { id: 'specification', label: '规格/容量', text: '净含量2KG', source: '识别自图片 2' },
        ],
        modelKey: 'gpt-image-2',
        imageCount: 1,
        ratio: '1:1',
      },
      ['/images/product.png', '/images/style.png'],
    );
    assert.match(imagePlan.contentText, /电商主图设计方案/, 'The first step must return a design plan instead of a quote');
    assert.match(imagePlan.contentText, /上图文案/, 'The design plan must list the on-image copy');
    assert.match(imagePlan.contentText, /HJM_IMAGE_PLAN_FORM:/, 'The design plan must include the ordinary-user form payload');
    assert.doesNotMatch(imagePlan.contentText, /生图报价已准备/, 'Preparing a plan must not create an image quote');
    assert.equal(imagePlan.referenceImageCount, 2, 'The plan must persist both product and style references');
    assert.equal(generationCalls + editCalls, planProviderCallsBefore, 'Preparing a plan must not call the image Provider');
    const scopedPlanError = await mcpCall(
      baseUrl,
      user,
      'image-plan-wrong-agent-message',
      'prepare_ecommerce_image_plan',
      {
        originalRequest: '生成电商主图',
        designPrompt: '这是一份足够完整但不应被其他智能体保存的电商主图设计方案，用于验证智能体隔离，并确保只有指定的电商主图设计师能够进入两阶段方案流程。',
        referenceRoles: [{ imageIndex: 1, roleDescription: '产品主体' }],
        copyItems: [],
      },
      ['/images/product.png'],
      true,
      'promotion-poster-designer',
    );
    assert(scopedPlanError.includes('电商主图设计师'), `Other agents must not execute the ecommerce plan tool: ${scopedPlanError}`);

    const confirmedPlanQuote = await mcpCall(
      baseUrl,
      user,
      'image-plan-confirm-message',
      'confirm_ecommerce_image_plan',
      {
        confirmationCode: imagePlan.confirmationCode,
        designPrompt: '用户修改后的完整设计方案：继续参考图1排版并使用图2商品主体，主标题调整为高对比度红色大字。',
        copyItems: [
          { id: 'main-title', label: '主标题', text: '打开衣柜 都是茉莉香', source: '恶意修改来源' },
          { id: 'subtitle', label: '副标题', text: '茉莉白茶庭院香氛', source: '恶意修改来源' },
          { id: 'specification', label: '规格/容量', text: '净含量2KG', source: '恶意修改来源' },
        ],
        adjustment: '主标题使用高对比度红色大字',
        finalPrompt: 'GPT 重新生成的最终提示词：严格按照用户指定关系参考图1的排版与构图，使用图2洗衣液作为最终产品主体，主标题为“打开衣柜 都是茉莉香”，规格为净含量2KG。',
      },
    );
    assert.match(confirmedPlanQuote.contentText, /方案已确认，最终提示词已生成/, 'Confirming the plan must create the final prompt');
    assert.match(confirmedPlanQuote.contentText, /生图报价已准备/, 'The confirmed plan must then create an image quote');
    assert.equal(confirmedPlanQuote.referenceImageCount, 2, 'The quote must inherit both original references from the plan');
    assert.match(confirmedPlanQuote.finalPrompt, /打开衣柜 都是茉莉香/, 'Form changes must override the original title in the final prompt');
    assert.match(confirmedPlanQuote.finalPrompt, /GPT 重新生成的最终提示词/, 'The confirmed plan must use the GPT-regenerated prompt instead of a server template');
    assert.match(confirmedPlanQuote.finalPrompt, /主标题使用高对比度红色大字/, 'GPT final prompt must retain the requested adjustment');
    assert.match(confirmedPlanQuote.finalPrompt, /图1：仅参考粉色樱花背景|图2：作为最终绿色洗衣液/, 'The final prompt must preserve user-defined reference-image roles');
    assert.equal(confirmedPlanQuote.copyItems[0].source, 'GPT 拟定', 'Source attribution must remain read-only');
    assert.equal(generationCalls + editCalls, planProviderCallsBefore, 'Plan confirmation and quoting must not call the image Provider');
    const confirmedPlanQuoteRow = db.prepare('SELECT request_json FROM chat_image_quotes WHERE id=?').get(confirmedPlanQuote.quoteId);
    const confirmedPlanRequest = JSON.parse(confirmedPlanQuoteRow.request_json);
    assert.equal(confirmedPlanRequest.referenceImages.length, 2, 'Persisted quote must contain both original references');
    assert.equal(confirmedPlanRequest.planId, imagePlan.planId, 'The image quote must remain linked to the confirmed plan');

    const revisedPlan = await mcpCall(
      baseUrl,
      user,
      'image-plan-revision-message',
      'prepare_ecommerce_image_plan',
      {
        originalRequest: '修改图片：保留产品不变，把主标题放大并提高对比度',
        designPrompt: '在上一版完整方案基础上重新设计：保持用户指定的产品与排版参考关系不变，把主标题放大并提高对比度，其他已确认内容继续保留。',
        referenceRoles: imagePlan.plan.referenceRoles,
        copyItems: imagePlan.plan.copyItems,
        revisionNotes: '修改图片：保留产品不变，把主标题放大并提高对比度',
      },
    );
    assert.equal(revisedPlan.referenceImageCount, 2, 'A text-only revision must recover both references from conversation state');
    assert.match(revisedPlan.plan.revisionNotes, /主标题放大/, 'The revision request must be carried into the next plan');
    assert.equal(generationCalls + editCalls, planProviderCallsBefore, 'Revision planning must not call the image Provider');
    db.prepare('DELETE FROM chat_image_quotes WHERE id=?').run(confirmedPlanQuote.quoteId);
    db.prepare('DELETE FROM chat_image_plans WHERE user_id=?').run(user.id);

    const textQuote = await mcpCall(
      baseUrl,
      user,
      'text-image-quote-message',
      'prepare_image_generation',
      { prompt: '生成一张白底商品主图', modelKey: 'gpt-image-2', imageCount: 1 },
    );
    assert.match(textQuote.contentText, /生图报价已准备/, 'Quote output must be readable for ordinary users');
    assert.match(textQuote.contentText, /生图线路：/, 'Quote output must show the selected image route');
    assert.doesNotMatch(textQuote.contentText, /"quoteId"|"modelKey"|"instruction"/, 'Quote output must not expose internal JSON fields');
    assert.equal(textQuote.imageRouteId, 'pub_route_mr5yltmuc7edcb2b', 'Quote must lock the selected image route');
    const textQuoteRow = db.prepare('SELECT request_json FROM chat_image_quotes WHERE id=?').get(textQuote.quoteId);
    const textQuoteRequest = JSON.parse(textQuoteRow.request_json);
    assert.equal(textQuoteRequest.imageRouteId, 'pub_route_mr5yltmuc7edcb2b');

    const switchRouteAfterQuoteResponse = await fetch(`${baseUrl}/api/user/preferences/api-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({ routeId: 'pub_route_openai_gpt_image_2' }),
    });
    assert.equal(
      switchRouteAfterQuoteResponse.status,
      200,
      `Disposable Packy route selection failed: ${await switchRouteAfterQuoteResponse.text()}`,
    );
    const textResult = await mcpCall(
      baseUrl,
      user,
      'text-image-confirm-message',
      'execute_image_generation',
      { quoteId: textQuote.quoteId, confirmationCode: textQuote.confirmationCode },
    );
    assert.match(textResult.contentText, /图片生成完成/, 'Generation output must be readable for ordinary users');
    assert.doesNotMatch(textResult.contentText, /"taskId"|"modelKey"|"quoteId"/, 'Generation output must not expose internal JSON fields');
    assert(textResult.taskId, 'Text-to-image execution must return a completed task');
    assert.match(textResult.images?.[0]?.url || '', /^\/uploads\/generated\/[a-f0-9]+\.png$/);
    assert.equal(textResult.images?.[0]?.width, 1, 'Persisted image metadata must use the real width');
    assert.equal(textResult.images?.[0]?.height, 1, 'Persisted image metadata must use the real height');
    assert(!JSON.stringify(textResult).includes(referencePngBase64), 'MCP result must use a short persisted URL instead of Base64');
    const generatedFile = path.join(uploadDir, textResult.images[0].url.replace(/^\/uploads\//, ''));
    assert.deepEqual(fs.readFileSync(generatedFile), referencePng, 'Persisted Provider Base64 image must preserve the original bytes');

    const restoreLingsuanPreferenceResponse = await fetch(`${baseUrl}/api/user/preferences/api-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({ routeId: 'pub_route_mr5yltmuc7edcb2b' }),
    });
    assert.equal(
      restoreLingsuanPreferenceResponse.status,
      200,
      `Disposable lingsuan route restore failed: ${await restoreLingsuanPreferenceResponse.text()}`,
    );

    const editQuote = await mcpCall(
      baseUrl,
      user,
      'edit-image-quote-message',
      'prepare_image_generation',
      { prompt: '保留产品主体并替换成自然场景', modelKey: 'gpt-image-2', imageCount: 1 },
      ['/images/reference.png'],
    );
    const editQuoteRow = db.prepare('SELECT request_json FROM chat_image_quotes WHERE id=?').get(editQuote.quoteId);
    const editQuoteRequest = JSON.parse(editQuoteRow.request_json);
    assert.equal(
      editQuoteRequest.referenceImages.length,
      1,
      'Current LibreChat attachment must be included in the image quote',
    );
    const unicodeAttachmentQuote = await mcpCall(
      baseUrl,
      user,
      'unicode-attachment-quote-message',
      'prepare_image_generation',
      { prompt: '保留中文文件名附件中的产品主体', modelKey: 'gpt-image-2', imageCount: 1 },
      ['/images/未命名图片.png'],
    );
    assert.equal(unicodeAttachmentQuote.referenceImageCount, 1, 'Chinese attachment paths must reach the MCP quote');
    db.prepare('DELETE FROM chat_image_quotes WHERE id=?').run(unicodeAttachmentQuote.quoteId);
    const editResult = await mcpCall(
      baseUrl,
      user,
      'edit-image-confirm-message',
      'execute_image_generation',
      { confirmationCode: editQuote.confirmationCode },
    );
    assert(editResult.taskId, 'Image-to-image execution must return a completed task');
    assert.match(editResult.images?.[0]?.url || '', /^\/uploads\/generated\/[a-f0-9]+\.png$/);
    const editedFile = path.join(uploadDir, editResult.images[0].url.replace(/^\/uploads\//, ''));
    assert.deepEqual(fs.readFileSync(editedFile), referencePng, 'Persisted Provider URL image must preserve the original bytes');

    const quickTaskResponse = await fetch(`${baseUrl}/api/generate/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({
        prompt: '用图1产品生成电商场景图',
        modelKey: 'gpt-image-2',
        imageCount: 1,
        ratio: '1:1',
        clarity: '4k',
        referenceImages: [`http://127.0.0.1:${providerPort}/images/reference.png`],
      }),
    });
    const quickTask = await quickTaskResponse.json();
    assert.equal(quickTaskResponse.status, 202, `Quick generation task was not accepted: ${JSON.stringify(quickTask)}`);
    let quickTaskResult = quickTask;
    for (let attempt = 0; attempt < 80 && !['success', 'completed', 'failed'].includes(quickTaskResult.status); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const pollResponse = await fetch(`${baseUrl}/api/generate/tasks/${quickTask.taskId}`, {
        headers: { Authorization: `Bearer ${loginData.token}` },
      });
      quickTaskResult = await pollResponse.json();
    }
    assert(['success', 'completed'].includes(quickTaskResult.status), `Quick generation task failed: ${JSON.stringify(quickTaskResult)}`);
    const quickEditPayload = editPayloads.at(-1) || '';
    assert.match(quickEditPayload, /name="size"\r\n\r\n2880x2880/, 'Lingsuan 4K square edit must send the verified official pixel size');
    assert.match(quickEditPayload, /name="quality"\r\n\r\nhigh/, 'Lingsuan 4K edit must send high quality');
    assert.match(quickEditPayload, /name="prompt"\r\n\r\n用图1产品生成电商场景图\r\n/, 'Quick generation must send the visible node prompt unchanged');
    assert.doesNotMatch(quickEditPayload, /最终输出画布|重新构图|扩展场景|不得沿用参考图/, 'Quick generation must not append hidden canvas constraints');

    const mismatchQuote = await mcpCall(
      baseUrl,
      user,
      'mismatch-image-quote-message',
      'prepare_image_generation',
      { prompt: '生成一张横版商品场景图', modelKey: 'gpt-image-2', imageCount: 1, ratio: '16:9' },
    );
    const mismatchResult = await mcpCall(
      baseUrl,
      user,
      'mismatch-image-confirm-message',
      'execute_image_generation',
      { quoteId: mismatchQuote.quoteId, confirmationCode: mismatchQuote.confirmationCode },
      [],
    );
    assert.match(mismatchResult.images?.[0]?.url || '', /^\/uploads\/generated\/[a-f0-9]+\.png$/, 'Wrong-ratio Provider output must still be persisted and returned');
    assert.equal(mismatchResult.images?.[0]?.aspectRatioWarning?.code, 'PROVIDER_IMAGE_ASPECT_RATIO_MISMATCH', 'Wrong-ratio Provider output must carry warning metadata');
    assert.match(mismatchResult.images?.[0]?.warning || '', /已保留并显示原图/, 'Wrong-ratio warning must explain that the paid image was retained');

    const emptyQuote = await mcpCall(
      baseUrl,
      user,
      'empty-image-quote-message',
      'prepare_image_generation',
      { prompt: '模拟上游付费空结果', modelKey: 'gpt-image-2', imageCount: 1 },
    );
    const emptyError = await mcpCall(
      baseUrl,
      user,
      'empty-image-confirm-message',
      'execute_image_generation',
      { quoteId: emptyQuote.quoteId, confirmationCode: emptyQuote.confirmationCode },
      [],
      true,
    );
    assert.match(emptyError, /上游可能已经计费/, 'HTTP 200 without a final image must explain the upstream billing risk');
    assert.match(emptyError, /不会扣除算力/, 'HTTP 200 without a final image must confirm that local points are not charged');

    const packyPreferenceResponse = await fetch(`${baseUrl}/api/user/preferences/api-route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({ routeId: 'pub_route_openai_gpt_image_2' }),
    });
    assert.equal(packyPreferenceResponse.status, 200, `Disposable Packy route selection failed: ${await packyPreferenceResponse.text()}`);
    const packyEditTaskResponse = await fetch(`${baseUrl}/api/generate/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${loginData.token}` },
      body: JSON.stringify({
        prompt: '使用 Packy image 分组生成商品场景图',
        modelKey: 'gpt-image-2',
        imageCount: 1,
        ratio: '1:1',
        clarity: '2k',
        referenceImages: [`http://127.0.0.1:${providerPort}/images/reference.png`],
      }),
    });
    let packyEditTask = await packyEditTaskResponse.json();
    assert.equal(packyEditTaskResponse.status, 202, `Packy edit task was not accepted: ${JSON.stringify(packyEditTask)}`);
    for (let attempt = 0; attempt < 80 && !['success', 'completed', 'failed'].includes(packyEditTask.status); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 50));
      const pollResponse = await fetch(`${baseUrl}/api/generate/tasks/${packyEditTask.taskId}`, {
        headers: { Authorization: `Bearer ${loginData.token}` },
      });
      packyEditTask = await pollResponse.json();
    }
    assert(['success', 'completed'].includes(packyEditTask.status), `Packy edit task failed: ${JSON.stringify(packyEditTask)}`);

    const packyTestResponse = await fetch(`${baseUrl}/api/admin/api-providers/pub_route_openai_gpt_image_2/test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginData.token}` },
    });
    const packyTest = await packyTestResponse.json();
    assert.equal(packyTestResponse.status, 200, `Disposable Packy route test failed: ${JSON.stringify(packyTest)}`);
    assert.equal(packyTest.request?.stream, undefined, 'Packy route must omit unsupported stream');
    assert.equal(packyTest.request?.response_format, undefined, 'Packy route must omit unsupported response_format');
    assert.equal(packyTest.request?.timeoutMs, 360000, 'Packy Images must use its isolated six-minute Provider timeout');

    const finalUser = db.prepare('SELECT balance FROM users WHERE id=?').get(user.id);
    const generations = db.prepare('SELECT model_key,cost,status,result_url FROM generations WHERE user_id=? ORDER BY created_at').all(user.id);
    const quotes = db.prepare('SELECT status FROM chat_image_quotes WHERE user_id=? ORDER BY created_at').all(user.id);
    const mismatchQuoteRow = db.prepare('SELECT status FROM chat_image_quotes WHERE id=?').get(mismatchQuote.quoteId);
    assert.equal(generationCalls, 4, 'Three lingsuan checks and one Packy isolation check must call the generations endpoint');
    assert.equal(editCalls, 3, 'Two Lingsuan edits and one Packy edit must call the edits endpoint');
    assert.deepEqual(generationSizes, ['1024x1024', '1072x624', '1024x1024', '1024x1024'], 'Provider must receive resolved pixel sizes, never ratio tokens');
    assert.equal(finalUser.balance, user.balance - 50, 'Five successful image executions must deduct five 10-point image charges');
    assert.equal(generations.length, 5, 'All readable generated images must be written to existing generation history');
    assert.equal(mismatchQuoteRow.status, 'completed', 'Wrong-ratio quote must complete after retaining the returned image');
    assert(generations.every(item => item.status === 'completed' && item.cost === 10));
    assert(generations.every(item => /^\/uploads\/generated\/[a-f0-9]+\.png$/.test(item.result_url)));
    assert.deepEqual(quotes.map(item => item.status), ['completed', 'completed', 'completed', 'failed']);
    console.log('Chat image tools regression passed: Lingsuan and Packy use isolated strict image adapters with Base64/URL response compatibility.');
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

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
