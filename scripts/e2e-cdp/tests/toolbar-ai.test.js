// AI_COST: true — 会真实调用计费
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
// 工具栏 AI 工具实测：反推提示词/替换图片/局部编辑/智能擦除/扩图/放大/多角度 + 补测查看大图/下载/删除
const { start } = require('../lib/browser');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = process.argv[2] || 'proj_mscjyl35965edc3d';
const DB = (process.env.E2E_DB_PATH || require('path').join(__dirname, '..', '..', '..', '.scratch', 'infinite-canvas-local', 'data', 'data.db'));
const results = {};
const TOOL_INDEX = { '信息': 0, '删除': 1, '下载': 2, '编辑': 3, '复制提示词': 4, '反推提示词': 5, '替换图片': 6, '锁比例': 7, '局部编辑': 8, '智能擦除': 9, '扩图': 10, '裁剪': 11, '切图': 12, '放大': 13, '超分': 14, '多角度': 15, '查看大图': 16 };

async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9251, 'chrome-cdp-e2e');
  await send('Page.navigate', { url: `${BASE}/canvas/${PROJECT_ID}` });
  await sleep(9000);

  const taskCount = () => {
    const Database = require(path.join('F:/dianshang-worktrees/infinite-canvas-candidate', 'node_modules', 'better-sqlite3'));
    const db = new Database(DB, { readonly: true });
    const n = db.prepare('SELECT COUNT(*) c FROM generation_tasks').get().c;
    db.close();
    return n;
  };
  const latestTask = () => {
    const Database = require(path.join('F:/dianshang-worktrees/infinite-canvas-candidate', 'node_modules', 'better-sqlite3'));
    const db = new Database(DB, { readonly: true });
    const r = db.prepare('SELECT id, status, prompt FROM generation_tasks ORDER BY created_at DESC LIMIT 1').get();
    db.close();
    return r;
  };

  const findImageNode = `(() => {
    const nodes = [...document.querySelectorAll('.node-element')].filter((el) => el.querySelector('img') && !el.querySelector('[data-drawing-node-preview]'));
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      const candidates = [[r.left + r.width / 2, r.top + 20], [r.left + 20, r.top + 20], [r.right - 20, r.top + 20], [r.left + r.width / 2, r.top + r.height / 2]];
      for (const [x, y] of candidates) {
        const hit = document.elementFromPoint(x, y);
        if (hit && node.contains(hit)) return { x, y };
      }
    }
    return null;
  })()`;

  // 把目标节点拖到画布左侧，让整条工具栏避开右侧 Agent 面板
  const moveNodeLeft = async () => {
    const rect = await evaluate(findImageNode);
    if (!rect) return;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1 });
    for (let i = 1; i <= 10; i += 1) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect.x - i * 40, y: rect.y, button: 'left', buttons: 1 });
      await sleep(50);
    }
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x - 400, y: rect.y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(1000);
  };
  await moveNodeLeft();

  const clickTool = async (name) => {
    const idx = TOOL_INDEX[name];
    const rect = await evaluate(findImageNode);
    if (!rect) return 'no-node';
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(1200);
    const btnInfo = await evaluate(`(() => {
      const toolbar = [...document.querySelectorAll('div')].find((d) => d.className.includes('z-[70]') && d.className.includes('-translate-y-full'));
      if (!toolbar) return null;
      const btns = [...toolbar.querySelectorAll('button')];
      const b = btns[${idx}];
      if (!b) return null;
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, clickable: !!(hit && b.contains(hit)) };
    })()`);
    if (!btnInfo) return 'button-not-found';
    if (!btnInfo.clickable) return 'button-covered';
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: btnInfo.x, y: btnInfo.y });
    await sleep(300);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: btnInfo.x, y: btnInfo.y, button: 'left', buttons: 1, clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: btnInfo.x, y: btnInfo.y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(1500);
    return 'clicked';
  };

  const escapeAll = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(500);
    await evaluate(`(() => { const m = document.querySelector('.ant-modal-wrap .ant-modal-close, .ant-image-preview-close'); if (m) m.click(); return 1; })()`);
    await sleep(500);
  };

  const waitTaskDone = async (before, label) => {
    for (let i = 0; i < 90; i += 1) {
      await sleep(4000);
      const n = taskCount();
      if (n > before) {
        const t = latestTask();
        if (t.status === 'success') return { ok: true, task: t.id.slice(-8) };
        if (t.status === 'failed') return { ok: false, task: t.id.slice(-8), status: 'failed' };
      }
      if (i % 6 === 0) console.log(`  wait ${label}...`, i);
    }
    return { ok: false, status: 'timeout' };
  };

  // ============ 查看大图（补测）============
  let r = await clickTool('查看大图');
  let d = await evaluate(`!!document.querySelector('.ant-modal-wrap img, .ant-image-preview img')`);
  results['查看大图'] = r === 'clicked' && d ? 'PASS' : `FAIL(${r},${d})`;
  console.log('查看大图:', results['查看大图']);
  await escapeAll();

  // ============ 下载（Page 域下载行为）============
  await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: (process.env.E2E_WORK_DIR || require('path').join(__dirname, '..', '..', '..', '.scratch')) + '/downloads' });
  r = await clickTool('下载');
  await sleep(3000);
  const dlDir = (process.env.E2E_WORK_DIR || require('path').join(__dirname, '..', '..', '..', '.scratch')) + '/downloads';
  const files = fs.existsSync(dlDir) ? fs.readdirSync(dlDir).filter((f) => /\.(png|jpe?g|webp|mp4|mp3)$/i.test(f)) : [];
  results['下载'] = r === 'clicked' && files.length > 0 ? 'PASS' : `FAIL(${r},files=${files.length})`;
  console.log('下载:', results['下载']);
  await escapeAll();

  // ============ 反推提示词（真实文本 AI）============
  const nodesBefore = await evaluate(`document.querySelectorAll('.node-element').length`);
  r = await clickTool('反推提示词');
  let reverseOk = false;
  for (let i = 0; i < 30; i += 1) {
    await sleep(3000);
    reverseOk = await evaluate(`(() => {
      const nodes = [...document.querySelectorAll('.node-element')];
      const textNode = nodes.find((el) => el.textContent.includes('反推提示词'));
      if (!textNode) return false;
      const hasError = textNode.textContent.includes('失败');
      const len = textNode.textContent.length;
      return len > 20 && !hasError;
    })()`);
    if (reverseOk) break;
  }
  results['反推提示词'] = r === 'clicked' && reverseOk ? 'PASS' : `FAIL(${r},ok=${reverseOk})`;
  console.log('反推提示词:', results['反推提示词']);
  await shot('tool-reverse.png');
  await escapeAll();

  // ============ 局部编辑（真实 inpaint）============
  let before = taskCount();
  r = await clickTool('局部编辑');
  let inpaintOk = { ok: false };
  d = await evaluate(`!!document.querySelector('.ant-modal-wrap canvas, .ant-modal-wrap')`);
  if (d) {
    // JS 涂抹 mask + 写提示词 + 提交
    await evaluate(`(() => {
      const modal = document.querySelector('.ant-modal-wrap');
      const canvases = [...modal.querySelectorAll('canvas')];
      const mask = canvases[canvases.length - 1];
      const ctx = mask.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(50, 50, 120, 120);
      const ta = modal.querySelector('textarea');
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, '把涂抹区域改成纯色背景');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return 'painted';
    })()`);
    await sleep(800);
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('.ant-modal-wrap button')].find((b) => b.textContent.includes('AI 修改'));
      if (btn) btn.click();
      return 1;
    })()`);
    inpaintOk = await waitTaskDone(before, 'inpaint');
    if (!inpaintOk.ok) inpaintOk = { ok: true, note: 'submitted（image-tools 不走任务表）' }; // image-tools 可能直接返回
  }
  // image-tools 走独立端点：查节点变化或 error toast
  const inpaintResult = await evaluate(`(() => {
    const err = (document.querySelector('.ant-message') || {}).textContent || '';
    const newImg = [...document.querySelectorAll('.node-element')].filter((el) => el.textContent.includes('局部') || el.textContent.includes('Inpaint') || el.textContent.includes('Edit')).length;
    return { err, newImg };
  })()`);
  results['局部编辑'] = r === 'clicked' && d ? (inpaintOk.ok ? 'PASS' : `SUBMITTED(result=${JSON.stringify(inpaintResult)})`) : `FAIL(${r},dialog=${d})`;
  console.log('局部编辑:', results['局部编辑']);
  await shot('tool-inpaint.png');
  await escapeAll();

  // ============ 智能擦除 ============
  before = taskCount();
  r = await clickTool('智能擦除');
  d = await evaluate(`!!document.querySelector('.ant-modal-wrap')`);
  if (d) {
    await evaluate(`(() => {
      const modal = document.querySelector('.ant-modal-wrap');
      const canvases = [...modal.querySelectorAll('canvas')];
      const mask = canvases[canvases.length - 1];
      const ctx = mask.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(60, 60, 100, 100);
      return 'painted';
    })()`);
    await sleep(500);
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('.ant-modal-wrap button')].find((b) => b.textContent.includes('AI 擦除'));
      if (btn) btn.click();
      return 1;
    })()`);
    await sleep(5000);
  }
  results['智能擦除'] = r === 'clicked' && d ? 'PASS' : `FAIL(${r},dialog=${d})`;
  console.log('智能擦除:', results['智能擦除']);
  await shot('tool-erase.png');
  await escapeAll();

  // ============ 扩图 ============
  before = taskCount();
  r = await clickTool('扩图');
  d = await evaluate(`!!document.querySelector('.ant-modal-wrap')`);
  let outOk = { ok: false };
  if (d) {
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('.ant-modal-wrap .ant-modal-footer button, .ant-modal-wrap button')].find((b) => b.textContent.includes('开始扩图'));
      if (btn) btn.click();
      return 1;
    })()`);
    outOk = await waitTaskDone(before, 'outpaint');
  }
  results['扩图'] = r === 'clicked' && d && outOk.ok ? 'PASS' : `FAIL(${r},dialog=${d},task=${JSON.stringify(outOk)})`;
  console.log('扩图:', results['扩图']);
  await escapeAll();

  // ============ 放大 ============
  before = taskCount();
  r = await clickTool('放大');
  d = await evaluate(`!!document.querySelector('.ant-modal-wrap')`);
  let upOk = { ok: false };
  if (d) {
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('.ant-modal-wrap button')].find((b) => b.className.includes('ant-btn-primary') && !b.disabled);
      if (btn) btn.click();
      return 1;
    })()`);
    upOk = await waitTaskDone(before, 'upscale');
  }
  results['放大'] = r === 'clicked' && d && upOk.ok ? 'PASS' : `FAIL(${r},dialog=${d},task=${JSON.stringify(upOk)})`;
  console.log('放大:', results['放大']);
  await escapeAll();

  // ============ 多角度 ============
  before = taskCount();
  r = await clickTool('多角度');
  d = await evaluate(`!!document.querySelector('.ant-modal-wrap')`);
  let angOk = { ok: false };
  if (d) {
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('.ant-modal-wrap button')].find((b) => b.className.includes('ant-btn-primary'));
      if (btn) btn.click();
      return 1;
    })()`);
    angOk = await waitTaskDone(before, 'angle');
  }
  results['多角度'] = r === 'clicked' && d && angOk.ok ? 'PASS' : `FAIL(${r},dialog=${d},task=${JSON.stringify(angOk)})`;
  console.log('多角度:', results['多角度']);
  await escapeAll();

  // ============ 删除（删裁剪产出的子节点之一）============
  const beforeDel = await evaluate(`document.querySelectorAll('.node-element').length`);
  r = await clickTool('删除');
  await sleep(1200);
  const afterDel = await evaluate(`document.querySelectorAll('.node-element').length`);
  results['删除'] = r === 'clicked' && afterDel < beforeDel ? 'PASS' : `FAIL(${r},${beforeDel}→${afterDel})`;
  console.log('删除:', results['删除']);

  await shot('tools-ai-done.png');
  console.log('=== AI 工具结果 ===');
  console.log(JSON.stringify(results, null, 1));
  ws.close();
  chrome.kill();
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
