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
  await evaluate(`(() => {
    const toolbar = [...document.querySelectorAll('div')].find((d) => d.className.includes('z-[70]') && d.className.includes('-translate-y-full'));
    toolbar.querySelectorAll('button')[14].click();
    return 1;
  })()`);
  await sleep(1500);
  const modal = await evaluate(`(() => {
    const m = document.querySelector('.ant-modal-wrap');
    return m ? m.textContent.replace(/\s+/g, ' ').slice(0, 120) : 'no-modal';
  })()`);
  console.log('modal:', modal);

  // 确认开始超分
  const before = await evaluate(`document.querySelectorAll('.node-element').length`);
  await evaluate(`(() => {
    const b = [...document.querySelectorAll('.ant-modal-wrap .ant-modal-footer button, .ant-modal-wrap button')].find((x) => x.textContent.includes('开始超分'));
    if (b) b.click();
    return 1;
  })()`);
  console.log('submitted, waiting...');
  let done = false;
  for (let i = 0; i < 90; i += 1) {
    await sleep(4000);
    const st = await evaluate(`(() => {
      const nodes = [...document.querySelectorAll('.node-element')];
      const sr = nodes.find((el) => el.textContent.includes('AI 超分'));
      if (!sr) return 'no-child';
      if (sr.querySelector('img')) return 'has-image';
      if (sr.textContent.includes('失败')) return 'failed';
      return 'waiting';
    })()`);
    if (i % 6 === 0) console.log('poll', i, st);
    if (st === 'has-image') { done = true; break; }
    if (st === 'failed' || st === 'no-child') break;
  }
  await shot('tool-superresolve.png');
  console.log(done ? 'SUPERRESOLVE PASS' : 'SUPERRESOLVE FAIL');
  ws.close();
  chrome.kill();
  if (!done) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
