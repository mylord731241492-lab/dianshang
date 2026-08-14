// @ 提及验收：Agent 聊天输入框输入 @ → 弹层出现 → 选择节点引用 → chip 插入。
const { start } = require('../lib/browser');

async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9262, 'chrome-cdp-e2e');
  await send('Page.navigate', { url: `http://127.0.0.1:3468/canvas/${process.argv[2] || 'proj_mscjyl35965edc3d'}` });
  await sleep(9000);

  // 找到 Agent 聊天 textarea（面板默认展开）
  const hasInput = await evaluate(`!![...document.querySelectorAll('textarea')].find((t) => (t.placeholder || '').includes('@ 可引用图片'))`);
  console.log('chat textarea:', hasInput);
  if (!hasInput) { console.log('MENTION FAIL'); process.exit(2); }

  // 输入 @
  await evaluate(`(() => {
    const ta = [...document.querySelectorAll('textarea')].find((t) => (t.placeholder || '').includes('@ 可引用图片'));
    ta.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    setter.call(ta, '@');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.setSelectionRange(1, 1);
    return 1;
  })()`);
  await sleep(1500);
  const menu = await evaluate(`(() => {
    const text = document.body.textContent || '';
    const popup = [...document.querySelectorAll('button, [role="option"], [role="listbox"] *')].filter((el) => (el.textContent || '').includes('图片') && el.getBoundingClientRect().width > 0);
    return { hasMenuText: text.includes('已选中') || text.includes('图片节点') || popup.length > 0, popupCount: popup.length };
  })()`);
  console.log('mention menu:', JSON.stringify(menu));

  // 点第一个候选
  const picked = await evaluate(`(() => {
    const items = [...document.querySelectorAll('button')].filter((b) => (b.textContent || '').includes('图片') && b.getBoundingClientRect().width > 0 && b.getBoundingClientRect().top > 300);
    if (!items.length) return 'no-item';
    items[0].click();
    return 'picked';
  })()`);
  console.log('pick:', picked);
  await sleep(1200);
  const chip = await evaluate(`(() => {
    const ta = [...document.querySelectorAll('textarea')].find((t) => (t.placeholder || '').includes('@ 可引用图片'));
    const chips = [...document.querySelectorAll('[class*="chip"], [class*="mention"], span')].filter((el) => /^@?图片\\d+$/.test((el.textContent || '').trim()));
    return { value: ta ? ta.value : '', chipLike: chips.length > 0 };
  })()`);
  console.log('chip:', JSON.stringify(chip));
  await shot('mention-verify.png');

  ws.close();
  chrome.kill();
  const ok = hasInput && menu.hasMenuText && picked === 'picked' && (chip.value.includes('@') || chip.chipLike);
  console.log(ok ? 'MENTION PASS' : 'MENTION FAIL');
  if (!ok) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
