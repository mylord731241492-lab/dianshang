// Admin UI 截图：基线/验收两用
// 用法: node scripts/e2e-cdp/admin-ui-shots.cjs <prefix> [page1,page2,...]
const { start } = require('./lib/browser');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const ALL_PAGES = [
  ['dashboard', '/admin/dashboard'],
  ['users', '/admin/users'],
  ['recycle-bin', '/admin/recycle-bin'],
  ['orders', '/admin/orders'],
  ['logs', '/admin/logs'],
  ['generate-tasks', '/admin/generate-tasks'],
  ['redeem-codes', '/admin/redeem-codes'],
  ['api-providers', '/admin/api-providers'],
  ['model-prices', '/admin/model-prices'],
  ['template-workflows', '/admin/template-workflows'],
  ['system-prompts', '/admin/system-prompts'],
  ['settings', '/admin/settings']
];

(async () => {
  const prefix = process.argv[2] || 'admin-ui';
  const only = process.argv[3] ? process.argv[3].split(',') : null;
  const pages = only ? ALL_PAGES.filter(([n]) => only.includes(n)) : ALL_PAGES;

  const res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const { token } = await res.json();
  if (!token) throw new Error('admin login failed');

  const { chrome, send, evaluate, shot, sleep } = await start(9477, `e2e-admin-ui-${prefix}`);
  try {
    await send('Page.navigate', { url: `${BASE}/admin/login` });
    await sleep(2500);
    await evaluate(`window.localStorage.setItem('admin_auth_token', ${JSON.stringify(token)}); 'ok'`);

    const failures = [];
    for (const [name, path] of pages) {
      await send('Page.navigate', { url: `${BASE}${path}` });
      await sleep(3500);
      const text = await evaluate(`(document.body.innerText || '').slice(0, 4000)`);
      const broken = /加载失败|Load failed|Failed to load/i.test(text || '');
      await shot(`${prefix}-${name}.png`);
      console.log(`${broken ? 'FAIL' : 'OK  '} ${name} ${path}${broken ? '  <- 页面出现"加载失败"' : ''}`);
      if (broken) failures.push(name);
    }
    if (failures.length) {
      console.error(`PAGES_WITH_LOAD_FAILURE: ${failures.join(',')}`);
      process.exitCode = 2;
    }
  } finally {
    chrome.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });
