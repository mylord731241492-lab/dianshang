const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3468';
// 工具栏全工具实测 v5：启用全部 17 项 + 每个工具独立选中目标节点
const { start } = require('../lib/browser');

const PROJECT_ID = process.argv[2] || 'proj_mscjyl35965edc3d';
const results = {};
const ALL_IDS = ['info', 'delete', 'download', 'edit', 'copyPrompt', 'reversePrompt', 'replace', 'resize', 'maskEdit', 'smartErase', 'outpaint', 'crop', 'split', 'upscale', 'superResolve', 'angle', 'view'];

async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9247, 'chrome-cdp-e2e');
  await send('Page.navigate', { url: `${BASE}/canvas/${PROJECT_ID}` });
  await sleep(9000);

  // 全量启用 17 项工具（服务端+本地）
  await evaluate(`(async () => {
    const token = window.localStorage.getItem('auth_token');
    const config = { ids: ${JSON.stringify(ALL_IDS)}, showLabels: false };
    await fetch('/api/user/ui-preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ 'canvas-image-quick-tools-v6': config }) });
    window.localStorage.setItem('canvas-image-quick-tools-v6', JSON.stringify(config));
    return 'ok';
  })()`);
  await send('Page.navigate', { url: `${BASE}/canvas/${PROJECT_ID}` });
  await sleep(9000);

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

  const escapeAll = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(600);
    await evaluate(`(() => { const m = document.querySelector('.ant-modal-wrap .ant-modal-close, .ant-image-preview-close'); if (m) m.click(); return 1; })()`);
    await sleep(500);
  };

  const TOOL_INDEX = { '信息': 0, '删除': 1, '下载': 2, '编辑': 3, '复制提示词': 4, '反推提示词': 5, '替换图片': 6, '锁比例': 7, '局部编辑': 8, '智能擦除': 9, '扩图': 10, '裁剪': 11, '切图': 12, '放大': 13, '超分': 14, '多角度': 15, '查看大图': 16 };
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
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, count: btns.length, clickable: !!(hit && b.contains(hit)) };
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

  const anyDialog = () => evaluate(`!!document.querySelector('.ant-modal-wrap:not([style*="display: none"]), [role="dialog"], .ant-image-preview')`);
  const nodeCount = () => evaluate(`document.querySelectorAll('.node-element').length`);

  // 1 信息
  let r = await clickTool('信息');
  let d = await anyDialog();
  results['信息'] = r === 'clicked' && d ? 'PASS' : `FAIL(${r},dialog=${d})`;
  console.log('1 信息:', results['信息']);
  await escapeAll();

  // 2 编辑
  r = await clickTool('编辑');
  d = await evaluate(`!!document.querySelector('textarea, [contenteditable], .ant-modal-wrap, [role="dialog"]')`);
  results['编辑'] = r === 'clicked' && d ? 'PASS' : `FAIL(${r},${d})`;
  console.log('2 编辑:', results['编辑']);
  await escapeAll();

  // 3 查看大图
  r = await clickTool('查看大图');
  d = await evaluate(`!!document.querySelector('.ant-modal-wrap img, .ant-image-preview img')`);
  results['查看大图'] = r === 'clicked' && d ? 'PASS' : `FAIL(${r},${d})`;
  console.log('3 查看大图:', results['查看大图']);
  await escapeAll();

  // 4 锁比例
  r = await clickTool('锁比例');
  results['锁比例'] = r === 'clicked' ? 'PASS' : `FAIL(${r})`;
  console.log('4 锁比例:', results['锁比例']);
  await evaluate(`(() => { const tb = [...document.querySelectorAll('div')].find((d) => d.className.includes('z-[70]') && d.className.includes('-translate-y-full')); if (tb) tb.querySelectorAll('button')[7].click(); return 1; })()`); // 还原锁比例
  await escapeAll();

  // 5 复制提示词
  r = await clickTool('复制提示词');
  const toast = await evaluate(`(document.querySelector('.ant-message') || {}).textContent || ''`);
  results['复制提示词'] = r === 'clicked' && (toast.includes('已复制') || toast.includes('暂无可复制')) ? 'PASS' : `FAIL(${r},toast=${toast})`;
  console.log('5 复制提示词:', results['复制提示词']);
  await escapeAll();

  // 6 裁剪
  const before6 = await nodeCount();
  r = await clickTool('裁剪');
  d = await anyDialog();
  let cropOk = d;
  if (d) {
    await evaluate(`(() => { const b = [...document.querySelectorAll('.ant-modal-wrap button')].find((x) => x.textContent.includes('确认裁剪')); if (b) b.click(); return 1; })()`);
    await sleep(2000);
    cropOk = (await nodeCount()) > before6;
  }
  results['裁剪'] = r === 'clicked' && cropOk ? 'PASS' : `FAIL(${r},dialog=${d},new=${cropOk})`;
  console.log('6 裁剪:', results['裁剪']);
  await escapeAll();

  // 7 切图
  const before7 = await nodeCount();
  r = await clickTool('切图');
  d = await anyDialog();
  let splitOk = d;
  if (d) {
    await evaluate(`(() => { const b = [...document.querySelectorAll('.ant-modal-wrap button')].find((x) => x.className.includes('ant-btn-primary')); if (b) b.click(); return 1; })()`);
    await sleep(2500);
    splitOk = (await nodeCount()) > before7;
  }
  results['切图'] = r === 'clicked' && splitOk ? 'PASS' : `FAIL(${r},dialog=${d},new=${splitOk})`;
  console.log('7 切图:', results['切图']);
  await escapeAll();

  // 8 下载（开启下载行为，验证文件落盘）
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: (process.env.E2E_WORK_DIR || require('path').join(__dirname, '..', '..', '..', '.scratch')) + '/downloads' });
  r = await clickTool('下载');
  await sleep(2500);
  const downloaded = await evaluate(`(async () => { try { const r = await fetch('/api/health'); return r.ok; } catch { return false; } })()`);
  const fs = require('fs');
  const dlDir = (process.env.E2E_WORK_DIR || require('path').join(__dirname, '..', '..', '..', '.scratch')) + '/downloads';
  const files = fs.existsSync(dlDir) ? fs.readdirSync(dlDir).filter((f) => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.webp')) : [];
  results['下载'] = r === 'clicked' && files.length > 0 ? 'PASS' : `FAIL(${r},files=${files.length})`;
  console.log('8 下载:', results['下载']);

  await shot('tools-local-done.png');
  console.log('=== 本地工具结果 ===');
  console.log(JSON.stringify(results, null, 1));
  ws.close();
  chrome.kill();
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
