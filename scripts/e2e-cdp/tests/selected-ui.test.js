const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
// 单图化验收：生图节点只显示一张图，无「已选中/将作为下游参考图」覆盖层、无 n/n 计数。
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
  const check = await evaluate(`(() => {
    const text = document.body.textContent || '';
    const previewNodes = [...document.querySelectorAll('[data-drawing-node-preview]')];
    const imgCounts = previewNodes.map((el) => el.querySelectorAll('img').length);
    return {
      hasSelected: text.includes('已选中'),
      hasHint: text.includes('将作为下游参考图'),
      hasCounter: /\\d\\/\\d/.test(text),
      nodeCount: previewNodes.length,
      singleImages: previewNodes.length > 0 && imgCounts.every((c) => c <= 1)
    };
  })()`);
  console.log('check:', JSON.stringify(check));
  await shot('canvas-selected-ui.png');
  ws.close();
  chrome.kill();
  const ok = !check.hasSelected && !check.hasHint && !check.hasCounter && check.singleImages;
  console.log(ok ? 'SINGLE-UI PASS' : 'SINGLE-UI FAIL');
  if (!ok) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
