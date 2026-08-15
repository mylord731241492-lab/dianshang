// admin 后台页面走查：登录 → 用户/线路/兑换码/生成任务/设置 每页截图+断言渲染
const { start } = require('../lib/browser');

const PAGES = [
  { path: '/admin/dashboard', name: 'dashboard', must: [] },
  { path: '/admin/users', name: 'users', must: ['731241492'] },
  { path: '/admin/api-providers', name: 'api-providers', must: ['官转gpt-img2'] },
  { path: '/admin/redeem-codes', name: 'redeem-codes', must: [] },
  { path: '/admin/generate-tasks', name: 'generate-tasks', must: [] },
  { path: '/admin/settings', name: 'settings', must: [] },
];

async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9270, 'chrome-cdp-admin');
  // admin 登录（API 获取 token 注入，比表单自动化稳）
  await send('Page.navigate', { url: 'http://127.0.0.1:3468/admin/login' });
  await sleep(4000);
  const token = await (async () => {
    const res = await fetch('http://127.0.0.1:3468/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
    return (await res.json()).token;
  })();
  await evaluate(`window.localStorage.setItem('admin_auth_token', ${JSON.stringify(token)}); 'ok'`);
  const loggedIn = await evaluate(`!!window.localStorage.getItem('admin_auth_token')`);
  console.log('admin token injected:', loggedIn);

  const results = {};
  for (const p of PAGES) {
    await send('Page.navigate', { url: `http://127.0.0.1:3468${p.path}` });
    await sleep(3500);
    const check = await evaluate(`(() => {
      const text = document.body.textContent || '';
      const must = ${JSON.stringify(p.must)};
      return { ok: must.every((m) => text.includes(m)), len: text.length, hasError: text.includes('加载失败') || text.includes('404') };
    })()`);
    results[p.name] = check.ok && !check.hasError ? 'PASS' : `FAIL(${JSON.stringify(check).slice(0, 80)})`;
    console.log(p.name + ':', results[p.name]);
    await shot(`admin-${p.name}.png`);
  }

  console.log(JSON.stringify(results, null, 1));
  ws.close();
  chrome.kill();
  const allPass = Object.values(results).every((v) => v === 'PASS') && loggedIn;
  console.log(allPass ? 'ADMIN PAGES PASS' : 'ADMIN PAGES FAIL');
  if (!allPass) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
