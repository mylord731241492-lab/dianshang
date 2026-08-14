// CDP：首页移除提示词案例模块后的截图验收。
const { spawn } = require('child_process');
const fs = require('fs');

const CHROME = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1223/chrome-win64/chrome.exe`;
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const DIR = (process.env.E2E_WORK_DIR || require('path').join(__dirname, '..', '..', '..', '.scratch'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test01', password: 'test123456' }) });
  const token = (await res.json()).token;
  const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9226', '--no-first-run', `--user-data-dir=${DIR}/chrome-cdp-profile6`, '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
  process.on('exit', () => { try { chrome.kill(); } catch {} });
  let targets = null;
  for (let i = 0; i < 30; i += 1) { await sleep(500); try { targets = await (await fetch('http://127.0.0.1:9226/json/list')).json(); if (targets.length) break; } catch {} }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (event) => { const m = JSON.parse(event.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result))); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

  await send('Page.enable');
  await send('Page.navigate', { url: `${BASE}/login` });
  await sleep(2500);
  await evaluate(`window.localStorage.setItem('auth_token', ${JSON.stringify(token)}); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(5000);

  const check = await evaluate(`({
    hasExamples: !!document.querySelector('.examples-section'),
    examplesText: (document.body.textContent || '').includes('提示词案例'),
    hasHistory: !!document.querySelector('.history-carousel'),
    hasCreate: !!document.querySelector('.create-card'),
    projectCards: document.querySelectorAll('.history-card').length
  })`);
  console.log(JSON.stringify(check));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${DIR}/home-no-examples.png`, Buffer.from(shot.data, 'base64'));
  ws.close();
  chrome.kill();
  const ok = !check.hasExamples && !check.examplesText && check.hasHistory && check.hasCreate;
  console.log(ok ? 'REMOVE-EXAMPLES PASS' : 'REMOVE-EXAMPLES FAIL');
  if (!ok) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
