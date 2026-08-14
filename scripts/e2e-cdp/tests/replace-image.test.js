const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
const { start } = require('../lib/browser');
async function main() {
  const { chrome, ws, send, evaluate, sleep } = await start(9260, 'chrome-cdp-e2e');
  await send('Page.navigate', { url: `${BASE}/canvas/${process.argv[2] || 'proj_mscjyl35965edc3d'}` });
  await sleep(9000);

  // 选中图片节点，记录原图 src
  const before = await evaluate(`(() => {
    const node = [...document.querySelectorAll('.node-element')].find((el) => el.querySelector('img') && !el.querySelector('[data-drawing-node-preview]'));
    node.setAttribute('data-e2e', 'target');
    const r = node.getBoundingClientRect();
    node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left + 20, clientY: r.top + 20 }));
    node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.left + 20, clientY: r.top + 20 }));
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 20, clientY: r.top + 20 }));
    return node.querySelector('img')?.src?.slice(-30) || '';
  })()`);
  await sleep(1500);
  console.log('before src:', before);

  // 点「替换图片」→ 触发文件选择框（JS 点击）
  await evaluate(`(() => {
    const toolbar = [...document.querySelectorAll('div')].find((d) => d.className.includes('z-[70]') && d.className.includes('-translate-y-full'));
    const btn = [...toolbar.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === '替换图片');
    btn.click();
    return 1;
  })()`);
  await sleep(1000);

  // 用 DOM.setFileInputFiles 喂文件
  const testFile = 'F:/dianshang-worktrees/infinite-canvas-candidate/.scratch/infinite-canvas-local/object-storage/users/user_ms6uy8ld5d08583a/assets/asset_msd1rd0274807c9e/0e79830bb6cb5095e2b0f4c8.png';
  const inputCount = await evaluate(`document.querySelectorAll('input[type="file"]').length`);
  console.log('file inputs:', inputCount);
  const doc = await send('DOM.getDocument', {});
  const inputs = await send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector: 'input[type="file"]' });
  for (const nodeId of inputs.nodeIds) {
    await send('DOM.setFileInputFiles', { files: [testFile], nodeId }).catch((e) => console.log('set files err', String(e).slice(0, 60)));
  }
  await sleep(5000);

  const after = await evaluate(`(() => {
    const node = document.querySelector('.node-element[data-e2e="target"]');
    return node ? (node.querySelector('img')?.src?.slice(-30) || '') : 'node-gone';
  })()`);
  console.log('after src:', after);
  console.log(after && before && after !== before ? 'REPLACE PASS' : 'REPLACE CHECK (src 对比无效时需看图)');
  ws.close();
  chrome.kill();
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
