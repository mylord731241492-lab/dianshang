// CDP：验收新版卡片式用户中心（首页 Vue 抽屉 + 画布内 React 弹窗）。
// 校验：区块齐全、选线路生效、截图落 .scratch/。
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
  const chrome = spawn(CHROME, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9224', '--no-first-run', `--user-data-dir=${DIR}/chrome-cdp-profile4`, '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' });
  process.on('exit', () => { try { chrome.kill(); } catch {} });

  let targets = null;
  for (let i = 0; i < 30; i += 1) { await sleep(500); try { targets = await (await fetch('http://127.0.0.1:9224/json/list')).json(); if (targets.length) break; } catch {} }
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
  const shot = async (name) => {
    const data = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${DIR}/${name}`, Buffer.from(data.data, 'base64'));
    console.log('screenshot:', name);
  };

  await send('Page.enable');
  await send('Page.navigate', { url: `${BASE}/login` });
  await sleep(2500);
  await evaluate(`window.localStorage.setItem('auth_token', ${JSON.stringify(token)}); 'ok'`);

  // ========== 1. 首页抽屉 ==========
  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(5000);
  const clickedHome = await evaluate(`(() => {
    const btn = document.querySelector('.header-icon-button.user') || document.querySelector('[title="用户中心"]');
    if (!btn) return 'no-button';
    btn.click();
    return 'clicked';
  })()`);
  console.log('home user button:', clickedHome);
  await sleep(3000);

  const homeDrawer = await evaluate(`(() => {
    const el = document.querySelector('.uc-drawer');
    if (!el) return { open: false };
    const need = ['用户中心', '升级', '头像设置', '随机头像', '预设头像', '算力余额', '算力明细', '兑换码', '立即兑换', 'API 线路', '当前线路', '模型', '安全说明', '界面语言', '退出登录'];
    return {
      open: true,
      missing: need.filter((t) => !el.textContent.includes(t) && !el.querySelector('[title="' + t + '"]')),
      routeRows: el.querySelectorAll('.uc-route-row').length,
      routeTag: (el.querySelector('.uc-route-tag') || {}).textContent || '',
      current: (el.querySelector('.uc-route-current') || {}).textContent || ''
    };
  })()`);
  console.log('home drawer:', JSON.stringify(homeDrawer));

  // 点一条非当前线路验证选线
  const homeSelect = await evaluate(`(() => {
    const rows = [...document.querySelectorAll('.uc-drawer .uc-route-row:not(.active)')];
    if (!rows.length) return 'no-other-route';
    rows[0].click();
    return 'clicked:' + rows[0].textContent.slice(0, 30);
  })()`);
  console.log('home select route:', homeSelect);
  await sleep(2500);
  const homeAfter = await evaluate(`(() => {
    const el = document.querySelector('.uc-drawer');
    return { current: (el.querySelector('.uc-route-current') || {}).textContent || '', notice: (el.querySelector('.uc-notice') || {}).textContent || '' };
  })()`);
  console.log('home after select:', JSON.stringify(homeAfter));

  // 展开算力明细后截图
  await evaluate(`(() => { const b = [...document.querySelectorAll('.uc-drawer .uc-expand')][0]; if (b) b.click(); return 'ok'; })()`);
  await sleep(800);
  await shot('uc-home-drawer.png');
  await evaluate(`(() => { const b = document.querySelector('.uc-drawer .uc-close'); if (b) b.click(); return 'ok'; })()`);
  await sleep(1000);

  // ========== 2. 画布内弹窗 ==========
  await send('Page.navigate', { url: `${BASE}/canvas/${PROJECT_ID}` });
  await sleep(8000);
  const clickedCanvas = await evaluate(`(() => {
    const btn = document.querySelector('[aria-label="用户中心"]');
    if (!btn) return 'no-button';
    btn.click();
    return 'clicked';
  })()`);
  console.log('canvas user button:', clickedCanvas);
  await sleep(3000);

  const canvasDrawer = await evaluate(`(() => {
    const el = document.querySelector('.ant-drawer');
    if (!el) return { open: false };
    const need = ['用户中心', '升级', '头像设置', '预设头像', '算力余额', '算力明细', '兑换码', '立即兑换', 'API 线路', '当前线路', '模型', '安全说明', '界面语言', '退出登录'];
    return { open: true, missing: need.filter((t) => !el.textContent.includes(t)) };
  })()`);
  console.log('canvas drawer:', JSON.stringify(canvasDrawer));
  await shot('uc-canvas-drawer.png');

  ws.close();
  chrome.kill();
  const ok = homeDrawer.open && homeDrawer.missing.length === 0 && canvasDrawer.open && canvasDrawer.missing.length === 0;
  console.log(ok ? 'VERIFY PASS' : 'VERIFY FAIL');
  if (!ok) process.exit(2);
}

main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
