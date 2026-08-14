// CDP：验收结果图单击选中（供下游继续生图）+ 双击放大原图。
const { spawn } = require('child_process');
const fs = require('fs');

const CHROME = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1223/chrome-win64/chrome.exe`;
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const PROJECT_ID = process.argv[2] || 'proj_mscjyl35965edc3d';
const DIR = (process.env.E2E_WORK_DIR || require('path').join(__dirname, '..', '..', '..', '.scratch'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test01', password: 'test123456' }) });
  const token = (await res.json()).token;
  const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9230', '--no-first-run', `--user-data-dir=${DIR}/chrome-cdp-profile10`, '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
  process.on('exit', () => { try { chrome.kill(); } catch {} });
  let targets = null;
  for (let i = 0; i < 30; i += 1) { await sleep(500); try { targets = await (await fetch('http://127.0.0.1:9230/json/list')).json(); if (targets.length) break; } catch {} }
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
  await send('Page.navigate', { url: `${BASE}/canvas/${PROJECT_ID}` });
  await sleep(8000);

  // 1) 单击 tile → 选中态（cyan 边框），即下游生图读取的那张
  const clickResult = await evaluate(`(() => {
    const tile = document.querySelector('[data-drawing-node-preview] button');
    if (!tile) return 'no-tile';
    tile.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 500, clientY: 400 }));
    tile.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 500, clientY: 400 }));
    return tile.className.includes('border-cyan-400') ? 'selected' : 'not-selected';
  })()`);
  console.log('single click select:', clickResult);
  await sleep(800);

  // 2) 双击 → antd 原图预览打开
  const dblResult = await evaluate(`(() => {
    const tile = document.querySelector('[data-drawing-node-preview] button');
    if (!tile) return 'no-tile';
    tile.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: 500, clientY: 400 }));
    return 'dispatched';
  })()`);
  console.log('dblclick:', dblResult);
  await sleep(2000);
  const preview = await evaluate(`(() => {
    const mask = document.querySelector('.ant-image-preview');
    const img = document.querySelector('.ant-image-preview-img');
    return { open: !!mask, hasImg: !!img, src: img ? String(img.src).slice(0, 60) : '' };
  })()`);
  console.log('preview:', JSON.stringify(preview));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${DIR}/canvas-dblclick-preview.png`, Buffer.from(shot.data, 'base64'));

  // 关闭预览
  await evaluate(`(() => { const b = document.querySelector('.ant-image-preview-close'); if (b) b.click(); return 'closed'; })()`);

  ws.close();
  chrome.kill();
  const ok = clickResult === 'selected' && preview.open && preview.hasImg;
  console.log(ok ? 'PREVIEW PASS' : 'PREVIEW FAIL');
  if (!ok) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
