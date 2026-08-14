// CDP：验收生图节点右键菜单「复制当前图片」（修正触发目标为 .node-element）。
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
  const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9229', '--no-first-run', `--user-data-dir=${DIR}/chrome-cdp-profile9`, '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
  process.on('exit', () => { try { chrome.kill(); } catch {} });
  let targets = null;
  for (let i = 0; i < 30; i += 1) { await sleep(500); try { targets = await (await fetch('http://127.0.0.1:9229/json/list')).json(); if (targets.length) break; } catch {} }
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

  // 选择视口内含有结果图的节点，返回中心点
  const rect = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll('.node-element')].filter((el) => el.querySelector('[data-drawing-node-preview] img'));
    if (!nodes.length) return null;
    const visible = nodes.find((el) => { const r = el.getBoundingClientRect(); return r.left > 100 && r.top > 60 && r.right < 1560 && r.bottom < 960; }) || nodes[0];
    const r = visible.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, count: nodes.length };
  })()`);
  console.log('node rect:', JSON.stringify(rect));
  if (!rect) { console.log('NO IMAGE NODE'); process.exit(2); }

  // 直接对节点元素派发 contextmenu，绕过侧栏/Agent 面板遮挡的命中测试
  await evaluate(`(() => {
    const nodes = [...document.querySelectorAll('.node-element')].filter((el) => el.querySelector('[data-drawing-node-preview] img'));
    const el = nodes[nodes.length - 1];
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
    return 'dispatched';
  })()`);
  await sleep(1200);

  const menu = await evaluate(`(() => {
    const found = [...document.querySelectorAll('button')].filter((b) => ['复制', '复制当前图片', '删除'].includes(b.textContent.trim())).map((b) => b.textContent.trim());
    return { found };
  })()`);
  console.log('menu:', JSON.stringify(menu));

  const clickResult = await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '复制当前图片');
    if (!btn) return 'no-button';
    btn.click();
    return 'clicked';
  })()`);
  console.log('click:', clickResult);
  await sleep(3000);
  const toast = await evaluate(`(document.querySelector('.ant-message') || {}).textContent || ''`);
  console.log('toast:', toast);

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${DIR}/canvas-copy-image.png`, Buffer.from(shot.data, 'base64'));
  ws.close();
  chrome.kill();
  const ok = menu.found && menu.found.includes('复制当前图片') && clickResult === 'clicked' && /已复制当前图片|已改为下载|复制图片失败/.test(toast);
  console.log(ok ? 'COPY-IMAGE PASS' : 'COPY-IMAGE FAIL');
  if (!ok) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
