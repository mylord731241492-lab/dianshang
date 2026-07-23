const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.join(__dirname, '..');
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=';
const enhancedPrompt = [
  '任务目标：基于图1中的真实产品生成高转化电商主图，保持瓶型、宽高比例、瓶盖结构、瓶身颜色、标签轮廓、Logo和包装文字完全可识别。',
  '参考图角色：图1是唯一产品参考，只用于锁定商品身份、包装结构、颜色与材质，不从其他来源引入新的品牌或商品。',
  '构图与镜头：产品位于画面视觉中心，采用略低机位的正面商业摄影视角，主体占画面约六成，四周保留干净留白，边缘完整且不裁切。',
  '场景与光影：使用干净的暖白渐变背景和克制的台面反射，主光从左前上方柔和照射，右侧弱补光，底部形成真实接触阴影，高光受控不过曝。',
  '材质与质量：瓶身材质纹理、标签纸张、印刷边缘和细微环境反射清楚自然，焦点准确，轮廓锐利但不过度锐化，曝光稳定，无压缩糊感。',
  '禁止主体变形、比例错误、结构缺失、标签变化、Logo变化、乱码、错别字、水印、二维码、多余商品、悬浮、边缘光晕、背景发灰和廉价CG感。'
].join('');

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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
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
  const providerRequests = [];
  const provider = http.createServer(async (req, res) => {
    const body = await readJsonBody(req);
    providerRequests.push({ path: req.url, body });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.url === '/responses') {
      const requestText = JSON.stringify(body.input || '');
      res.end(JSON.stringify({
        output_text: requestText.includes('目标长度约 500–900 个中文字符')
          ? enhancedPrompt
          : '白底电商产品图，商品居中，柔和棚拍光线，材质清晰，构图简洁。'
      }));
      return;
    }
    res.statusCode = 502;
    res.end(JSON.stringify({ error: { message: 'Provider returned 502' } }));
  });

  const providerPort = await listen(provider);
  const appPort = await freePort();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-reverse-prompt-'));
  const dataDir = path.join(tempRoot, 'data');
  const uploadDir = path.join(tempRoot, 'uploads');
  const generatedDir = path.join(uploadDir, 'generated');
  const logDir = path.join(tempRoot, 'logs');
  const workflowDir = path.join(tempRoot, 'workflows');
  [dataDir, uploadDir, generatedDir, logDir, workflowDir].forEach((dir) => fs.mkdirSync(dir, { recursive: true }));
  fs.writeFileSync(path.join(generatedDir, 'reverse-prompt.png'), Buffer.from(pngBase64, 'base64'));

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
      WORKFLOW_DIR: workflowDir,
      ENABLE_REAL_AI: 'true',
      ENABLE_REAL_EMAIL: 'false',
      ENABLE_REAL_PAYMENT: 'false',
      ENABLE_REAL_STORAGE: 'false',
      AI_PROVIDER_GATEWAY: 'new-api',
      AI_API_BASE: `http://127.0.0.1:${providerPort}`,
      NEW_API_BASE: `http://127.0.0.1:${providerPort}`,
      AI_API_KEY: 'sk-reverse-prompt-test',
      AI_TEXT_KEY: 'sk-reverse-prompt-test',
      AI_IMAGE_KEY: 'sk-reverse-prompt-test',
      NEW_API_KEY: 'sk-reverse-prompt-test'
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

    const result = await api(baseUrl, '/api/image-tools/reverse-prompt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.data.token}` },
      body: JSON.stringify({ imageUrl: '/uploads/generated/reverse-prompt.png' })
    });
    assert.strictEqual(result.response.status, 200, JSON.stringify(result.data));
    assert.strictEqual(result.data.success, true);
    assert(result.data.prompt.includes('白底电商产品图'), JSON.stringify(result.data));
    assert.strictEqual(providerRequests.length, 1, JSON.stringify(providerRequests));
    assert.strictEqual(providerRequests[0].path, '/responses', JSON.stringify(providerRequests[0]));
    assert.strictEqual(providerRequests[0].body.model, 'gpt-5.6-terra');

    const input = providerRequests[0].body.input;
    assert(Array.isArray(input), '反推请求必须使用多模态 Responses input');
    const content = input[0]?.content;
    assert(Array.isArray(content), '反推请求缺少多模态 content');
    const image = content.find((item) => item.type === 'input_image');
    assert(image?.image_url?.startsWith('data:image/png;base64,'), '反推请求没有携带可读取的图片 Data URL');

    const profileBefore = await api(baseUrl, '/api/user/profile', {
      headers: { Authorization: `Bearer ${login.data.token}` }
    });
    assert.strictEqual(profileBefore.response.status, 200, JSON.stringify(profileBefore.data));

    const enhanced = await api(baseUrl, '/api/canvas/enhance-prompt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.data.token}` },
      body: JSON.stringify({
        currentPrompt: '图1作为唯一产品，制作暖白背景的电商主图',
        referenceImages: [{ url: '/uploads/generated/reverse-prompt.png' }]
      })
    });
    assert.strictEqual(enhanced.response.status, 200, JSON.stringify(enhanced.data));
    assert.strictEqual(enhanced.data.success, true);
    assert.strictEqual(enhanced.data.free, true);
    assert.strictEqual(enhanced.data.costPoints, 0);
    assert.strictEqual(enhanced.data.prompt, enhancedPrompt);
    assert.strictEqual(enhanced.data.imageCount, 1);
    assert.strictEqual(providerRequests.length, 2, JSON.stringify(providerRequests));
    assert.strictEqual(providerRequests[1].path, '/responses');
    assert.strictEqual(providerRequests[1].body.model, 'gpt-5.6-terra');
    const enhancedInput = providerRequests[1].body.input;
    assert(Array.isArray(enhancedInput), '扩写请求必须使用 Responses input');
    assert(JSON.stringify(enhancedInput).includes('图1作为唯一产品'), '扩写请求没有携带原始提示词');
    const enhancedImage = enhancedInput.flatMap((item) => item.content || []).find((item) => item.type === 'input_image');
    assert(enhancedImage?.image_url?.startsWith('data:image/png;base64,'), '扩写请求没有携带真实参考图');

    const tooMany = await api(baseUrl, '/api/canvas/enhance-prompt', {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.data.token}` },
      body: JSON.stringify({
        currentPrompt: '限制检查',
        referenceImages: Array.from({ length: 5 }, () => ({ url: '/uploads/generated/reverse-prompt.png' }))
      })
    });
    assert.strictEqual(tooMany.response.status, 400, JSON.stringify(tooMany.data));
    assert.strictEqual(tooMany.data.code, 'CANVAS_PROMPT_REFERENCE_LIMIT');
    assert.strictEqual(providerRequests.length, 2, '超出图片上限时不得调用 Provider');

    const profileAfter = await api(baseUrl, '/api/user/profile', {
      headers: { Authorization: `Bearer ${login.data.token}` }
    });
    assert.strictEqual(profileAfter.response.status, 200, JSON.stringify(profileAfter.data));
    assert.strictEqual(profileAfter.data.user.balance, profileBefore.data.user.balance, '免费扩写不得修改用户余额');

    console.log('反推提示词与免费 GPT-5.6 多模态扩写回归通过');
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
  console.error(error);
  process.exit(1);
});
