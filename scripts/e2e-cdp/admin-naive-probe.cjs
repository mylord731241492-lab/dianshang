// 探测 admin 页面 naive 组件当前实际渲染（computed style）
const { start } = require('./lib/browser');
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
(async () => {
  const res = await fetch(`${BASE}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin123' }) });
  const { token } = await res.json();
  const { chrome, send, evaluate, sleep } = await start(9478, 'e2e-admin-probe');
  try {
    await send('Page.navigate', { url: `${BASE}/admin/login` });
    await sleep(2000);
    await evaluate(`window.localStorage.setItem('admin_auth_token', ${JSON.stringify(token)}); 'ok'`);
    await send('Page.navigate', { url: `${BASE}/admin/users` });
    await sleep(3500);
    const out = await evaluate(`(() => {
      const pick = (sel) => { const el = document.querySelector(sel); if (!el) return null;
        const cs = getComputedStyle(el); return { bg: cs.backgroundColor, color: cs.color, border: cs.borderColor, radius: cs.borderRadius }; };
      return {
        primaryBtn: pick('.n-button--primary-type'),
        anyBtn: pick('.n-button'),
        tag: pick('.n-tag'),
        input: pick('.n-input'),
        inputWrapper: pick('.n-input .n-input-wrapper'),
        pagination: pick('.n-pagination .n-pagination-item'),
        select: pick('.n-base-selection'),
        switch: pick('.n-switch'),
        provider: document.documentElement.getAttribute('data-theme'),
        htmlBg: getComputedStyle(document.body).backgroundColor
      };
    })()`);
    console.log(JSON.stringify(out, null, 2));
  } finally { chrome.kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
