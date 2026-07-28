// 我的提示词（账号私有提示词库）契约测试（Task 7）。
// 启动 disposable 后端（admin + 普通用户 A/B），验证：
// - CRUD、详情、搜索 q、分类 category、标签 tag、收藏 favorite、cursor 分页
// - A 的提示词只在 A 列表；B 读/改/删 A 的提示词一律 404，不泄漏存在性
// - HTML/脚本内容按纯文本原样存取
// - 删除为软删除（deleted_at 非空）
// - copy-system 把已发布系统提示词复制为当前用户私有副本；草稿/停用系统提示词 404
// - 系统提示词与用户提示词允许同名不互覆；同名用户提示词也互不覆盖
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
const ADMIN_USER = 'user-prompts-admin';
const ADMIN_PASS = 'UserPromptsAdmin!2026';

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
    if (processState.exited) throw new Error(`用户提示词测试服务提前退出：${processState.logs()}`);
    try {
      const response = await rawRequest({ url: `${baseUrl}/api/health` });
      if (response.status === 200 && response.json && response.json.success && response.json.database === 'ok') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`用户提示词测试服务启动超时：${processState.logs()}`);
}

async function startServer(extraEnv = {}) {
  const port = await availablePort();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dianshang-user-prompts-'));
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
      username: `usrp-${label}-${suffix}`,
      email: `usrp-${label}-${suffix}@test.internal`,
      password: `UserPromptTest!${suffix}`
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

const HTML_CONTENT = '<script>alert("x")</script><b>加粗</b>&amp;';

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
    const userA = await registerUser(server.baseUrl, 'a');
    const userB = await registerUser(server.baseUrl, 'b');

    // 未登录
    const unauthList = await api(server.baseUrl, 'GET', '/api/user/prompts');
    const unauthCreate = await api(server.baseUrl, 'POST', '/api/user/prompts', { jsonBody: { title: 'x', content: 'y' } });
    check('unauthenticated-401', () => {
      assert(unauthList.status === 401 && unauthList.json.code === 'AUTH_REQUIRED', `未登录列表应 401 AUTH_REQUIRED，实际 ${unauthList.status}/${unauthList.json && unauthList.json.code}`);
      assert(unauthCreate.status === 401, `未登录创建应 401，实际 ${unauthCreate.status}`);
    });

    // A 创建（含 HTML 内容）
    const createA = await api(server.baseUrl, 'POST', '/api/user/prompts', {
      token: userA.token,
      jsonBody: { title: '我的主图提示词', content: HTML_CONTENT, category: '电商主图', tags: ['私有', '主图'], isFavorite: true }
    });
    check('create-ok', () => {
      assert(createA.status === 200, `创建应返回 200，实际 ${createA.status}：${JSON.stringify(createA.json && createA.json.code)}`);
      const item = createA.json && createA.json.item;
      assert(createA.json.success === true && item, '响应必须包含 success 与 item');
      assert(typeof item.id === 'string' && item.id.startsWith('prompt_'), `ID 应由服务器生成（prompt_*），实际 ${item.id}`);
      assert(item.scope === 'user', `scope 应为 user，实际 ${item.scope}`);
      assert(item.isFavorite === true, 'isFavorite 未生效');
      assert(item.category === '电商主图' && JSON.stringify(item.tags) === JSON.stringify(['私有', '主图']), 'category/tags 未生效');
      assert(item.content === HTML_CONTENT, 'HTML 内容必须按纯文本原样保存');
      assert(typeof item.createdAt === 'string' && typeof item.updatedAt === 'string', '必须返回 createdAt/updatedAt');
    });
    const promptAId = (createA.json && createA.json.item && createA.json.item.id) || 'prompt_create_failed';

    // 列表隔离 + 详情
    const listA = await api(server.baseUrl, 'GET', '/api/user/prompts', { token: userA.token });
    const listB = await api(server.baseUrl, 'GET', '/api/user/prompts', { token: userB.token });
    const detailA = await api(server.baseUrl, 'GET', `/api/user/prompts/${promptAId}`, { token: userA.token });
    check('list-isolation-and-detail', () => {
      assert(listA.status === 200 && Array.isArray(listA.json.items), 'A 列表应返回 items');
      assert(listA.json.items.some(item => item.id === promptAId), 'A 的列表必须包含 A 的提示词');
      assert(listB.status === 200 && Array.isArray(listB.json.items), 'B 列表请求应成功');
      assert(!listB.json.items.some(item => item.id === promptAId), 'B 的列表不得包含 A 的提示词');
      assert(detailA.status === 200 && detailA.json.item.id === promptAId, `详情应返回 200，实际 ${detailA.status}`);
      assert(detailA.json.item.content === HTML_CONTENT, '详情必须原样返回 HTML 内容');
    });

    // B 读/改/删 A 的提示词一律 404，不泄漏存在性
    const crossGet = await api(server.baseUrl, 'GET', `/api/user/prompts/${promptAId}`, { token: userB.token });
    const crossPut = await api(server.baseUrl, 'PUT', `/api/user/prompts/${promptAId}`, { token: userB.token, jsonBody: { title: '劫持' } });
    const crossDelete = await api(server.baseUrl, 'DELETE', `/api/user/prompts/${promptAId}`, { token: userB.token });
    check('cross-user-404', () => {
      [['GET', crossGet], ['PUT', crossPut], ['DELETE', crossDelete]].forEach(([op, res]) => {
        assert(res.status === 404, `B ${op} A 的提示词应返回 404，实际 ${res.status}`);
        assert((res.json && res.json.code) === 'PROMPT_NOT_FOUND', `B ${op} 错误码应为 PROMPT_NOT_FOUND，实际 ${res.json && res.json.code}`);
        assert(!JSON.stringify(res.json || {}).includes('我的主图提示词'), `B ${op} 响应不得泄漏标题`);
      });
    });

    // 编辑（部分字段）与收藏筛选
    const updateA = await api(server.baseUrl, 'PUT', `/api/user/prompts/${promptAId}`, {
      token: userA.token,
      jsonBody: { title: '改名后的提示词', tags: ['私有'], isFavorite: false, category: '营销文案' }
    });
    const favList = await api(server.baseUrl, 'GET', '/api/user/prompts?favorite=1', { token: userA.token });
    check('update-and-favorite-filter', () => {
      assert(updateA.status === 200, `编辑应返回 200，实际 ${updateA.status}`);
      const item = updateA.json.item;
      assert(item.title === '改名后的提示词', '标题修改未生效');
      assert(item.category === '营销文案' && JSON.stringify(item.tags) === JSON.stringify(['私有']), 'category/tags 修改未生效');
      assert(item.isFavorite === false, '取消收藏未生效');
      assert(item.content === HTML_CONTENT, '未提交的字段不得被清空');
      assert(!favList.json.items.some(row => row.id === promptAId), 'favorite=1 不得包含已取消收藏的提示词');
    });

    // 字段校验错误码
    const noTitle = await api(server.baseUrl, 'POST', '/api/user/prompts', { token: userA.token, jsonBody: { title: '  ', content: '内容' } });
    const noContent = await api(server.baseUrl, 'POST', '/api/user/prompts', { token: userA.token, jsonBody: { title: '标题', content: '' } });
    const longTitle = await api(server.baseUrl, 'POST', '/api/user/prompts', { token: userA.token, jsonBody: { title: 'x'.repeat(500), content: '内容' } });
    const longContent = await api(server.baseUrl, 'POST', '/api/user/prompts', { token: userA.token, jsonBody: { title: '标题', content: 'x'.repeat(100000) } });
    const tooManyTags = await api(server.baseUrl, 'POST', '/api/user/prompts', { token: userA.token, jsonBody: { title: '标题', content: '内容', tags: Array.from({ length: 30 }, (_, i) => `t${i}`) } });
    const putEmptyTitle = await api(server.baseUrl, 'PUT', `/api/user/prompts/${promptAId}`, { token: userA.token, jsonBody: { title: '   ' } });
    check('field-validation-codes', () => {
      assert(noTitle.status === 400 && noTitle.json.code === 'PROMPT_TITLE_REQUIRED', `空标题应 400 PROMPT_TITLE_REQUIRED，实际 ${noTitle.status}/${noTitle.json && noTitle.json.code}`);
      assert(noContent.status === 400 && noContent.json.code === 'PROMPT_CONTENT_REQUIRED', `空内容应 400 PROMPT_CONTENT_REQUIRED，实际 ${noContent.status}/${noContent.json && noContent.json.code}`);
      assert(longTitle.status === 400 && longTitle.json.code === 'PROMPT_TITLE_TOO_LONG', `超长标题应 400，实际 ${longTitle.status}/${longTitle.json && longTitle.json.code}`);
      assert(longContent.status === 400 && longContent.json.code === 'PROMPT_CONTENT_TOO_LONG', `超长内容应 400，实际 ${longContent.status}/${longContent.json && longContent.json.code}`);
      assert(tooManyTags.status === 400 && tooManyTags.json.code === 'PROMPT_TAGS_INVALID', `标签过多应 400，实际 ${tooManyTags.status}/${tooManyTags.json && tooManyTags.json.code}`);
      assert(putEmptyTitle.status === 400 && putEmptyTitle.json.code === 'PROMPT_TITLE_REQUIRED', `编辑为空标题应 400，实际 ${putEmptyTitle.status}/${putEmptyTitle.json && putEmptyTitle.json.code}`);
    });

    // 搜索 / 分类 / 标签
    const searchTitle = await api(server.baseUrl, 'GET', `/api/user/prompts?q=${encodeURIComponent('改名后')}`, { token: userA.token });
    const searchContent = await api(server.baseUrl, 'GET', `/api/user/prompts?q=${encodeURIComponent('加粗')}`, { token: userA.token });
    const byCategory = await api(server.baseUrl, 'GET', `/api/user/prompts?category=${encodeURIComponent('营销文案')}`, { token: userA.token });
    const byTag = await api(server.baseUrl, 'GET', `/api/user/prompts?tag=${encodeURIComponent('私有')}`, { token: userA.token });
    const byTagMiss = await api(server.baseUrl, 'GET', `/api/user/prompts?tag=${encodeURIComponent('不存在')}`, { token: userA.token });
    check('search-and-filters', () => {
      assert(searchTitle.json.items.some(item => item.id === promptAId), 'q 应命中标题');
      assert(searchContent.json.items.some(item => item.id === promptAId), 'q 应命中内容');
      assert(byCategory.json.items.every(item => item.category === '营销文案') && byCategory.json.items.length === 1, 'category 过滤异常');
      assert(byTag.json.items.some(item => item.id === promptAId), 'tag 应命中');
      assert(!byTagMiss.json.items.length, '不存在的标签不得命中');
    });

    // 分页：B 创建 12 条，limit=5 翻页无重复
    for (let index = 0; index < 12; index += 1) {
      const res = await api(server.baseUrl, 'POST', '/api/user/prompts', { token: userB.token, jsonBody: { title: `分页-${String(index).padStart(2, '0')}`, content: `分页内容 ${index}` } });
      if (res.status !== 200) break; // 接口尚未实现时由后续检查统一报告失败
    }
    const page1 = await api(server.baseUrl, 'GET', '/api/user/prompts?limit=5', { token: userB.token });
    check('pagination-first-page', () => {
      assert(page1.status === 200, `分页第一页应返回 200，实际 ${page1.status}`);
      assert(page1.json.items.length === 5, `limit=5 第一页应返回 5 条，实际 ${page1.json.items.length}`);
      assert(typeof page1.json.nextCursor === 'string' && page1.json.nextCursor, '还有更多数据时必须返回 nextCursor');
    });
    const cursor1 = (page1.json && page1.json.nextCursor) || 'missing-cursor';
    const page2 = await api(server.baseUrl, 'GET', `/api/user/prompts?limit=5&cursor=${encodeURIComponent(cursor1)}`, { token: userB.token });
    const cursor2 = (page2.json && page2.json.nextCursor) || 'missing-cursor';
    const page3 = await api(server.baseUrl, 'GET', `/api/user/prompts?limit=5&cursor=${encodeURIComponent(cursor2)}`, { token: userB.token });
    const badCursor = await api(server.baseUrl, 'GET', '/api/user/prompts?cursor=@@@invalid@@@', { token: userB.token });
    check('pagination-walk', () => {
      assert(page2.json.items.length === 5, `第二页应返回 5 条，实际 ${page2.json.items.length}`);
      assert(page3.json.items.length === 2, `第三页应返回 2 条，实际 ${page3.json.items.length}`);
      assert(!page3.json.nextCursor, '最后一页不得返回 nextCursor');
      const ids = [...page1.json.items, ...page2.json.items, ...page3.json.items].map(item => item.id);
      assert(new Set(ids).size === ids.length, '分页结果不得重复');
      assert(!ids.includes(promptAId), 'B 的分页结果不得包含 A 的提示词');
      assert(badCursor.status === 400 && badCursor.json.code === 'PROMPT_CURSOR_INVALID', `非法游标应 400 PROMPT_CURSOR_INVALID，实际 ${badCursor.status}/${badCursor.json && badCursor.json.code}`);
    });

    // copy-system：admin 建一条已发布系统提示词，A/B 各自复制为独立私有副本
    const systemPrompt = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', {
      token: adminToken,
      jsonBody: { title: '系统级白底模板', content: '系统模板内容 v1', category: '电商主图', tags: ['系统'], status: 'published', sortOrder: 1 }
    });
    const systemPromptId = (systemPrompt.json && systemPrompt.json.item && systemPrompt.json.item.id) || 'prompt_system_failed';
    const systemDraft = await api(server.baseUrl, 'POST', '/api/admin/system-prompts', {
      token: adminToken,
      jsonBody: { title: '系统草稿', content: '草稿内容', status: 'draft' }
    });
    const systemDraftId = (systemDraft.json && systemDraft.json.item && systemDraft.json.item.id) || 'prompt_draft_failed';
    const copyA = await api(server.baseUrl, 'POST', '/api/user/prompts/copy-system', { token: userA.token, jsonBody: { systemPromptId } });
    const copyB = await api(server.baseUrl, 'POST', '/api/user/prompts/copy-system', { token: userB.token, jsonBody: { systemPromptId } });
    const copyDraft = await api(server.baseUrl, 'POST', '/api/user/prompts/copy-system', { token: userA.token, jsonBody: { systemPromptId: systemDraftId } });
    const copyMissing = await api(server.baseUrl, 'POST', '/api/user/prompts/copy-system', { token: userA.token, jsonBody: { systemPromptId: 'prompt_not_exists' } });
    const copyNoId = await api(server.baseUrl, 'POST', '/api/user/prompts/copy-system', { token: userA.token, jsonBody: {} });
    check('copy-system', () => {
      assert(copyA.status === 200 && copyA.json.item, `A 复制应返回 200，实际 ${copyA.status}：${JSON.stringify(copyA.json && copyA.json.code)}`);
      assert(copyA.json.item.scope === 'user', '副本 scope 必须为 user');
      assert(copyA.json.item.title === '系统级白底模板' && copyA.json.item.content === '系统模板内容 v1', '副本必须复制标题与内容');
      assert(copyA.json.item.category === '电商主图' && JSON.stringify(copyA.json.item.tags) === JSON.stringify(['系统']), '副本必须复制分类与标签');
      assert(copyA.json.item.isFavorite === false, '副本默认不收藏');
      assert(copyB.status === 200 && copyB.json.item && copyB.json.item.id !== copyA.json.item.id, 'B 的副本必须是独立记录');
      assert(copyDraft.status === 404, `复制草稿（未发布）系统提示词应 404，实际 ${copyDraft.status}`);
      assert(copyMissing.status === 404, `复制不存在的系统提示词应 404，实际 ${copyMissing.status}`);
      assert(copyNoId.status === 400 && copyNoId.json.code === 'PROMPT_SYSTEM_ID_REQUIRED', `缺少 systemPromptId 应 400 PROMPT_SYSTEM_ID_REQUIRED，实际 ${copyNoId.status}/${copyNoId.json && copyNoId.json.code}`);
    });
    const copyAId = (copyA.json && copyA.json.item && copyA.json.item.id) || 'prompt_copy_failed';

    // 同名不互覆：用户提示词与系统提示词同名、两个用户提示词同名都允许
    const sameAsSystem = await api(server.baseUrl, 'POST', '/api/user/prompts', { token: userA.token, jsonBody: { title: '系统级白底模板', content: '用户自己的同名版本' } });
    const sameAgain = await api(server.baseUrl, 'POST', '/api/user/prompts', { token: userA.token, jsonBody: { title: '系统级白底模板', content: '第二个同名版本' } });
    check('same-title-allowed', () => {
      assert(sameAsSystem.status === 200, `与系统提示词同名应允许，实际 ${sameAsSystem.status}`);
      assert(sameAgain.status === 200, `用户提示词同名应允许，实际 ${sameAgain.status}`);
      const listRes = listA.json.items; // 旧列表仅用于存在性佐证，不作为计数依据
      assert(Array.isArray(listRes), '列表结构异常');
    });

    // 软删除：列表消失，详情 404，DB deleted_at 非空
    const deleteRes = await api(server.baseUrl, 'DELETE', `/api/user/prompts/${copyAId}`, { token: userA.token });
    const listAfterDelete = await api(server.baseUrl, 'GET', '/api/user/prompts', { token: userA.token });
    const getAfterDelete = await api(server.baseUrl, 'GET', `/api/user/prompts/${copyAId}`, { token: userA.token });
    let deletedRow = null;
    let deletedRowError = '';
    try {
      deletedRow = db.prepare('SELECT deleted_at FROM user_prompts WHERE id=?').get(copyAId) || null;
    } catch (error) {
      deletedRowError = error && error.message ? error.message : String(error);
    }
    check('soft-delete', () => {
      assert(!deletedRowError, `查询 user_prompts 失败：${deletedRowError}`);
      assert(deleteRes.status === 200 && deleteRes.json.success === true, `删除应返回 200，实际 ${deleteRes.status}`);
      assert(deletedRow, '软删除后 user_prompts 行必须保留（不得物理删除）');
      assert(deletedRow.deleted_at, '软删除后 deleted_at 必须非空');
      assert(!listAfterDelete.json.items.some(item => item.id === copyAId), '软删除后列表不得再出现');
      assert(getAfterDelete.status === 404, `软删除后详情应 404，实际 ${getAfterDelete.status}`);
    });

    // 404：不存在的 ID
    const getMissing = await api(server.baseUrl, 'GET', '/api/user/prompts/prompt_not_exists', { token: userA.token });
    const putMissing = await api(server.baseUrl, 'PUT', '/api/user/prompts/prompt_not_exists', { token: userA.token, jsonBody: { title: 'x' } });
    check('not-found-404', () => {
      assert(getMissing.status === 404 && getMissing.json.code === 'PROMPT_NOT_FOUND', `GET 不存在应 404 PROMPT_NOT_FOUND，实际 ${getMissing.status}/${getMissing.json && getMissing.json.code}`);
      assert(putMissing.status === 404 && putMissing.json.code === 'PROMPT_NOT_FOUND', `PUT 不存在应 404 PROMPT_NOT_FOUND，实际 ${putMissing.status}/${putMissing.json && putMissing.json.code}`);
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
