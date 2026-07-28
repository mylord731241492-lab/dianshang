// 图片编辑工具（Task 9）端到端契约：启动 disposable 后端 + 本地假 Provider（127.0.0.1，零真实调用零费用），
// 验证原图、mask、prompt 经后端适配器到达 Provider，且工具结果写入账号云端资产库：
// - POST /api/image-tools/inpaint|erase：multipart 含 image 文件、mask 文件、prompt；响应带 assetId + 同源短时 accessUrl
// - POST /api/image-tools/outpaint：multipart 含 image 文件与 prompt（含比例/布局语义）；响应带 assetId + accessUrl
// - POST /api/image-tools/reverse-prompt：/responses 多模态请求携带图片；纯文本响应不落资产
// - POST /api/canvas/enhance-prompt：免费扩写不扣费、不触发生图（Provider 无 /v1/images/* 请求）
// 不得打印图片 Base64、完整提示词或密钥；断言只输出布尔/长度/标记命中。
//
// 本脚本由 scripts/smoke-backend-canvas-boundary.ps1 调用，也可单独运行：node scripts/test-image-tools-provider-payload.js

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.join(__dirname, '..');
// 两张内容不同的 1x1 PNG：source 为原图，mask 为涂抹遮罩（透明区=重绘区）。
const sourcePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const maskPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const PROMPT_MARKER = 'SMOKE_MARKER_9f27';
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// 最小 multipart 解析：只提取每个 part 的 name、是否含 PNG 文件体、文本值是否命中标记。
// 不保留、不打印 part 内容。
function parseMultipartSummary(body, contentType) {
  const boundaryMatch = /boundary=([^\s;]+)/i.exec(String(contentType || ''));
  assert(boundaryMatch, 'multipart 请求缺少 boundary');
  const boundary = Buffer.from(`--${boundaryMatch[1]}`);
  const parts = [];
  let cursor = body.indexOf(boundary);
  while (cursor !== -1) {
    const next = body.indexOf(boundary, cursor + boundary.length);
    if (next === -1) break;
    const part = body.subarray(cursor + boundary.length, next);
    cursor = next;
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const header = part.subarray(0, headerEnd).toString('latin1');
    const nameMatch = /name="([^"]+)"/i.exec(header);
    if (!nameMatch) continue;
    const payload = part.subarray(headerEnd + 4, Math.max(headerEnd + 4, part.length - 2));
    const isFile = /filename="/i.test(header);
    parts.push({
      name: nameMatch[1],
      isFile,
      hasPngSignature: payload.indexOf(PNG_SIGNATURE) !== -1,
      byteLength: payload.length,
      text: isFile ? '' : payload.toString('utf8')
    });
  }
  return parts;
}

async function waitForHealth(baseUrl, child, stderr) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`测试服务器提前退出 (${child.exitCode})：${stderr()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      const data = await response.json();
      if (response.ok && data.success && data.database === 'ok') return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
  throw new Error(`测试服务器未就绪：${stderr()}`);
}

async function api(baseUrl, route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

(async () => {
  const editRequests = [];
  const responsesRequests = [];
  const provider = http.createServer(async (req, res) => {
    const body = await readBody(req);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.url === '/v1/images/edits') {
      editRequests.push(parseMultipartSummary(body, req.headers['content-type']));
      res.end(JSON.stringify({ data: [{ b64_json: sourcePngBase64 }] }));
      return;
    }
    if (req.url === '/responses') {
      let parsed = {};
      try {
        parsed = JSON.parse(body.toString('utf8') || '{}');
      } catch {}
      // 只记录结构事实：是否携带图片输入、是否命中标记；不记录文本内容。
      const input = Array.isArray(parsed.input) ? parsed.input : [];
      const content = input.flatMap((item) => (Array.isArray(item.content) ? item.content : []));
      responsesRequests.push({
        hasImageInput: content.some((item) => item && item.type === 'input_image' && typeof item.image_url === 'string' && item.image_url.startsWith('data:image/')),
        hasMarker: JSON.stringify(parsed.input || '').includes(PROMPT_MARKER)
      });
      // 扩写请求（含目标长度指令）返回长文本以满足后端最小长度护栏；反推返回常规短文本。
      const requestText = JSON.stringify(parsed.input || '');
      const longText = [
        `围绕「${PROMPT_MARKER}」的核心诉求展开：`,
        '主体置于画面视觉中心，采用略低机位正面商业摄影视角，主体占画面约六成，四周保留干净留白。',
        '使用干净的暖白渐变背景与克制的台面反射，主光从左前上方柔和照射，右侧弱补光，底部形成真实接触阴影。',
        '材质纹理、印刷边缘与细微环境反射清晰自然，焦点准确，轮廓锐利但不过度锐化，曝光稳定无压缩糊感。',
        '保持商品包装结构、颜色、标签与品牌标识完全可识别，禁止变形、乱码、水印与廉价 CG 感。'
      ].join('');
      res.end(JSON.stringify({
        output_text: requestText.includes('目标长度') ? longText : `反推结果：${PROMPT_MARKER} 适用的电商提示词正文，主体清晰，构图居中。`
      }));
      return;
    }
    res.statusCode = 502;
    res.end(JSON.stringify({ error: { message: 'Provider returned 502' } }));
  });

  const providerPort = await listen(provider);
  const appPort = await freePort();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-image-tools-'));
  const dataDir = path.join(tempRoot, 'data');
  const uploadDir = path.join(tempRoot, 'uploads');
  const logDir = path.join(tempRoot, 'logs');
  [dataDir, uploadDir, logDir].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

  let stdout = '';
  let stderr = '';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: repoRoot,
    windowsHide: true,
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
      AI_PROVIDER_GATEWAY: 'new-api',
      AI_API_BASE: `http://127.0.0.1:${providerPort}`,
      NEW_API_BASE: `http://127.0.0.1:${providerPort}`,
      AI_API_KEY: 'sk-image-tools-test',
      AI_TEXT_KEY: 'sk-image-tools-test',
      AI_IMAGE_KEY: 'sk-image-tools-test',
      NEW_API_KEY: 'sk-image-tools-test'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

  const baseUrl = `http://127.0.0.1:${appPort}`;
  try {
    await waitForHealth(baseUrl, child, () => `${stdout}\n${stderr}`);
    const login = await api(baseUrl, '/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    assert.strictEqual(login.response.status, 200, JSON.stringify(login.data));
    assert(login.data.token, '登录响应缺少 token');
    const headers = { Authorization: `Bearer ${login.data.token}` };

    const sourceDataUrl = `data:image/png;base64,${sourcePngBase64}`;
    const maskDataUrl = `data:image/png;base64,${maskPngBase64}`;

    function assertEditRequestParts(parts, { expectMask }) {
      const imagePart = parts.find((part) => part.name === 'image' && part.isFile);
      assert(imagePart && imagePart.hasPngSignature && imagePart.byteLength > 0, '适配器未把原图作为 PNG 文件提交给 Provider');
      const promptPart = parts.find((part) => part.name === 'prompt');
      assert(promptPart && promptPart.text.length > 0, '适配器未把 prompt 提交给 Provider');
      const maskPart = parts.find((part) => part.name === 'mask');
      if (expectMask) {
        assert(maskPart && maskPart.isFile && maskPart.hasPngSignature, '适配器未把 PNG mask 提交给 Provider');
      }
      return { promptText: promptPart.text };
    }

    function assertAssetBackedToolResponse(result, label) {
      assert.strictEqual(result.response.status, 200, `${label} 应返回 200：${JSON.stringify({ code: result.data.code, message: result.data.message })}`);
      assert.strictEqual(result.data.success, true, `${label} success 应为 true`);
      assert(typeof result.data.assetId === 'string' && result.data.assetId.startsWith('asset_'), `${label} 响应必须带云端资产 assetId`);
      assert(typeof result.data.accessUrl === 'string' && result.data.accessUrl.startsWith('/api/asset-content/'), `${label} 响应必须带同源短时 accessUrl`);
      const image = Array.isArray(result.data.images) ? result.data.images[0] : null;
      assert(image && image.assetId === result.data.assetId, `${label} 结果图必须带一致的 assetId`);
    }

    // 1) 局部重绘：原图 + PNG mask + prompt 到达适配器，结果落资产
    const inpaint = await api(baseUrl, '/api/image-tools/inpaint', {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageUrl: sourceDataUrl, mask: maskDataUrl, prompt: PROMPT_MARKER })
    });
    assertAssetBackedToolResponse(inpaint, 'inpaint');
    assert.strictEqual(editRequests.length, 1, 'inpaint 应只产生一次 Provider 编辑请求');
    const inpaintParts = assertEditRequestParts(editRequests[0], { expectMask: true });
    assert(inpaintParts.promptText.includes(PROMPT_MARKER), 'inpaint prompt 未携带用户修改要求');
    console.log('OK inpaint: image+mask+prompt reached provider adapter, asset attached');

    // 2) 智能擦除：原图 + mask 到达适配器（prompt 可空，后端生成默认擦除提示）
    const erase = await api(baseUrl, '/api/image-tools/erase', {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageUrl: sourceDataUrl, mask: maskDataUrl })
    });
    assertAssetBackedToolResponse(erase, 'erase');
    assert.strictEqual(editRequests.length, 2, 'erase 应只产生一次 Provider 编辑请求');
    assertEditRequestParts(editRequests[1], { expectMask: true });
    console.log('OK erase: image+mask reached provider adapter, asset attached');

    // 3) 扩图：原图 + 目标比例/布局语义经 prompt 与 size 到达适配器
    const outpaint = await api(baseUrl, '/api/image-tools/outpaint', {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageUrl: sourceDataUrl, prompt: PROMPT_MARKER, ratio: '16:9', layout: { anchor: 'center' } })
    });
    assertAssetBackedToolResponse(outpaint, 'outpaint');
    assert.strictEqual(editRequests.length, 3, 'outpaint 应只产生一次 Provider 编辑请求');
    const outpaintParts = assertEditRequestParts(editRequests[2], { expectMask: false });
    assert(outpaintParts.promptText.includes(PROMPT_MARKER), 'outpaint prompt 未携带用户扩展要求');
    console.log('OK outpaint: image+prompt+ratio reached provider adapter, asset attached');

    // 4) 反推提示词：/responses 多模态请求携带图片；纯文本响应不落资产
    const reverse = await api(baseUrl, '/api/image-tools/reverse-prompt', {
      method: 'POST',
      headers,
      body: JSON.stringify({ imageUrl: sourceDataUrl })
    });
    assert.strictEqual(reverse.response.status, 200, `reverse-prompt 应返回 200：${JSON.stringify({ code: reverse.data.code, message: reverse.data.message })}`);
    assert.strictEqual(reverse.data.success, true);
    assert(typeof reverse.data.prompt === 'string' && reverse.data.prompt.length > 0, 'reverse-prompt 响应缺少提示词文本');
    assert.strictEqual(responsesRequests.length, 1, 'reverse-prompt 应只产生一次 /responses 请求');
    assert(responsesRequests[0].hasImageInput, 'reverse-prompt 未把图片提交给文本模型');
    console.log('OK reverse-prompt: image reached /responses adapter, text-only response');

    // 5) 免费扩写：不扣费、不生图
    const profileBefore = await api(baseUrl, '/api/user/profile', { headers });
    assert.strictEqual(profileBefore.response.status, 200);
    const enhance = await api(baseUrl, '/api/canvas/enhance-prompt', {
      method: 'POST',
      headers,
      body: JSON.stringify({ currentPrompt: PROMPT_MARKER })
    });
    assert.strictEqual(enhance.response.status, 200, `enhance-prompt 应返回 200：${JSON.stringify({ code: enhance.data.code, message: enhance.data.message })}`);
    assert.strictEqual(enhance.data.success, true);
    assert.strictEqual(enhance.data.free, true, 'enhance-prompt 必须标记为免费');
    assert.strictEqual(enhance.data.costPoints, 0, 'enhance-prompt 不得计费');
    assert(typeof enhance.data.prompt === 'string' && enhance.data.prompt.length > 0, 'enhance-prompt 响应缺少扩写文本');
    assert.strictEqual(responsesRequests.length, 2, 'enhance-prompt 应只产生一次 /responses 请求');
    assert(responsesRequests[1].hasMarker, 'enhance-prompt 未携带原始提示词');
    assert.strictEqual(editRequests.length, 3, 'enhance-prompt 不得触发任何生图请求');
    const profileAfter = await api(baseUrl, '/api/user/profile', { headers });
    assert.strictEqual(profileAfter.response.status, 200);
    assert.strictEqual(profileAfter.data.user.balance, profileBefore.data.user.balance, '免费扩写不得修改用户余额');
    console.log('OK enhance-prompt: free, no charge, no image generation');

    console.log('图片编辑工具假 Provider 契约通过（原图/mask/prompt 到达适配器，结果落云端资产库）');
  } finally {
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      setTimeout(resolve, 2000);
    });
    await new Promise((resolve) => provider.close(resolve));
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
