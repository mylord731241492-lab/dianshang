// CDP 验收：真实浏览器里验证 Agent 面板 @ 引用弹层。
// 流程：起 headless Chrome → 注入 auth_token → 打开画布项目 → 打开 AI 助手 → 输入 @ → 断言弹层 + 截图。
// 依赖：Node 24 全局 WebSocket/fetch；本机 ms-playwright Chromium。

const { spawn } = require('child_process');
const fs = require('fs');

const CHROME = `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1223/chrome-win64/chrome.exe`;
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const PROJECT_ID = process.argv[2] || 'proj_ms8n67xff4c1d201';
const SHOT = process.argv[3] || 'F:/dianshang-worktrees/infinite-canvas-candidate/.scratch/cdp-mention.png';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getToken() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test01', password: 'test123456' })
  });
  return (await res.json()).token;
}

async function main() {
  const token = await getToken();
  const chrome = spawn(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--remote-debugging-port=9223', '--no-first-run',
    '--user-data-dir=F:/dianshang-worktrees/infinite-canvas-candidate/.scratch/chrome-cdp-profile',
    '--window-size=1600,1000', 'about:blank'
  ], { stdio: 'ignore' });
  process.on('exit', () => { try { chrome.kill(); } catch {} });

  let targets = null;
  for (let i = 0; i < 30; i += 1) {
    await sleep(500);
    try {
      targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
      if (targets.length) break;
    } catch {}
  }
  if (!targets?.length) throw new Error('CDP target 不可用');
  const page = targets.find((item) => item.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

  let seq = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    } else if (message.method) {
      events.push(message.method);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (message) => (message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

  await send('Page.enable');
  await send('Page.navigate', { url: `${BASE}/login` });
  await sleep(2500);
  await evaluate(`window.localStorage.setItem('auth_token', ${JSON.stringify(token)}); 'token-set'`);
  await send('Page.navigate', { url: `${BASE}/canvas/${PROJECT_ID}` });
  await sleep(5000);

  // 打开 AI 助手面板
  const clicked = await evaluate(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((item) => (item.textContent || '').includes('AI 助手'));
    if (button) { button.click(); return true; }
    return false;
  })()`);
  console.log('agent button clicked:', clicked);
  await sleep(2500);

  // 通过文件输入注入一张附件图（模拟粘贴/拖拽上传）
  await send('DOM.enable');
  await send('DOM.enable');
  const doc = await send('DOM.getDocument');
  const agentFileInputId = await evaluate(`(() => {
    const textarea = Array.from(document.querySelectorAll('textarea')).find((item) => (item.placeholder || '').includes('@ 可引用'));
    if (!textarea) return 0;
    const panel = textarea.closest('div.flex.min-h-0.flex-1.flex-col') || textarea.parentElement;
    const input = panel ? panel.querySelector('input[type="file"]') : null;
    if (!input) return 0;
    input.setAttribute('data-cdp-file-input', '1');
    return 1;
  })()`);
  if (agentFileInputId) {
    const fileInput = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[data-cdp-file-input="1"]' });
    await send('DOM.setFileInputFiles', { nodeId: fileInput.nodeId, files: ['F:/dianshang-worktrees/infinite-canvas-candidate/.scratch/real-verify.png'] });
    console.log('attachment injected, uploading...');
    await sleep(4000);
    const thumbs = await evaluate(`(() => {
      const textarea = Array.from(document.querySelectorAll('textarea')).find((item) => (item.placeholder || '').includes('@ 可引用'));
      const panel = textarea.closest('div.flex.min-h-0.flex-1.flex-col') || textarea.parentElement;
      return panel ? panel.querySelectorAll('img').length : -1;
    })()`);
    console.log('attachment thumbnails:', thumbs);
  } else {
    console.log('agent file input not found');
  }

  // 在 Agent 输入框输入 @
  const typed = await evaluate(`(() => {
    const textarea = Array.from(document.querySelectorAll('textarea')).find((item) => (item.placeholder || '').includes('@ 可引用'));
    if (!textarea) return 'textarea-not-found';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    textarea.focus();
    setter.call(textarea, '@');
    textarea.setSelectionRange(1, 1);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
  })()`);
  console.log('type @:', typed);
  await sleep(1200);

  const menuInfo = await evaluate(`(() => {
    const menu = document.querySelector('[data-canvas-resource-mention-menu="true"]');
    if (!menu) return { found: false };
    return { found: true, text: (menu.textContent || '').slice(0, 200), items: menu.querySelectorAll('button').length };
  })()`);
  console.log('mention menu:', JSON.stringify(menuInfo));

  // 尝试点击画布上的一个节点使其选中，再输入 @ 验证"只显示已框选"
  await evaluate(`(() => {
    const tabs = Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').trim() === '画布');
    if (tabs.length) tabs[0].click();
    return 'tab';
  })()`);
  await sleep(600);
  const clickedNode = await evaluate(`(() => {
    const rows = Array.from(document.querySelectorAll('button')).filter((b) => (b.textContent || '').includes('图片节点') || (b.textContent || '').includes('洗衣液'));
    const el = rows[0];
    if (!el) return 'no-row';
    el.click();
    return 'clicked';
  })()`);
  console.log('node click:', clickedNode);
  await sleep(1000);
  await evaluate(`(() => {
    const textarea = Array.from(document.querySelectorAll('textarea')).find((item) => (item.placeholder || '').includes('@ 可引用'));
    if (!textarea) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    textarea.focus();
    setter.call(textarea, '@');
    textarea.setSelectionRange(1, 1);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await sleep(800);
  const menuAfterSelect = await evaluate(`(() => {
    const menu = document.querySelector('[data-canvas-resource-mention-menu="true"]');
    return menu ? (menu.textContent || '').slice(0, 200) : 'no-menu';
  })()`);
  console.log('menu after select:', menuAfterSelect);

  // 选中第一个候选并发送，验证消息气泡里出现引用缩略图
  const picked = await evaluate(`(() => {
    const menu = document.querySelector('[data-canvas-resource-mention-menu="true"]');
    const item = menu?.querySelector('button');
    if (!item) return 'no-item';
    item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return 'picked';
  })()`);
  console.log('pick mention:', picked);
  await sleep(800);
  const shotBefore = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(SHOT.replace('.png', '-before-send.png'), Buffer.from(shotBefore.data, 'base64'));
  console.log('before-send screenshot saved');
  const chipInfo = await evaluate(`(() => {
    const chip = Array.from(document.querySelectorAll('span')).find((el) => (el.textContent || '').trim() === '图片1' && el.querySelector);
    const overlay = Array.from(document.querySelectorAll('div')).find((el) => (el.textContent || '').includes('图片1') && el.querySelector('textarea') === null && el.className.includes('absolute'));
    const anyImg = Array.from(document.querySelectorAll('img')).filter((img) => (img.src || '').includes('asset-content')).map((img) => img.src.slice(0, 60));
    return { chipHtml: chip ? chip.outerHTML.slice(0, 240) : 'no-chip', assetImgs: anyImg.length };
  })()`);
  console.log('chip debug:', JSON.stringify(chipInfo));
  await sleep(400);
  await evaluate(`(() => {
    const textarea = Array.from(document.querySelectorAll('textarea')).find((item) => (item.placeholder || '').includes('@ 可引用'));
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    const next = textarea.value + ' 测试缩略图';
    setter.call(textarea, next);
    textarea.setSelectionRange(next.length, next.length);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    const send = Array.from(document.querySelectorAll('button')).find((b) => (b.getAttribute('aria-label') || '').includes('发送'));
    if (send) send.click();
  })()`);
  console.log('sent, waiting for message...');
  await sleep(6000);
  const bubble = await evaluate(`(() => {
    const imgs = Array.from(document.querySelectorAll('img')).filter((img) => (img.alt || '').includes('real-verify') || (img.src || '').includes('asset-content'));
    return { thumbCount: imgs.length, sample: imgs[0] ? imgs[0].src.slice(0, 80) : '' };
  })()`);
  console.log('bubble thumbnails:', JSON.stringify(bubble));

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
  console.log('screenshot:', SHOT);

  // 控制台错误
  const errors = await evaluate(`(window.__errors || []).length`);
  ws.close();
  chrome.kill();
  if (!menuInfo.found) process.exit(2);
}

main().catch((error) => { console.error('FAIL:', error.message); process.exit(1); });
