// 账号隔离云端资产库契约测试（Task 6）。
// 启动 disposable 后端（Fake Storage + 已知签名密钥），验证：
// - A/B 用户资产严格隔离（列表、详情、改名、删除、签发访问 URL 均不泄漏存在性）
// - 上传经后端 magic bytes 校验，伪造 MIME、SVG、超限文件被拒绝
// - 上传响应不含任何存储密钥，访问 URL 为后端签发的 15 分钟短时效 URL
// - generations 记录可导入当前账号资产库
// - 删除为软删除（deleted_at 非空），不物理删除云对象
// - 过期或篡改的签名内容 URL 被拒绝
// - ENABLE_REAL_STORAGE=true 且无可用真实存储时返回 503 ASSET_STORAGE_UNAVAILABLE，不回退本地
// 不得在断言失败信息中打印文件内容、Base64 或密钥。

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');

const repoRoot = path.resolve(__dirname, '..');
const SIGNING_SECRET = 'asset-test-signing-secret-2026-07-27';
const ACCESS_URL_TTL_SECONDS = 900;

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

function rawRequest({ method = 'GET', url, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method, headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let json = null;
        try { json = JSON.parse(buffer.toString('utf8')); } catch {}
        resolve({ status: response.statusCode, headers: response.headers, buffer, json });
      });
    });
    request.once('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

function api(baseUrl, method, apiPath, { token, jsonBody, headers = {}, body } = {}) {
  const finalHeaders = { ...headers };
  let payload = body || null;
  if (jsonBody !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = Buffer.from(JSON.stringify(jsonBody));
  }
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  return rawRequest({ method, url: `${baseUrl}${apiPath}`, headers: finalHeaders, body: payload });
}

function multipartBody(fields, file) {
  const boundary = `----hjmAssetTest${crypto.randomBytes(8).toString('hex')}`;
  const parts = [];
  Object.entries(fields || {}).forEach(([name, value]) => {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  });
  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${file.field || 'file'}"; filename="${file.filename}"\r\n` +
    `Content-Type: ${file.contentType}\r\n\r\n`
  ));
  parts.push(file.data);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { boundary, body: Buffer.concat(parts) };
}

function upload(baseUrl, token, file, fields = {}) {
  const { boundary, body } = multipartBody(fields, file);
  return api(baseUrl, 'POST', '/api/user/assets/upload', {
    token,
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body
  });
}

async function waitForHealth(baseUrl, processState) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processState.exited) throw new Error(`资产测试服务提前退出：${processState.logs()}`);
    try {
      const response = await rawRequest({ url: `${baseUrl}/api/health` });
      if (response.status === 200 && response.json && response.json.success && response.json.database === 'ok') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`资产测试服务启动超时：${processState.logs()}`);
}

async function startServer(extraEnv = {}) {
  const port = await availablePort();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-cloud-assets-'));
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
      ASSET_URL_SIGNING_SECRET: SIGNING_SECRET,
      ADMIN_BOOTSTRAP_USERNAME: 'cloud-assets-admin',
      ADMIN_BOOTSTRAP_PASSWORD: 'CloudAssetsAdmin!2026',
      CORS_ORIGINS: `http://127.0.0.1:${port}`,
      CANVAS_RUNTIME: 'legacy',
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
    dbPath: path.join(tempRoot, 'data', 'data.db'),
    uploadDir: path.join(tempRoot, 'uploads'),
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
  fs.rmSync(instance.tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

function signContentUrl(assetId, expires) {
  return crypto.createHmac('sha256', SIGNING_SECRET).update(`${assetId}.${expires}`).digest('hex');
}

// 各类真实文件头样本（只含 magic bytes 与少量填充，不含任何真实文件内容）
const PNG_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(64)]);
const JPEG_BYTES = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), crypto.randomBytes(64)]);
const MP4_BYTES = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]), crypto.randomBytes(32)]);
const SVG_BYTES = Buffer.from('<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');
const EXE_BYTES = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), crypto.randomBytes(64)]);

async function registerUser(baseUrl, label) {
  const suffix = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
  const response = await api(baseUrl, 'POST', '/api/auth/register', {
    jsonBody: {
      username: `asset-${label}-${suffix}`,
      email: `asset-${label}-${suffix}@test.internal`,
      password: `AssetTest!${suffix}`
    }
  });
  assert(response.status === 200 && response.json && response.json.token, `注册用户 ${label} 失败：HTTP ${response.status}`);
  return { token: response.json.token, user: response.json.user };
}

async function main() {
  const checks = [];
  const check = (name, fn) => checks.push({ name, fn });

  const server = await startServer();
  let db = null;
  try {
    await waitForHealth(server.baseUrl, server.processState);
    db = new Database(server.dbPath);
    db.pragma('busy_timeout = 5000');

    const userA = await registerUser(server.baseUrl, 'a');
    const userB = await registerUser(server.baseUrl, 'b');

    // 未登录访问
    const unauth = await api(server.baseUrl, 'GET', '/api/user/assets');
    check('unauthenticated', () => assert(unauth.status === 401, `未登录访问 /api/user/assets 应返回 401，实际 ${unauth.status}`));

    // A 上传 PNG
    const uploadA = await upload(server.baseUrl, userA.token, { filename: 'pixel-a.png', contentType: 'image/png', data: PNG_BYTES });
    check('upload-ok', () => {
      assert(uploadA.status === 200, `A 上传 PNG 应返回 200，实际 ${uploadA.status}：${JSON.stringify(uploadA.json)}`);
      const asset = uploadA.json && uploadA.json.asset;
      assert(uploadA.json.success === true && asset, '上传响应必须包含 success 与 asset');
      assert(typeof asset.id === 'string' && asset.id.startsWith('asset_'), `资产 ID 应由服务器生成（asset_*），实际 ${asset.id}`);
      assert(asset.kind === 'image', `kind 应为 image，实际 ${asset.kind}`);
      assert(asset.name === 'pixel-a.png', `name 应为原始文件名，实际 ${asset.name}`);
      assert(asset.mimeType === 'image/png', `mimeType 应为 image/png，实际 ${asset.mimeType}`);
      assert(asset.sizeBytes === PNG_BYTES.length, `sizeBytes 应为 ${PNG_BYTES.length}，实际 ${asset.sizeBytes}`);
    });
    const assetA = uploadA.json && uploadA.json.asset;
    const assetAId = assetA ? assetA.id : 'asset_upload_failed';

    check('upload-no-storage-credentials', () => {
      const text = JSON.stringify(uploadA.json);
      assert(!/secretAccessKey|accessKeyId|OBJECT_STORAGE_|sessionToken|presign/i.test(text), '上传响应不得包含任何对象存储密钥或凭据字段');
      const accessUrl = uploadA.json.accessUrl || (assetA && assetA.accessUrl) || '';
      assert(!accessUrl || accessUrl.startsWith('/api/asset-content/'), `accessUrl 必须是同源后端签发路径，实际 ${accessUrl}`);
      assert(!accessUrl.includes(SIGNING_SECRET), 'accessUrl 不得包含签名密钥本身');
    });

    // 列表隔离
    const listA = await api(server.baseUrl, 'GET', '/api/user/assets', { token: userA.token });
    const listB = await api(server.baseUrl, 'GET', '/api/user/assets', { token: userB.token });
    check('list-isolation', () => {
      assert(listA.status === 200 && Array.isArray(listA.json.items), `A 列表应返回 items，实际 ${JSON.stringify(listA.json)}`);
      assert(listA.json.items.some(item => item.id === assetAId), 'A 的列表必须包含 A 刚上传的资产');
      assert(listB.status === 200 && Array.isArray(listB.json.items), 'B 列表请求应成功');
      assert(!listB.json.items.some(item => item.id === assetAId), 'B 的列表不得包含 A 的资产');
    });

    // B 对 A 资产的读/改/删/签发一律 404，不泄漏存在性
    const crossGet = await api(server.baseUrl, 'GET', `/api/user/assets/${assetAId}`, { token: userB.token });
    const crossPut = await api(server.baseUrl, 'PUT', `/api/user/assets/${assetAId}`, { token: userB.token, jsonBody: { name: 'hacked' } });
    const crossDelete = await api(server.baseUrl, 'DELETE', `/api/user/assets/${assetAId}`, { token: userB.token });
    const crossSign = await api(server.baseUrl, 'GET', `/api/user/assets/${assetAId}/access-url`, { token: userB.token });
    check('cross-user-not-found', () => {
      [['GET', crossGet], ['PUT', crossPut], ['DELETE', crossDelete], ['access-url', crossSign]].forEach(([op, res]) => {
        assert(res.status === 404, `B ${op} A 的资产应返回 404，实际 ${res.status}`);
        assert(!JSON.stringify(res.json || {}).includes('pixel-a.png'), `B ${op} A 的资产响应不得泄漏资产名称`);
      });
    });

    // magic bytes：伪造 MIME、SVG、超限
    const fakePng = await upload(server.baseUrl, userA.token, { filename: 'evil.png', contentType: 'image/png', data: EXE_BYTES });
    const svgAsPng = await upload(server.baseUrl, userA.token, { filename: 'icon.png', contentType: 'image/png', data: SVG_BYTES });
    const svgAsSvg = await upload(server.baseUrl, userA.token, { filename: 'icon.svg', contentType: 'image/svg+xml', data: SVG_BYTES });
    const oversizeData = Buffer.concat([PNG_BYTES.subarray(0, 8), crypto.randomBytes(20 * 1024 * 1024)]);
    const oversize = await upload(server.baseUrl, userA.token, { filename: 'huge.png', contentType: 'image/png', data: oversizeData });
    check('magic-bytes-validation', () => {
      assert(fakePng.status === 400, `伪造 PNG 头（实为 EXE）应返回 400，实际 ${fakePng.status}`);
      assert(/ASSET_MIME_MISMATCH|ASSET_TYPE_NOT_ALLOWED/.test(fakePng.json && fakePng.json.code || ''), `伪造 MIME 错误码异常：${fakePng.json && fakePng.json.code}`);
      assert(svgAsPng.status === 400, `SVG 伪装 PNG 应返回 400，实际 ${svgAsPng.status}`);
      assert(svgAsSvg.status === 400, `SVG 上传应被拒绝（400），实际 ${svgAsSvg.status}`);
    });
    check('size-limit', () => {
      assert(oversize.status === 413 || oversize.status === 400, `超过 20MB 的图片应返回 413/400，实际 ${oversize.status}`);
      assert((oversize.json && oversize.json.code) === 'ASSET_FILE_TOO_LARGE', `超限错误码应为 ASSET_FILE_TOO_LARGE，实际 ${oversize.json && oversize.json.code}`);
    });

    // JPEG 与 MP4 正向样例
    const uploadJpeg = await upload(server.baseUrl, userA.token, { filename: 'photo.jpg', contentType: 'image/jpeg', data: JPEG_BYTES });
    const uploadMp4 = await upload(server.baseUrl, userA.token, { filename: 'clip.mp4', contentType: 'video/mp4', data: MP4_BYTES });
    check('jpeg-mp4-accepted', () => {
      assert(uploadJpeg.status === 200 && uploadJpeg.json.asset.kind === 'image', `JPEG 应上传成功，实际 ${uploadJpeg.status}`);
      assert(uploadMp4.status === 200 && uploadMp4.json.asset.kind === 'video', `MP4 应上传成功且 kind=video，实际 ${uploadMp4.status}`);
    });

    // import-generation：直接向 generations 表播种一条 A 的记录
    const generatedDir = path.join(server.uploadDir, 'generated');
    fs.mkdirSync(generatedDir, { recursive: true });
    fs.writeFileSync(path.join(generatedDir, 'gen-import-a.png'), PNG_BYTES);
    const generationId = `gen_assettest_${Date.now().toString(36)}`;
    db.prepare("INSERT INTO generations (id,user_id,model_key,prompt,result_url,cost,status) VALUES (?,?,?,?,?,?,?)")
      .run(generationId, userA.user.id, 'gpt-image-2', '导入测试', '/uploads/generated/gen-import-a.png', 0, 'completed');
    const importA = await api(server.baseUrl, 'POST', '/api/user/assets/import-generation', { token: userA.token, jsonBody: { generationId } });
    const importCross = await api(server.baseUrl, 'POST', '/api/user/assets/import-generation', { token: userB.token, jsonBody: { generationId } });
    const importMissing = await api(server.baseUrl, 'POST', '/api/user/assets/import-generation', { token: userA.token, jsonBody: { generationId: 'gen_not_exists' } });
    check('import-generation', () => {
      assert(importA.status === 200 && importA.json.asset, `import-generation 应返回 200，实际 ${importA.status}：${JSON.stringify(importA.json)}`);
      assert(importA.json.asset.source === 'generation', `导入资产 source 应为 generation，实际 ${importA.json.asset.source}`);
      assert(importA.json.asset.kind === 'image', '导入资产 kind 应为 image');
      assert(importA.json.asset.mimeType === 'image/png', '导入资产必须经 magic bytes 识别为 image/png');
      assert(importCross.status === 404, `B 导入 A 的生成记录应返回 404，实际 ${importCross.status}`);
      assert(importMissing.status === 404, `导入不存在的生成记录应返回 404，实际 ${importMissing.status}`);
    });

    // access-url：15 分钟有效期、内容回读、过期/篡改拒绝
    const accessRes = await api(server.baseUrl, 'GET', `/api/user/assets/${assetAId}/access-url`, { token: userA.token });
    check('access-url-contract', () => {
      assert(accessRes.status === 200, `access-url 应返回 200，实际 ${accessRes.status}`);
      assert(accessRes.json.expiresInSeconds === ACCESS_URL_TTL_SECONDS, `有效期应为 ${ACCESS_URL_TTL_SECONDS} 秒，实际 ${accessRes.json.expiresInSeconds}`);
      assert(typeof accessRes.json.url === 'string' && accessRes.json.url.startsWith('/api/asset-content/'), `签发 URL 异常：${accessRes.json.url}`);
      const parsed = new URL(accessRes.json.url, server.baseUrl);
      const expires = Number(parsed.searchParams.get('expires'));
      const delta = expires - Math.floor(Date.now() / 1000);
      assert(delta > ACCESS_URL_TTL_SECONDS - 120 && delta <= ACCESS_URL_TTL_SECONDS + 5, `expires 应约为当前时间 +15 分钟，实际差 ${delta} 秒`);
    });
    const signedUrl = (accessRes.json && accessRes.json.url) || '/api/asset-content/asset_upload_failed?expires=0&sig=missing';
    const contentRes = await rawRequest({ url: `${server.baseUrl}${signedUrl}` });
    check('signed-content-read', () => {
      assert(contentRes.status === 200, `签名内容 URL 应返回 200，实际 ${contentRes.status}`);
      assert(String(contentRes.headers['content-type'] || '').includes('image/png'), `内容类型应为 image/png，实际 ${contentRes.headers['content-type']}`);
      assert(contentRes.buffer.equals(PNG_BYTES), '回读内容必须与上传字节一致');
    });
    const expiredExpires = Math.floor(Date.now() / 1000) - 10;
    const expiredUrl = `/api/asset-content/${assetAId}?expires=${expiredExpires}&sig=${signContentUrl(assetAId, expiredExpires)}`;
    const expiredRes = await rawRequest({ url: `${server.baseUrl}${expiredUrl}` });
    const validExpires = Math.floor(Date.now() / 1000) + 600;
    const tamperedUrl = `/api/asset-content/${assetAId}?expires=${validExpires}&sig=${'0'.repeat(64)}`;
    const tamperedRes = await rawRequest({ url: `${server.baseUrl}${tamperedUrl}` });
    const foreignExpires = Math.floor(Date.now() / 1000) + 600;
    const foreignUrl = `/api/asset-content/${assetAId}?expires=${foreignExpires}&sig=${signContentUrl('asset_other', foreignExpires)}`;
    const foreignRes = await rawRequest({ url: `${server.baseUrl}${foreignUrl}` });
    check('signed-url-expiry-and-tamper', () => {
      assert(expiredRes.status === 403, `过期签名 URL 应返回 403，实际 ${expiredRes.status}`);
      assert((expiredRes.json && expiredRes.json.code) === 'ASSET_URL_EXPIRED', `过期错误码应为 ASSET_URL_EXPIRED，实际 ${expiredRes.json && expiredRes.json.code}`);
      assert(tamperedRes.status === 403, `篡改签名应返回 403，实际 ${tamperedRes.status}`);
      assert(foreignRes.status === 403, `为其他资产签发的签名不得用于本资产，实际 ${foreignRes.status}`);
    });

    // 软删除：列表消失，DB deleted_at 非空，内容 URL 失效
    const deleteRes = await api(server.baseUrl, 'DELETE', `/api/user/assets/${assetAId}`, { token: userA.token });
    const deletedRow = db.prepare('SELECT deleted_at,status FROM user_assets WHERE id=?').get(assetAId) || null;
    check('soft-delete', () => {
      assert(deleteRes.status === 200 && deleteRes.json.success === true, `删除应返回 200，实际 ${deleteRes.status}`);
      assert(deletedRow, '软删除后 user_assets 行必须保留（不得物理删除记录）');
      assert(deletedRow.deleted_at, '软删除后 deleted_at 必须非空');
    });
    const listAfterDelete = await api(server.baseUrl, 'GET', '/api/user/assets', { token: userA.token });
    const contentAfterDelete = await rawRequest({ url: `${server.baseUrl}${signedUrl}` });
    check('soft-delete-visibility', () => {
      assert(!listAfterDelete.json.items.some(item => item.id === assetAId), '软删除后列表不得再出现该资产');
      assert(contentAfterDelete.status === 404 || contentAfterDelete.status === 410, `软删除后签名内容 URL 应失效，实际 ${contentAfterDelete.status}`);
    });

    // 分页：B 上传 12 个文件，limit=5 翻页无重复、不一次返回全部
    for (let index = 0; index < 12; index += 1) {
      const res = await upload(server.baseUrl, userB.token, { filename: `page-${String(index).padStart(2, '0')}.png`, contentType: 'image/png', data: PNG_BYTES });
      if (res.status !== 200) break; // 上传接口尚未实现时由后续检查统一报告失败
    }
    const page1 = await api(server.baseUrl, 'GET', '/api/user/assets?limit=5', { token: userB.token });
    check('pagination-first-page', () => {
      assert(page1.status === 200, `分页第一页应返回 200，实际 ${page1.status}`);
      assert(page1.json.items.length === 5, `limit=5 第一页应返回 5 条，实际 ${page1.json.items.length}`);
      assert(typeof page1.json.nextCursor === 'string' && page1.json.nextCursor, '还有更多数据时必须返回 nextCursor');
    });
    const cursor1 = (page1.json && page1.json.nextCursor) || 'missing-cursor';
    const page2 = await api(server.baseUrl, 'GET', `/api/user/assets?limit=5&cursor=${encodeURIComponent(cursor1)}`, { token: userB.token });
    const cursor2 = (page2.json && page2.json.nextCursor) || 'missing-cursor';
    const page3 = await api(server.baseUrl, 'GET', `/api/user/assets?limit=5&cursor=${encodeURIComponent(cursor2)}`, { token: userB.token });
    check('pagination-walk', () => {
      assert(page2.json.items.length === 5, `第二页应返回 5 条，实际 ${page2.json.items.length}`);
      assert(page3.json.items.length === 2, `第三页应返回 2 条，实际 ${page3.json.items.length}`);
      assert(!page3.json.nextCursor, '最后一页不得返回 nextCursor');
      const ids = [...page1.json.items, ...page2.json.items, ...page3.json.items].map(item => item.id);
      assert(new Set(ids).size === ids.length, '分页结果不得出现重复资产');
      assert(!ids.includes(assetAId), 'B 的分页结果不得包含 A 的资产');
    });

    // 搜索与类型筛选
    const searchRes = await api(server.baseUrl, 'GET', '/api/user/assets?q=page-03', { token: userB.token });
    const kindRes = await api(server.baseUrl, 'GET', '/api/user/assets?kind=video', { token: userA.token });
    check('search-and-kind-filter', () => {
      assert(searchRes.json.items.length === 1 && searchRes.json.items[0].name === 'page-03.png', `搜索 page-03 应只命中 1 条，实际 ${searchRes.json.items.length}`);
      assert(kindRes.json.items.every(item => item.kind === 'video') && kindRes.json.items.length === 1, `kind=video 应只返回视频资产，实际 ${kindRes.json.items.length}`);
    });

    // 改名与标签
    const updateRes = await api(server.baseUrl, 'PUT', `/api/user/assets/${(uploadMp4.json && uploadMp4.json.asset && uploadMp4.json.asset.id) || 'asset_upload_failed'}`, { token: userA.token, jsonBody: { name: '改名后.mp4', tags: ['素材', '测试'] } });
    check('rename-and-tags', () => {
      assert(updateRes.status === 200, `改名应返回 200，实际 ${updateRes.status}`);
      assert(updateRes.json.asset.name === '改名后.mp4', '改名未生效');
      assert(JSON.stringify(updateRes.json.asset.tags) === JSON.stringify(['素材', '测试']), `标签未生效：${JSON.stringify(updateRes.json.asset.tags)}`);
    });

    db.close();
    db = null;
  } finally {
    if (db) {
      try { db.close(); } catch {}
      db = null;
    }
    await stopServer(server);
  }

  // ENABLE_REAL_STORAGE=true 且没有可用真实存储实现：必须 503，不回退本地 uploads
  const realServer = await startServer({ ENABLE_REAL_STORAGE: 'true' });
  try {
    await waitForHealth(realServer.baseUrl, realServer.processState);
    const user = await registerUser(realServer.baseUrl, 'real');
    const res = await upload(realServer.baseUrl, user.token, { filename: 'pixel.png', contentType: 'image/png', data: PNG_BYTES });
    check('real-storage-unavailable-503', () => {
      assert(res.status === 503, `ENABLE_REAL_STORAGE=true 且无真实存储时上传应返回 503，实际 ${res.status}`);
      assert((res.json && res.json.code) === 'ASSET_STORAGE_UNAVAILABLE', `错误码应为 ASSET_STORAGE_UNAVAILABLE，实际 ${res.json && res.json.code}`);
    });
  } finally {
    await stopServer(realServer);
  }

  const failures = [];
  checks.forEach(({ name, fn }) => {
    try {
      fn();
      console.log(`PASS ${name}`);
    } catch (error) {
      failures.push(name);
      console.error(`FAIL ${name}: ${error.message}`);
    }
  });
  if (failures.length) {
    console.error(`\n${failures.length}/${checks.length} 项检查失败`);
    process.exit(1);
  }
  console.log(JSON.stringify({ total: checks.length, failed: 0 }, null, 2));
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
