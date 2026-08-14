const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
// 选中态 UI 验收：多图节点选中第 2 张后截图
const { start } = require('../lib/browser');
async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9242, 'chrome-cdp-e2e');
  await send('Page.navigate', { url: `${BASE}/canvas/${process.argv[2] || 'proj_mscjyl35965edc3d'}` });
  await sleep(9000);
  await evaluate(`(() => {
    const items = [...document.querySelectorAll('button, [role="button"], li, div')].filter((el) => (el.textContent || '').trim() === '生图节点生图节点');
    const item = items.find((el) => el.getBoundingClientRect().left < 280);
    if (item) item.click();
    return 1;
  })()`);
  await sleep(6000);
  const r = await evaluate(`(() => {
    const multi = [...document.querySelectorAll('.node-element')].filter((el) => el.querySelectorAll('[data-drawing-node-preview] img').length >= 2);
    if (!multi.length) return 'no-multi';
    const a = multi[multi.length - 1];
    const tiles = [...a.querySelectorAll('[data-drawing-node-preview] button')];
    tiles[1].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 700, clientY: 300 }));
    tiles[1].dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 700, clientY: 300 }));
    return 'clicked';
  })()`);
  console.log('select:', r);
  await sleep(1200);
  const check = await evaluate(`(() => {
    const text = document.body.textContent || '';
    return { hasSelected: text.includes('已选中'), hasHint: text.includes('将作为下游参考图') };
  })()`);
  console.log('check:', JSON.stringify(check));
  await shot('canvas-selected-ui.png');
  ws.close();
  chrome.kill();
  if (!check.hasSelected || !check.hasHint) process.exit(2);
  console.log('SELECT-UI PASS');
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
