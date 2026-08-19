// AI_COST: true — 会真实调用计费（2 张图）
// 单图化链式验证（全新项目）：A 生成 1 张 → 新建 B 连线 → B 生成 → 查库验证 B 的参考图来自 A。
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const { start } = require('../lib/browser');
const path = require('path');

const DB = process.env.E2E_DB_PATH || path.join(__dirname, '..', '..', '..', '.scratch', 'infinite-canvas-local', 'data', 'data.db');

async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9237, 'chrome-cdp-e2e');

  // ---- 0. 全新项目（避免旧项目节点太多导致虚拟化干扰）----
  const projectId = await evaluate(`(async () => {
    const token = window.localStorage.getItem('auth_token');
    const res = await fetch('/api/user/projects', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name: 'chain-e2e-' + Date.now(), data: { schema: 'hjm.infinite-canvas.project', schemaVersion: 1, engine: 'infinite-canvas', upstreamVersion: '0.10.0', project: { nodes: [], connections: [], chatSessions: [], activeChatId: null, backgroundMode: 'lines', showImageInfo: false, viewport: { x: 0, y: 0, k: 1 } } } }) });
    const data = await res.json();
    return (data.project && data.project.id) || data.id;
  })()`);
  console.log('fresh project:', projectId);
  await send('Page.navigate', { url: `${BASE}/canvas/${projectId}` });
  await sleep(9000);

  // ---- 1. 创建 A 并打标 ----
  await evaluate(`(() => { document.querySelector('button[aria-label="生图节点"]').click(); return 1; })()`);
  await sleep(3000);
  const tagA = await evaluate(`(() => {
    const nodes = [...document.querySelectorAll('.node-element')];
    if (!nodes.length) return null;
    nodes[nodes.length - 1].setAttribute('data-e2e', 'A');
    return 'tagged:' + nodes.length;
  })()`);
  console.log('tag A:', tagA);
  if (!tagA) { console.log('CHAIN FAIL: A not created'); process.exit(2); }

  // 写提示词并生成（单图化后默认 1 张）
  await evaluate(`(() => {
    const panel = document.querySelector('[data-drawing-generation-panel]');
    if (!panel) return 'no-panel';
    const editor = panel.querySelector('[contenteditable]');
    editor.focus();
    editor.textContent = '一只白色陶瓷咖啡杯，纯白底电商主图，柔和自然光，商业摄影质感';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return 'ok';
  })()`);
  await sleep(500);
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('[data-drawing-generation-panel] button')].find((b) => b.textContent.includes('开始生成'));
    if (btn) btn.click();
    return 1;
  })()`);
  console.log('A generating...');
  let aDone = false;
  for (let i = 0; i < 110; i += 1) {
    await sleep(5000);
    const st = await evaluate(`(() => {
      const a = document.querySelector('.node-element[data-e2e="A"]');
      if (!a) return 'A-gone';
      const imgs = a.querySelectorAll('[data-drawing-node-preview] img').length;
      if (a.textContent.includes('失败')) return 'failed';
      return 'imgs:' + imgs;
    })()`);
    if (i % 6 === 0) console.log('pollA', i, st);
    if (st === 'failed') break;
    if (String(st).startsWith('imgs:') && Number(st.slice(5)) >= 1) { aDone = true; break; }
  }
  console.log('A done:', aDone);
  await shot('chain-A-done.png');
  if (!aDone) { console.log('CHAIN FAIL: A not done'); process.exit(2); }

  // A 单图化断言
  const single = await evaluate(`(() => {
    const a = document.querySelector('.node-element[data-e2e="A"]');
    return { imgs: a.querySelectorAll('[data-drawing-node-preview] img').length, selected: a.textContent.includes('已选中'), counter: /\\d\\/\\d/.test(a.textContent) };
  })()`);
  console.log('single-image check:', JSON.stringify(single));
  if (single.imgs !== 1 || single.selected || single.counter) { console.log('CHAIN FAIL: A not single-image'); process.exit(2); }

  // ---- 2. 创建 B 并打标 ----
  await evaluate(`(() => { document.querySelector('button[aria-label="生图节点"]').click(); return 1; })()`);
  await sleep(3000);
  const tagB = await evaluate(`(() => {
    const candidates = [...document.querySelectorAll('.node-element')].filter((el) => !el.getAttribute('data-e2e'));
    if (!candidates.length) return null;
    const b = candidates[candidates.length - 1];
    b.setAttribute('data-e2e', 'B');
    return 'tagged';
  })()`);
  console.log('tag B:', tagB);
  if (!tagB) { console.log('CHAIN FAIL: B not created'); process.exit(2); }

  // ---- 3. JS 事件直连 A 右点 → B 体中心 ----
  const conn = await evaluate(`(() => {
    const a = document.querySelector('.node-element[data-e2e="A"]');
    const dot = a.querySelector('.-right-6');
    if (!dot) return 'no-dot';
    const dr = dot.getBoundingClientRect();
    const sx = dr.left + dr.width / 2, sy = dr.top + dr.height / 2;
    dot.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: sx, clientY: sy, button: 0, buttons: 1 }));
    const b = document.querySelector('.node-element[data-e2e="B"]');
    const br = b.getBoundingClientRect();
    const tx = br.left + br.width / 2, ty = br.top + br.height / 2;
    for (let i = 1; i <= 8; i += 1) {
      window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: sx + (tx - sx) * i / 8, clientY: sy + (ty - sy) * i / 8, buttons: 1 }));
    }
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: tx, clientY: ty, button: 0 }));
    return 'dispatched';
  })()`);
  console.log('connect:', conn);
  await sleep(1500);
  const chip = await evaluate(`(() => {
    const panel = document.querySelector('[data-drawing-generation-panel]');
    return panel ? (panel.textContent.match(/参考图\\s*\\d+\\s*张/) || ['?'])[0] : 'no-panel';
  })()`);
  console.log('B input chip:', chip);
  await shot('chain-connected.png');
  if (!chip.includes('1')) { console.log('CHAIN FAIL: connect'); process.exit(2); }

  // ---- 4. B 写提示词并生成 ----
  await evaluate(`(() => {
    const panel = document.querySelector('[data-drawing-generation-panel]');
    const editor = panel.querySelector('[contenteditable]');
    editor.focus();
    editor.textContent = '把参考图原样重绘一遍，保持主体和所有细节';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
    return 1;
  })()`);
  await sleep(500);
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('[data-drawing-generation-panel] button')].find((b) => b.textContent.includes('开始生成'));
    if (btn) btn.click();
    return 1;
  })()`);
  console.log('B generating...');
  let bDone = false;
  for (let i = 0; i < 110; i += 1) {
    await sleep(5000);
    const st = await evaluate(`(() => {
      const b = document.querySelector('.node-element[data-e2e="B"]');
      if (!b) return 'B-gone';
      if (b.querySelectorAll('[data-drawing-node-preview] img').length >= 1) return 'done';
      if (b.textContent.includes('失败')) return 'failed';
      return 'waiting';
    })()`);
    if (i % 6 === 0) console.log('pollB', i, st);
    if (st !== 'waiting') { bDone = st === 'done'; break; }
  }
  if (!bDone) {
    console.log('reload for resume...');
    await send('Page.navigate', { url: `${BASE}/canvas/${projectId}` });
    await sleep(9000);
    for (let i = 0; i < 30; i += 1) {
      await sleep(4000);
      const st = await evaluate(`(() => {
        const b = document.querySelector('.node-element[data-e2e="B"]');
        return b && b.querySelectorAll('[data-drawing-node-preview] img').length >= 1 ? 'done' : 'waiting';
      })()`);
      if (st === 'done') { bDone = true; break; }
    }
    console.log('after reload:', bDone);
  }
  await shot('chain-B-done.png');
  if (!bDone) { console.log('CHAIN FAIL: B not done'); process.exit(2); }

  // ---- 5. 查库验证 ----
  const Database = require(path.join(process.cwd(), 'node_modules', 'better-sqlite3'));
  const db = new Database(DB, { readonly: true });
  const tasks = db.prepare('SELECT id, status, prompt, created_at FROM generation_tasks ORDER BY created_at DESC LIMIT 3').all();
  tasks.forEach((t) => console.log('TASK', t.id.slice(-8), t.status, '|', t.prompt.slice(0, 18)));
  const bTask = tasks.find((t) => t.prompt.includes('原样重绘'));
  const aTask = tasks.find((t) => t.prompt.includes('白色陶瓷咖啡杯'));
  db.close();
  const ok = bTask && bTask.status === 'success' && aTask && aTask.status === 'success';
  console.log(ok ? 'CHAIN PASS' : 'CHAIN FAIL: tasks not success');
  ws.close();
  chrome.kill();
  if (!ok) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
