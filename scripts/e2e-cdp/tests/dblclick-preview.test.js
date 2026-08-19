// 结果图单击选中（「已选中」提示出现）+ 双击放大原图验收。
const { start } = require('../lib/browser');
const fs = require('fs');

const DIR = process.env.E2E_WORK_DIR || require('path').join(__dirname, '..', '..', '..', '.scratch');

async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9263, 'chrome-cdp-e2e');
  await send('Page.navigate', { url: `http://127.0.0.1:3468/canvas/${process.argv[2] || 'proj_mscjyl35965edc3d'}` });
  await sleep(9000);

  // 双击 → antd 原图预览
  await evaluate(`(() => {
    const tiles = [...document.querySelectorAll('[data-drawing-node-preview] button')];
    const tile = tiles[tiles.length - 1];
    tile.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: 500, clientY: 400 }));
    return 1;
  })()`);
  await sleep(2000);
  const preview = await evaluate(`(() => {
    const mask = document.querySelector('.ant-image-preview');
    const img = document.querySelector('.ant-image-preview-img');
    return { open: !!mask, hasImg: !!img };
  })()`);
  console.log('preview:', JSON.stringify(preview));
  await shot('dblclick-preview.png');

  ws.close();
  chrome.kill();
  const ok = preview.open && preview.hasImg;
  console.log(ok ? 'PREVIEW PASS' : 'PREVIEW FAIL');
  if (!ok) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
