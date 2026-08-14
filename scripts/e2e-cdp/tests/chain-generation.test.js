// AI_COST: true — 会真实调用计费
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
// E2E v3：修正连线释放点（B 体中心）。复用已有 A（2 图），删旧 B，新建 B，连线，生成，查库验证。
const { start } = require('../lib/browser');
const path = require('path');

const PROJECT_ID = process.argv[2] || 'proj_mscjyl35965edc3d';
const DB = (process.env.E2E_DB_PATH || require('path').join(__dirname, '..', '..', '..', '.scratch', 'infinite-canvas-local', 'data', 'data.db'));

async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9237, 'chrome-cdp-e2e');
  await send('Page.navigate', { url: `${BASE}/canvas/${PROJECT_ID}` });
  await sleep(9000);

  // A 可能在视口外（节点虚拟化只渲染可见区）：先点侧栏节点项居中，再打标
  const centerA = await evaluate(`(() => {
    const items = [...document.querySelectorAll('button, [role="button"], li, div')].filter((el) => {
      const tx = (el.textContent || '').trim();
      return tx === '生图节点生图节点';
    });
    const item = items.find((el) => el.closest('.node-element') === null && el.getBoundingClientRect().left < 280);
    if (!item) return 'no-sidebar-item';
    item.click();
    return 'clicked';
  })()`);
  console.log('center A via sidebar:', centerA);
  await sleep(6000);
  const tagA = await evaluate(`(() => {
    const multi = [...document.querySelectorAll('.node-element')].filter((el) => el.querySelectorAll('[data-drawing-node-preview] img').length >= 2);
    if (!multi.length) return 'no-multi';
    multi[multi.length - 1].setAttribute('data-e2e', 'A');
    return 'ok';
  })()`);
  console.log('tag A:', tagA);
  if (tagA !== 'ok') { ws.close(); chrome.kill(); process.exit(2); }

  // 删除空/失败 B 节点（无图或 1 图的生图节点且不是 A）
  const delB = await evaluate(`(() => {
    const bs = [...document.querySelectorAll('.node-element')].filter((el) => !el.getAttribute('data-e2e') && el.textContent.includes('生图节点') && el.querySelectorAll('[data-drawing-node-preview] img').length < 2);
    bs.forEach((b) => { b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 500, clientY: 500 })); b.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 500, clientY: 500 })); });
    return bs.length;
  })()`);
  if (delB > 0) {
    await sleep(600);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
    await sleep(1000);
  }
  console.log('deleted old B:', delB);

  // 选 A 第 2 张
  const sel = await evaluate(`(() => {
    const a = document.querySelector('.node-element[data-e2e="A"]');
    const tiles = [...a.querySelectorAll('[data-drawing-node-preview] button')];
    tiles[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 700, clientY: 300 }));
    tiles[1].dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 700, clientY: 300 }));
    return 'ok';
  })()`);
  await sleep(800);
  const badge = await evaluate(`(() => { const a = document.querySelector('.node-element[data-e2e="A"]'); return (a.textContent.match(/(\\d)\\/(\\d)/) || []).slice(1).join('/'); })()`);
  console.log('select tile2:', sel, 'badge:', badge);

  // 新建 B
  await evaluate(`(() => { document.querySelector('button[aria-label="生图节点"]').click(); return 1; })()`);
  await sleep(2500);
  const bRect = await evaluate(`(() => {
    const candidates = [...document.querySelectorAll('.node-element')].filter((el) => !el.getAttribute('data-e2e') && !el.querySelector('[data-drawing-node-preview] img') && el.textContent.includes('生图节点'));
    if (!candidates.length) return null;
    const b = candidates[candidates.length - 1];
    b.setAttribute('data-e2e', 'B');
    const r = b.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  })()`);
  console.log('tag B:', JSON.stringify(bRect));
  if (!bRect) { ws.close(); chrome.kill(); process.exit(2); }

  // B 可能与 A 重叠（新建落点在 A 上方），先把 B 拖到右侧空地
  {
    const cx = bRect.x + bRect.w / 2, cy = bRect.y + bRect.h / 2;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i += 1) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cx + i * 45, y: cy, button: 'left', buttons: 1 });
      await sleep(50);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx + 450, y: cy, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(1200);
  }
  const bRect2 = await evaluate(`(() => { const b = document.querySelector('.node-element[data-e2e="B"]'); const r = b.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  console.log('B moved to:', JSON.stringify(bRect2));

  // 连线：JS 事件直连 A 右点 → B 体中心（绕过 Agent 面板遮挡的命中测试）
  const connResult = await evaluate(`(() => {
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
  console.log('connect:', connResult);
  await sleep(1500);
  const chip = await evaluate(`(() => {
    const panel = document.querySelector('[data-drawing-generation-panel]');
    return panel ? (panel.textContent.match(/参考图\\s*\\d+\\s*张/) || ['?'])[0] : 'no-panel';
  })()`);
  console.log('B input chip after connect:', chip);
  await shot('e2e-v3-connected.png');
  if (!chip.includes('1')) { console.log('CONNECT FAILED'); ws.close(); chrome.kill(); process.exit(2); }

  // B 提示词 + 生成
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
    btn.click();
    return 1;
  })()`);
  console.log('B generating...');

  let bState = 'waiting';
  for (let i = 0; i < 110; i += 1) {
    await sleep(5000);
    bState = await evaluate(`(() => {
      const b = document.querySelector('.node-element[data-e2e="B"]');
      if (!b) return 'B-gone';
      if (b.querySelectorAll('[data-drawing-node-preview] img').length >= 1) return 'done';
      if (b.textContent.includes('失败')) return 'failed';
      return 'waiting';
    })()`);
    if (i % 6 === 0) console.log('pollB', i, bState);
    if (bState !== 'waiting') break;
  }
  console.log('B final:', bState);
  await shot('e2e-v3-B-done.png');

  // 查库验证
  const Database = require(path.join('F:/dianshang-worktrees/infinite-canvas-candidate', 'node_modules', 'better-sqlite3'));
  const db = new Database(DB, { readonly: true });
  const tasks = db.prepare('SELECT id, status, prompt, image_count, request_json, result_json, created_at FROM generation_tasks ORDER BY created_at DESC LIMIT 3').all();
  let refB = null;
  let aImages = [];
  for (const t of tasks) {
    const req = JSON.parse(t.request_json || '{}');
    const res = JSON.parse(t.result_json || '[]');
    const refs = (req.referenceImages || []).map((r) => String(r.storageKey || r.assetId || r.url || ''));
    const results = (Array.isArray(res) ? res : []).map((r) => String(r.storageKey || r.assetId || r.url || ''));
    console.log('TASK', t.id.slice(-8), t.status, '| refs:', JSON.stringify(refs.map((s) => s.slice(-14))), '| results:', JSON.stringify(results.map((s) => s.slice(-14))), '|', t.prompt.slice(0, 14));
    if (!refB && refs.length) refB = refs[0];
    if (!aImages.length && t.image_count >= 2 && results.length >= 2) aImages = results;
  }
  if (refB && aImages.length >= 2) {
    const idx = aImages.findIndex((s) => s === refB);
    console.log('VERIFY: B reference == A image#' + (idx + 1), idx === 1 ? '选中的第 2 张 ✓' : '✗');
  }
  db.close();

  ws.close();
  chrome.kill();
  if (bState !== 'done') process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
