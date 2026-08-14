const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
// 验收：工具栏自定义账号绑定（保存→清本地→重载→服务端恢复）
const { start } = require('../lib/browser');
const path = require('path');
const DB = (process.env.E2E_DB_PATH || require('path').join(__dirname, '..', '..', '..', '.scratch', 'infinite-canvas-local', 'data', 'data.db'));

async function main() {
  const { chrome, ws, send, evaluate, sleep } = await start(9243, 'chrome-cdp-e2e');
  await send('Page.navigate', { url: `${BASE}/canvas/${process.argv[2] || 'proj_mscjyl35965edc3d'}` });
  await sleep(9000);

  // 直接调 API 保存一个自定义配置（模拟用户保存：只留 info/delete/download，关标签文字）
  const saved = await evaluate(`(async () => {
    const token = window.localStorage.getItem('auth_token');
    const res = await fetch('/api/user/ui-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ 'canvas-image-quick-tools-v6': { ids: ['info', 'delete', 'download'], showLabels: false } })
    });
    return res.status;
  })()`);
  console.log('PUT prefs:', saved);

  // 查库确认写入
  const Database = require(path.join('F:/dianshang-worktrees/infinite-canvas-candidate', 'node_modules', 'better-sqlite3'));
  const db = new Database(DB, { readonly: true });
  const row = db.prepare("SELECT value FROM app_state WHERE key LIKE 'user.uiPreferences.%'").get();
  db.close();
  console.log('db value:', row ? row.value.slice(0, 120) : 'NONE');

  // 清本地缓存，重载页面，hover 图片节点看工具栏是否只剩 3 个按钮
  await evaluate(`window.localStorage.removeItem('canvas-image-quick-tools-v6'); 'cleared'`);
  await send('Page.navigate', { url: `${BASE}/canvas/${process.argv[2] || 'proj_mscjyl35965edc3d'}` });
  await sleep(9000);

  // 重载后挂载 effect 会把服务端配置写回 localStorage——直接断言
  const restored = await evaluate(`window.localStorage.getItem('canvas-image-quick-tools-v6')`);
  console.log('restored localStorage:', restored);

  ws.close();
  chrome.kill();
  const ok = saved === 200 && row && row.value.includes('canvas-image-quick-tools-v6')
    && restored && restored.includes('"showLabels":false') && restored.includes('download') && !restored.includes('crop');
  console.log(ok ? 'UI-PREFS PASS' : 'UI-PREFS FAIL');
  if (!ok) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
