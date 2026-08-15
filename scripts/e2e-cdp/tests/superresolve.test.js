// AI_COST: true — 会真实调用计费
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const { start } = require('../lib/browser');
async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9261, 'chrome-cdp-e2e');
  await send('Page.navigate', { url: `${BASE}/canvas/${process.argv[2] || 'proj_mscjyl35965edc3d'}` });
  await sleep(9000);

  // 选中图片节点
  await evaluate(`(() => {
    const node = [...document.querySelectorAll('.node-element')].find((el) => el.querySelector('img') && !el.querySelector('[data-drawing-node-preview]'));
    const r = node.getBoundingClientRect();
    node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 20, clientY: r.top + 20 }));
    node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.left + 20, clientY: r.top + 20 }));
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 20, clientY: r.top + 20 }));
    return 1;
  })()`);
  await sleep(1500);

  // 点超分（idx 14）
  const toolbarDump = await evaluate(`(() => {
    const toolbar = [...document.querySelectorAll('div')].find((d) => d.className.includes('z-[70]') && d.className.includes('-translate-y-full'));
    if (!toolbar) return 'no-toolbar';
    const btns = [...toolbar.querySelectorAll('button')];
    const b = btns[14];
    if (b) b.click();
    return { count: btns.length, clicked: b ? b.getAttribute('aria-label') : null };
  })()`);
  console.log('toolbar:', JSON.stringify(toolbarDump));
  await sleep(1500);
  const modal = await evaluate(`(() => {
    const m = document.querySelector('.ant-modal-wrap');
    return m ? m.textContent.replace(/\s+/g, ' ').slice(0, 120) : 'no-modal';
  })()`);
  console.log('modal:', modal);

  // 确认开始超分
  const before = await evaluate(`document.querySelectorAll('.node-element').length`);
  const confirm = await evaluate(`(() => {
    const btns = [...document.querySelectorAll('.ant-modal-wrap button')].map((x) => x.textContent.trim());
    const b = [...document.querySelectorAll('.ant-modal-wrap button')].find((x) => x.textContent.includes('开始超分'));
    if (b) b.click();
    return { found: !!b, btns };
  })()`);
  console.log('confirm:', JSON.stringify(confirm));
  // 断言查库：超分提示词的任务出现且成功（子节点可能落在视口外——节点虚拟化下 DOM 断言不可靠）
  const path = require('path');
  const Database = require(path.join(process.cwd(), 'node_modules', 'better-sqlite3'));
  const dbPath = process.env.E2E_DB_PATH || path.join(__dirname, '..', '..', '..', '.scratch', 'infinite-canvas-local', 'data', 'data.db');
  let done = false;
  for (let i = 0; i < 90; i += 1) {
    await sleep(4000);
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare('SELECT status FROM generation_tasks WHERE prompt LIKE ? ORDER BY created_at DESC LIMIT 1').get('%超分辨率增强%');
    db.close();
    if (row && row.status === 'success') { done = true; console.log('task success at poll', i); break; }
    if (row && row.status === 'failed') { console.log('task failed'); break; }
    if (i % 6 === 0) console.log('poll', i, row ? row.status : 'no-task');
  }
  await shot('tool-superresolve.png');
  console.log(done ? 'SUPERRESOLVE PASS' : 'SUPERRESOLVE FAIL');
  ws.close();
  chrome.kill();
  if (!done) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
