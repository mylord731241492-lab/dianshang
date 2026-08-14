// CDP：打开含生图节点的项目，尝试拖拽生图节点，检查是否移动及报错。
const { spawn } = require('child_process');
const fs = require('fs');

const CHROME = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1223/chrome-win64/chrome.exe`;
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const PROJECT_ID = process.argv[2] || 'proj_mscjyl35965edc3d';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getToken() {
  const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'test01', password: 'test123456' }) });
  return (await res.json()).token;
}

async function main() {
  const token = await getToken();
  const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9223', '--no-first-run', '--user-data-dir=F:/dianshang-worktrees/infinite-canvas-candidate/.scratch/chrome-cdp-profile2', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
  process.on('exit', () => { try { chrome.kill(); } catch {} });

  let targets = null;
  for (let i = 0; i < 30; i += 1) { await sleep(500); try { targets = await (await fetch('http://127.0.0.1:9223/json/list')).json(); if (targets.length) break; } catch {} }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.onmessage = (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails?.text || 'exception');
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: `${BASE}/login` });
  await sleep(2500);
  await evaluate(`window.localStorage.setItem('auth_token', ${JSON.stringify(token)}); 'ok'`);
  await send('Page.navigate', { url: `${BASE}/canvas/${PROJECT_ID}` });
  await sleep(6000);

  // 找到生图节点（config）的 DOM 与初始位置
  const info = await evaluate(`(() => {
    const els = Array.from(document.querySelectorAll('[data-node-id]'));
    const states = window.__canvasDebug || null;
    return els.map((el) => ({ id: el.getAttribute('data-node-id'), rect: (() => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })() }));
  })()`);
  console.log('nodes on canvas:', JSON.stringify(info));

  if (!info || !info.length) {
    // 备选：通过类名找
    const alt = await evaluate(`Array.from(document.querySelectorAll('div')).filter((d) => (d.className || '').toString().includes('canvas-node')).length`);
    console.log('canvas-node class count:', alt);
  }

  // 先折叠 Agent 面板再拖
  await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').includes('AI 助手'));
    if (btn) btn.click();
    return 'panel-toggled';
  })()`);
  await sleep(1500);
  const info2 = await evaluate(`(() => Array.from(document.querySelectorAll('[data-node-id]')).map((el) => { const r = el.getBoundingClientRect(); return { id: el.getAttribute('data-node-id'), rect: { x: r.x, y: r.y, w: r.width, h: r.height } }; }))()`);
  console.log('after panel close, nodes:', JSON.stringify((info2 || []).map((n) => ({ id: n.id.slice(0, 20), x: Math.round(n.rect.x) }))));

  // 命中检测：拖拽起始点落在什么元素上
  for (const target of info2 || []) {
    const cx0 = target.rect.x + target.rect.w / 2;
    const cy0 = target.rect.y + 40;
    const hit = await evaluate(`(() => {
      const el = document.elementFromPoint(${cx0}, ${cy0});
      if (!el) return 'none';
      const chain = [];
      let cur = el;
      for (let i = 0; i < 6 && cur; i += 1) { chain.push(cur.tagName + '.' + (cur.className || '').toString().slice(0, 60)); cur = cur.parentElement; }
      return chain.join(' < ');
    })()`);
    console.log('hit at drag point for', target.id.slice(0, 20), ':', hit);
  }

  // 给每个节点容器加探针：区分 capture 与 bubble 阶段
  await evaluate(`(() => {
    window.__mdLog = [];
    document.querySelectorAll('[data-node-id]').forEach((el) => {
      const inner = el.querySelector('.rounded-3xl.border-2') || el.firstElementChild;
      el.addEventListener('mousedown', () => window.__mdLog.push('capture:' + el.getAttribute('data-node-id')), true);
      if (inner) inner.addEventListener('mousedown', () => window.__mdLog.push('bubble:' + el.getAttribute('data-node-id')), false);
    });
    return 'probes';
  })()`);


  // 依次尝试拖拽图片节点和生图节点
  for (const target of info2 || []) {
    const cx = target.rect.x + target.rect.w / 2;
    const cy = target.rect.y + 40;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 });
    await sleep(200);
    for (let i = 1; i <= 10; i += 1) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + i * 20, y: cy + i * 10, button: 'left' });
      await sleep(60);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + 200, y: cy + 100, button: 'left', clickCount: 1 });
    await sleep(1200);
    const after = await evaluate(`(() => {
      const el = document.querySelector('[data-node-id="${target.id}"]');
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y };
    })()`);
    console.log('drag', target.id.slice(0, 24), ': from', JSON.stringify({ x: Math.round(target.rect.x), y: Math.round(target.rect.y) }), 'to', JSON.stringify({ x: Math.round(after.x), y: Math.round(after.y) }), 'moved:', Math.abs(after.x - target.rect.x) > 30);
  }

  const mdLog = await evaluate('window.__mdLog || []');
  console.log('mousedown reached nodes:', JSON.stringify(mdLog));
  console.log('console errors:', JSON.stringify(consoleErrors.slice(0, 5)));
  ws.close();
  chrome.kill();
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
