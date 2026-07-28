// 系统提示词库契约测试（Task 7）。
// 启动 disposable 后端，验证：
// - 只有 admin 能创建/编辑/发布/停用/排序/删除系统提示词；普通用户写操作 403 ADMIN_REQUIRED
// - 普通用户只读到 status='published' AND deleted_at IS NULL；draft/disabled 不出现
// - 每次修改内容 version 自增；仅改状态/排序不自增
// - 列表按 sort_order 升序；支持 q/category/tag 过滤与 cursor 分页
// - HTML/脚本内容按纯文本原样存取
// - 删除为软删除（deleted_at 非空），删除后详情 404
// - 401/404/字段校验使用稳定错误码
// 不得在断言失败信息中打印提示词正文全文。

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');

const repoRoot = path.resolve(__dirname, '..');
const ADMIN_USER = 'system-prompts-admin';
const ADMIN_PASS = 'SystemPromptsAdmin!2026';

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

async function waitForHealth(baseUrl, processState) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (processState.exited) throw new Error(`系统提示词测试服务提前退出：${processState.logs()}`);
    try {
      const response = await rawRequest({ url: `${baseUrl}/api/health` });
      if (response.status === 200 && response.json && response.json.success && response.json.database === 'ok') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`系统提示词测试服务启动超时：${processState.logs()}`);
}

async function startServer(extraEnv = {}) {
  const port = await availablePort();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-system-prompts-'));
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
      ADMIN_BOOTSTRAP_USERNAME: ADMIN_USER,
      ADMIN_BOOTSTRAP_PASSWORD: ADMIN_PASS,
      CORS_ORIGINS: `http://127.0.0.1:${port}`,
      CANVAS_RUNTIME: 'legacy',
      ENABLE_REAL_AI: 'false',
      ENABLE_REAL_EMAIL: 'false',
      ENABLE_REAL_PAYMENT: 'false',
      ENABLE_REAL_STORAGE: 'false',
      ENABLE_LIBRECHAT: 'false',
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

async function registerUser(baseUrl, label) {
  const suffix = `${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
  const response = await api(baseUrl, 'POST', '/api/auth/register', {
    jsonBody: {
      username: `sysp-${label}-${suffix}`,
      email: `sysp-${label}-${suffix}@test.internal`,
      password: `SysPromptTest!${suffix}`
    }
  });
  assert(response.status === 200 && response.json && response.json.token, `注册用户 ${label} 失败：HTTP ${response.status}`);
  return { token: response.json.token, user: response.json.user };
}

async function adminLogin(baseUrl) {
  const response = await api(baseUrl, 'POST', '/api/admin/login', { jsonBody: { username: ADMIN_USER, password: ADMIN_PASS } });
  assert(response.status === 200 && response.json && response.json.token, `管理员登录失败：HTTP ${response.status}`);
  return response.json.token;
}

const HTML_CONTENT = '<script>alert("x")</script><b>加粗</b>&amp; <img src=x onerror=alert(1)>';

async function main() {
  const checks = [];
  const check = (name, fn) => checks.push({ name, fn });

  const server = await startServer();
  let db = null;
  try {
    await waitForHealth(server.baseUrl, server.processState);
    db = new Database(server.dbPath);
    db.pragma('busy_timeout = 5000');

    const adminToken = await adminLogin(server.baseUrl);
    const user = await registerUser(server.baseUrl, 'u');

    // 未登录
    const unauthList = await api(server.baseUrl, 'GET', '/api/prompts/system');
    const unauthAdmin = await api(server.baseUrl, 'GET', '/api/admin/system-prompts');
    check('unauthenticated-401', () => {
      assert(unauthList.status === 401, `未登录 GET /api/prompts/system 应返回 401，实际 ${unauthList.status}`);
      assert((unauthList.json && unauthList.json.code) === 'AUTH_REQUIRED', `错误码应为 AUTH_REQUIRED，实际 ${unauthList.json && unauthList.json.code}`);
      assert(unauthAdmin.status === 401, `未登录 GET /api/admin/system-prompts 应返回 401，实际 ${unauthAdmin.status}`);
    });

    // 普通用户写操作一律 403
    const userCreate = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: user.token, jsonBody: { title: '越权', content: '越权', status: 'draft' } });
    const userList = await api(server.baseUrl, 'GET', '/api/admin/system-prompts', { token: user.token });
    const userPut = await api(server.baseUrl, 'PUT', '/api/admin/system-prompts/prompt_nope', { token: user.token, jsonBody: { title: 'x' } });
    const userDelete = await api(server.baseUrl, 'DELETE', '/api/admin/system-prompts/prompt_nope', { token: user.token });
    check('user-write-forbidden-403', () => {
      [['POST', userCreate], ['GET', userList], ['PUT', userPut], ['DELETE', userDelete]].forEach(([op, res]) => {
        assert(res.status === 403, `普通用户 ${op} 管理接口应返回 403，实际 ${res.status}`);
        assert((res.json && res.json.code) === 'ADMIN_REQUIRED', `普通用户 ${op} 错误码应为 ADMIN_REQUIRED，实际 ${res.json && res.json.code}`);
      });
    });

    // admin 创建草稿（含 HTML 内容）
    const createDraft = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', {
      token: adminToken,
      jsonBody: { title: '白底商品主图', content: HTML_CONTENT, category: '电商主图', tags: ['白底', '产品'], status: 'draft', sortOrder: 20 }
    });
    check('admin-create-draft', () => {
      assert(createDraft.status === 200, `创建草稿应返回 200，实际 ${createDraft.status}：${JSON.stringify(createDraft.json && createDraft.json.code)}`);
      const item = createDraft.json && createDraft.json.item;
      assert(createDraft.json.success === true && item, '响应必须包含 success 与 item');
      assert(typeof item.id === 'string' && item.id.startsWith('prompt_'), `ID 应由服务器生成（prompt_*），实际 ${item.id}`);
      assert(item.scope === 'system', `scope 应为 system，实际 ${item.scope}`);
      assert(item.status === 'draft', `status 应为 draft，实际 ${item.status}`);
      assert(item.version === 1, `初始 version 应为 1，实际 ${item.version}`);
      assert(item.sortOrder === 20, `sortOrder 应为 20，实际 ${item.sortOrder}`);
      assert(item.category === '电商主图' && JSON.stringify(item.tags) === JSON.stringify(['白底', '产品']), 'category/tags 未生效');
      assert(item.content === HTML_CONTENT, 'HTML 内容必须按纯文本原样保存');
      assert(typeof item.createdAt === 'string' && typeof item.updatedAt === 'string', '必须返回 createdAt/updatedAt');
    });
    const draftId = (createDraft.json && createDraft.json.item && createDraft.json.item.id) || 'prompt_create_failed';

    // 草稿不出现在普通用户列表
    const userListDraft = await api(server.baseUrl, 'GET', '/api/prompts/system', { token: user.token });
    check('user-list-excludes-draft', () => {
      assert(userListDraft.status === 200 && Array.isArray(userListDraft.json.items), `用户列表应返回 items，实际 ${JSON.stringify(userListDraft.json && userListDraft.json.code)}`);
      assert(!userListDraft.json.items.some(item => item.id === draftId), '草稿不得出现在普通用户列表');
    });

    // 字段校验错误码
    const noTitle = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: adminToken, jsonBody: { title: '   ', content: '内容', status: 'draft' } });
    const noContent = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: adminToken, jsonBody: { title: '标题', content: '  ', status: 'draft' } });
    const longTitle = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: adminToken, jsonBody: { title: 'x'.repeat(500), content: '内容', status: 'draft' } });
    const longContent = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: adminToken, jsonBody: { title: '标题', content: 'x'.repeat(100000), status: 'draft' } });
    const tooManyTags = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: adminToken, jsonBody: { title: '标题', content: '内容', status: 'draft', tags: Array.from({ length: 30 }, (_, i) => `t${i}`) } });
    const longTag = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: adminToken, jsonBody: { title: '标题', content: '内容', status: 'draft', tags: ['x'.repeat(200)] } });
    const badStatus = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: adminToken, jsonBody: { title: '标题', content: '内容', status: 'archived' } });
    check('field-validation-codes', () => {
      assert(noTitle.status === 400 && noTitle.json.code === 'PROMPT_TITLE_REQUIRED', `空标题应 400 PROMPT_TITLE_REQUIRED，实际 ${noTitle.status}/${noTitle.json && noTitle.json.code}`);
      assert(noContent.status === 400 && noContent.json.code === 'PROMPT_CONTENT_REQUIRED', `空内容应 400 PROMPT_CONTENT_REQUIRED，实际 ${noContent.status}/${noContent.json && noContent.json.code}`);
      assert(longTitle.status === 400 && longTitle.json.code === 'PROMPT_TITLE_TOO_LONG', `超长标题应 400 PROMPT_TITLE_TOO_LONG，实际 ${longTitle.status}/${longTitle.json && longTitle.json.code}`);
      assert(longContent.status === 400 && longContent.json.code === 'PROMPT_CONTENT_TOO_LONG', `超长内容应 400 PROMPT_CONTENT_TOO_LONG，实际 ${longContent.status}/${longContent.json && longContent.json.code}`);
      assert(tooManyTags.status === 400 && tooManyTags.json.code === 'PROMPT_TAGS_INVALID', `标签过多应 400 PROMPT_TAGS_INVALID，实际 ${tooManyTags.status}/${tooManyTags.json && tooManyTags.json.code}`);
      assert(longTag.status === 400 && longTag.json.code === 'PROMPT_TAGS_INVALID', `单项标签超长应 400 PROMPT_TAGS_INVALID，实际 ${longTag.status}/${longTag.json && longTag.json.code}`);
      assert(badStatus.status === 400 && badStatus.json.code === 'PROMPT_STATUS_INVALID', `非法状态应 400 PROMPT_STATUS_INVALID，实际 ${badStatus.status}/${badStatus.json && badStatus.json.code}`);
    });

    // 发布：普通用户可见；内容修改 version 自增；仅改状态/排序不自增
    const publish = await api(server.baseUrl, 'PUT', `/api/admin/system-prompts/${draftId}`, { token: adminToken, jsonBody: { status: 'published' } });
    const editContent = await api(server.baseUrl, 'PUT', `/api/admin/system-prompts/${draftId}`, { token: adminToken, jsonBody: { content: '保持产品结构不变，纯白背景。' } });
    const reorder = await api(server.baseUrl, 'PUT', `/api/admin/system-prompts/${draftId}`, { token: adminToken, jsonBody: { sortOrder: 5 } });
    check('publish-and-version', () => {
      assert(publish.status === 200 && publish.json.item.status === 'published', `发布应返回 200 published，实际 ${publish.status}`);
      assert(publish.json.item.version === 1, `仅改状态不得自增 version，实际 ${publish.json.item.version}`);
      assert(editContent.status === 200 && editContent.json.item.version === 2, `修改内容后 version 应为 2，实际 ${editContent.json && editContent.json.item && editContent.json.item.version}`);
      assert(editContent.json.item.content === '保持产品结构不变，纯白背景。', '内容修改未生效');
      assert(reorder.status === 200 && reorder.json.item.sortOrder === 5, `排序修改未生效，实际 ${reorder.json && reorder.json.item && reorder.json.item.sortOrder}`);
      assert(reorder.json.item.version === 2, `仅改排序不得自增 version，实际 ${reorder.json.item.version}`);
    });
    const userListPublished = await api(server.baseUrl, 'GET', '/api/prompts/system', { token: user.token });
    check('user-list-published-only', () => {
      const hit = (userListPublished.json.items || []).find(item => item.id === draftId);
      assert(hit, '已发布系统提示词必须出现在普通用户列表');
      assert(hit.version === 2 && hit.sortOrder === 5, `用户列表必须返回 version/sortOrder，实际 v${hit.version}/s${hit.sortOrder}`);
      assert(hit.content === '保持产品结构不变，纯白背景。', '用户列表必须返回最新内容');
    });

    // 停用：用户列表消失，admin 按状态筛选可见，已发布内容快照语义不受影响（列表过滤验证）
    const disable = await api(server.baseUrl, 'PUT', `/api/admin/system-prompts/${draftId}`, { token: adminToken, jsonBody: { status: 'disabled' } });
    const userListDisabled = await api(server.baseUrl, 'GET', '/api/prompts/system', { token: user.token });
    const adminListDisabled = await api(server.baseUrl, 'GET', '/api/admin/system-prompts?status=disabled', { token: adminToken });
    check('disable-flow', () => {
      assert(disable.status === 200 && disable.json.item.status === 'disabled', `停用应返回 200 disabled，实际 ${disable.status}`);
      assert(!(userListDisabled.json.items || []).some(item => item.id === draftId), '停用后不得出现在普通用户列表');
      assert((adminListDisabled.json.items || []).some(item => item.id === draftId), 'admin status=disabled 筛选必须能看到已停用提示词');
    });
    await api(server.baseUrl, 'PUT', `/api/admin/system-prompts/${draftId}`, { token: adminToken, jsonBody: { status: 'published' } });

    // 搜索 / 分类 / 标签过滤（用户视角与 admin 视角）
    const userSearch = await api(server.baseUrl, 'GET', `/api/prompts/system?q=${encodeURIComponent('产品结构')}`, { token: user.token });
    const userCategory = await api(server.baseUrl, 'GET', `/api/prompts/system?category=${encodeURIComponent('电商主图')}`, { token: user.token });
    const userTag = await api(server.baseUrl, 'GET', `/api/prompts/system?tag=${encodeURIComponent('白底')}`, { token: user.token });
    const userTagMiss = await api(server.baseUrl, 'GET', `/api/prompts/system?tag=${encodeURIComponent('不存在标签')}`, { token: user.token });
    const adminSearch = await api(server.baseUrl, 'GET', `/api/admin/system-prompts?q=${encodeURIComponent('白底商品')}`, { token: adminToken });
    check('search-and-filters', () => {
      assert((userSearch.json.items || []).some(item => item.id === draftId), 'q 应能命中内容关键词');
      assert((userCategory.json.items || []).every(item => item.category === '电商主图'), 'category 过滤异常');
      assert((userCategory.json.items || []).some(item => item.id === draftId), 'category 应命中');
      assert((userTag.json.items || []).some(item => item.id === draftId), 'tag 应命中');
      assert(!(userTagMiss.json.items || []).length, '不存在的标签不得命中任何条目');
      assert((adminSearch.json.items || []).some(item => item.id === draftId), 'admin q 应能命中标题关键词');
    });

    // 排序：再建两条 published，sortOrder 1 与 10，用户列表按 sortOrder 升序
    const sort1 = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: adminToken, jsonBody: { title: '排序一', content: '排序一内容', status: 'published', sortOrder: 1 } });
    const sort10 = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', { token: adminToken, jsonBody: { title: '排序十', content: '排序十内容', status: 'published', sortOrder: 10 } });
    const userSorted = await api(server.baseUrl, 'GET', '/api/prompts/system', { token: user.token });
    check('sort-order-asc', () => {
      const ids = (userSorted.json.items || []).map(item => item.id);
      const i1 = ids.indexOf(sort1.json && sort1.json.item && sort1.json.item.id);
      const i10 = ids.indexOf(sort10.json && sort10.json.item && sort10.json.item.id);
      const i20 = ids.indexOf(draftId);
      assert(i1 >= 0 && i10 >= 0 && i20 >= 0, '排序样例必须全部出现在用户列表');
      // 白底提示词此前已被改为 sortOrder=5，期望升序为 排序一(1) < 白底(5) < 排序十(10)
      assert(i1 < i20 && i20 < i10, `用户列表必须按 sortOrder 升序（1<5<10），实际顺序 ${i1},${i10},${i20}`);
    });

    // 分页：排序一/排序十/白底 3 条 published，limit=2 翻页无重复
    const page1 = await api(server.baseUrl, 'GET', '/api/prompts/system?limit=2', { token: user.token });
    check('pagination-first-page', () => {
      assert(page1.status === 200, `分页第一页应返回 200，实际 ${page1.status}`);
      assert(page1.json.items.length === 2, `limit=2 第一页应返回 2 条，实际 ${page1.json.items.length}`);
      assert(typeof page1.json.nextCursor === 'string' && page1.json.nextCursor, '还有更多数据时必须返回 nextCursor');
    });
    const cursor1 = (page1.json && page1.json.nextCursor) || 'missing-cursor';
    const page2 = await api(server.baseUrl, 'GET', `/api/prompts/system?limit=2&cursor=${encodeURIComponent(cursor1)}`, { token: user.token });
    const badCursor = await api(server.baseUrl, 'GET', '/api/prompts/system?cursor=@@@invalid@@@', { token: user.token });
    check('pagination-walk', () => {
      assert(page2.status === 200, `第二页应返回 200，实际 ${page2.status}`);
      assert(page2.json.items.length === 1, `第二页应返回剩余 1 条，实际 ${page2.json.items.length}`);
      assert(!page2.json.nextCursor, '最后一页不得返回 nextCursor');
      const ids = [...page1.json.items, ...page2.json.items].map(item => item.id);
      assert(new Set(ids).size === ids.length, '分页结果不得重复');
      assert(badCursor.status === 400 && badCursor.json.code === 'PROMPT_CURSOR_INVALID', `非法游标应 400 PROMPT_CURSOR_INVALID，实际 ${badCursor.status}/${badCursor.json && badCursor.json.code}`);
    });

    // 404：不存在的 ID
    const getMissing = await api(server.baseUrl, 'GET', '/api/admin/system-prompts/prompt_not_exists', { token: adminToken });
    const putMissing = await api(server.baseUrl, 'PUT', '/api/admin/system-prompts/prompt_not_exists', { token: adminToken, jsonBody: { title: 'x' } });
    const delMissing = await api(server.baseUrl, 'DELETE', '/api/admin/system-prompts/prompt_not_exists', { token: adminToken });
    check('not-found-404', () => {
      [['GET', getMissing], ['PUT', putMissing], ['DELETE', delMissing]].forEach(([op, res]) => {
        assert(res.status === 404, `${op} 不存在的系统提示词应返回 404，实际 ${res.status}`);
        assert((res.json && res.json.code) === 'PROMPT_NOT_FOUND', `${op} 错误码应为 PROMPT_NOT_FOUND，实际 ${res.json && res.json.code}`);
      });
    });

    // 软删除：admin/用户列表消失，详情 404，DB deleted_at 非空
    const deleteRes = await api(server.baseUrl, 'DELETE', `/api/admin/system-prompts/${draftId}`, { token: adminToken });
    const adminListAfter = await api(server.baseUrl, 'GET', '/api/admin/system-prompts', { token: adminToken });
    const userListAfter = await api(server.baseUrl, 'GET', '/api/prompts/system', { token: user.token });
    const getAfterDelete = await api(server.baseUrl, 'GET', `/api/admin/system-prompts/${draftId}`, { token: adminToken });
    let deletedRow = null;
    let deletedRowError = '';
    try {
      deletedRow = db.prepare('SELECT deleted_at FROM system_prompts WHERE id=?').get(draftId) || null;
    } catch (error) {
      deletedRowError = error && error.message ? error.message : String(error);
    }
    check('soft-delete', () => {
      assert(!deletedRowError, `查询 system_prompts 失败：${deletedRowError}`);
      assert(deleteRes.status === 200 && deleteRes.json.success === true, `删除应返回 200，实际 ${deleteRes.status}`);
      assert(deletedRow, '软删除后 system_prompts 行必须保留（不得物理删除）');
      assert(deletedRow.deleted_at, '软删除后 deleted_at 必须非空');
      assert(!(adminListAfter.json.items || []).some(item => item.id === draftId), '软删除后 admin 列表不得再出现');
      assert(!(userListAfter.json.items || []).some(item => item.id === draftId), '软删除后用户列表不得再出现');
      assert(getAfterDelete.status === 404, `软删除后详情应返回 404，实际 ${getAfterDelete.status}`);
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
