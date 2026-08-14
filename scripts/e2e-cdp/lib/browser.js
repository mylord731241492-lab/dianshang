// CDP 工具：共享启动 + 命令式执行，供多步流程复用
const { spawn } = require('child_process');

const CHROME = process.env.E2E_CHROME || `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1223/chrome-win64/chrome.exe`;
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const DIR = process.env.E2E_WORK_DIR || require('path').join(__dirname, '..', '..', '..', '.scratch');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function start(port, profile) {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test01', password: 'test123456' }) });
  const token = (await res.json()).token;
  const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', `--remote-debugging-port=${port}`, '--no-first-run', `--user-data-dir=${DIR}/${profile}`, '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
  let targets = null;
  for (let i = 0; i < 30; i += 1) { await sleep(500); try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (targets.length) break; } catch {} }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res2, rej) => { ws.onopen = res2; ws.onerror = rej; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (event) => { const m = JSON.parse(event.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result))); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
  const shot = async (name) => { const fs = require('fs'); const d = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${DIR}/${name}`, Buffer.from(d.data, 'base64')); };

  await send('Page.enable');
  await send('Page.navigate', { url: `${BASE}/login` });
  await sleep(2500);
  await evaluate(`window.localStorage.setItem('auth_token', ${JSON.stringify(token)}); 'ok'`);
  return { chrome, ws, send, evaluate, shot, sleep };
}

module.exports = { start, sleep };
