// CDP：验收上线前修复——SPA 白名单直开路由、画布可达、用户中心抽屉、legacy 链接同源。
const { spawn } = require('child_process');
const fs = require('fs');

const CHROME = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1223/chrome-win64/chrome.exe`;
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const PROJECT_ID = process.argv[2] || 'proj_mscjyl35965edc3d';
const DIR = (process.env.E2E_WORK_DIR || require('path').join(__dirname, '..', '..', '..', '.scratch'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getToken() {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test01', password: 'test123456' }) });
  return (await res.json()).token;
}

async function main() {
  const token = await getToken();
  const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9225', '--no-first-run', `--user-data-dir=${DIR}/chrome-cdp-profile5`, '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
  process.on('exit', () => { try { chrome.kill(); } catch {} });

  let targets = null;
  for (let i = 0; i < 30; i += 1) { await sleep(500); try { targets = await (await fetch('http://127.0.0.1:9225/json/list')).json(); if (targets.length) break; } catch {} }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

  await send('Page.enable');
  const results = {};

  // 1. SPA 白名单：直开 /user/records（不登录也应拿到 Vue SPA，而不是旧版 index.html）
  await send('Page.navigate', { url: `${BASE}/user/records` });
  await sleep(3500);
  results.userRecords = await evaluate(`({
    title: document.title,
    isVue: !!document.querySelector('#app'),
    text: (document.body && document.body.textContent || '').slice(0, 60)
  })`);

  // 2. 登录态后直开 /template-image
  await evaluate(`window.localStorage.setItem('auth_token', ${JSON.stringify(token)}); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/template-image` });
  await sleep(3500);
  results.templateImage = await evaluate(`({ isVue: !!document.querySelector('#app'), hasLegacy: !!document.querySelector('canvas') })`);

  // 3. 画布可达
  await send('Page.navigate', { url: `${BASE}/canvas/${PROJECT_ID}` });
  await sleep(8000);
  results.canvas = await evaluate(`({
    topBar: !!document.querySelector('[aria-label="用户中心"]'),
    legacyMarker: document.body && document.body.textContent.includes('正在打开画布')
  })`);

  // 4. 用户中心抽屉在修复后仍工作 + 选线
  await evaluate(`(() => { const b = document.querySelector('[aria-label="用户中心"]'); if (b) b.click(); return 1; })()`);
  await sleep(3000);
  results.drawer = await evaluate(`(() => {
    const el = document.querySelector('.ant-drawer');
    if (!el) return { open: false };
    return { open: true, hasRoute: el.textContent.includes('当前线路'), hasRedeem: el.textContent.includes('兑换码') };
  })()`);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${DIR}/uc-predeploy-check.png`, Buffer.from(shot.data, 'base64'));

  console.log(JSON.stringify(results, null, 2));
  ws.close();
  chrome.kill();
  const ok = results.userRecords?.isVue && results.templateImage?.isVue && results.canvas?.topBar && !results.canvas?.legacyMarker && results.drawer?.open && results.drawer?.hasRoute;
  console.log(ok ? 'PREDEPLOY PASS' : 'PREDEPLOY FAIL');
  if (!ok) process.exit(2);
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
