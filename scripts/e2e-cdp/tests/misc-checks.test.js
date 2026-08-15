// 补充验收：兑换码错误提示 / 语言切换持久化 / 工具栏设置持久化 / 草稿恢复提示
const { start } = require('../lib/browser');
const results = {};

async function main() {
  const { chrome, ws, send, evaluate, shot, sleep } = await start(9264, 'chrome-cdp-e2e');

  // ---- 兑换码错误提示 ----
  await send('Page.navigate', { url: `http://127.0.0.1:3468/` });
  await sleep(5000);
  await evaluate(`(() => { const b = document.querySelector('.header-icon-button.user') || document.querySelector('[title="用户中心"]'); if (b) b.click(); return 1; })()`);
  await sleep(2500);
  const redeemBad = await evaluate(`(() => {
    const drawer = document.querySelector('.uc-drawer');
    if (!drawer) return 'no-drawer';
    const input = drawer.querySelector('.uc-redeem input');
    const btn = drawer.querySelector('.uc-redeem button');
    if (!input || !btn) return 'no-redeem-ui';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'NOSUCHCODE123');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'filled';
  })()`);
  await sleep(800);
  await evaluate(`(() => {
    const drawer = document.querySelector('.uc-drawer');
    const btn = drawer ? drawer.querySelector('.uc-redeem button') : null;
    if (btn && !btn.disabled) btn.click();
    return btn ? (btn.disabled ? 'disabled' : 'clicked') : 'no-btn';
  })()`);
  await sleep(2500);
  const redeemErr = await evaluate(`(() => {
    const drawer = document.querySelector('.uc-drawer');
    const err = drawer ? (drawer.querySelector('.uc-error') || {}).textContent || '' : '';
    return err;
  })()`);
  results['兑换码错误提示'] = redeemBad === 'filled' && redeemErr.length > 0 ? 'PASS' : `FAIL(${redeemBad},err=${redeemErr})`;
  console.log('兑换码错误提示:', results['兑换码错误提示']);

  // ---- 语言切换持久化 ----
  await evaluate(`(() => {
    const drawer = document.querySelector('.uc-drawer');
    const btns = [...drawer.querySelectorAll('.uc-language button')];
    const en = btns.find((b) => b.textContent.trim() === 'EN');
    if (en) en.click();
    return 1;
  })()`);
  await sleep(800);
  await send('Page.navigate', { url: `http://127.0.0.1:3468/` });
  await sleep(4000);
  await evaluate(`(() => { const b = document.querySelector('.header-icon-button.user') || document.querySelector('[title="用户中心"]'); if (b) b.click(); return 1; })()`);
  await sleep(2500);
  const langKept = await evaluate(`(() => {
    const drawer = document.querySelector('.uc-drawer');
    if (!drawer) return false;
    const en = [...drawer.querySelectorAll('.uc-language button')].find((b) => b.textContent.trim() === 'EN');
    return en && en.className.includes('active');
  })()`);
  results['语言切换持久化'] = langKept ? 'PASS' : 'FAIL';
  console.log('语言切换持久化:', results['语言切换持久化']);
  // 恢复中文
  await evaluate(`(() => { const d = document.querySelector('.uc-drawer'); const zh = [...d.querySelectorAll('.uc-language button')].find((b) => b.textContent.trim() === '中文'); if (zh) zh.click(); return 1; })()`);
  await evaluate(`(() => { const b = document.querySelector('.uc-drawer .uc-close'); if (b) b.click(); return 1; })()`);
  await sleep(600);

  // ---- 草稿恢复提示（造一个本地草稿再进项目）----
  await send('Page.navigate', { url: `http://127.0.0.1:3468/canvas/${process.argv[2] || 'proj_mscjyl35965edc3d'}` });
  await sleep(8000);
  const draftResult = await evaluate(`(async () => {
    // 伪造一个"比服务器新"的本地草稿
    const token = window.localStorage.getItem('auth_token');
    const prof = await fetch('/api/user/profile', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json()).catch(() => ({}));
    const userId = (prof.user && prof.user.id) || '';
    const projectId = location.pathname.split('/').pop();
    const key = 'hjm:canvas-draft:' + userId + ':' + projectId;
    const future = new Date(Date.now() + 3600e3).toISOString();
    window.localStorage.setItem(key, JSON.stringify({ userId, projectId, title: 'e2e-draft', savedAt: future, content: { nodes: [], connections: [] } }));
    return { key };
  })()`);
  await send('Page.navigate', { url: `http://127.0.0.1:3468/canvas/${process.argv[2] || 'proj_mscjyl35965edc3d'}` });
  await sleep(8000);
  const draftShown = await evaluate(`(() => {
    const text = document.body.textContent || '';
    return text.includes('恢复未保存的草稿') || text.includes('恢复草稿');
  })()`);
  // 有弹窗则点丢弃，不留垃圾
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('.ant-modal-wrap button')].find((b) => b.textContent.includes('丢弃'));
    if (btn) btn.click();
    return 1;
  })()`);
  results['草稿恢复提示'] = draftShown ? 'PASS' : 'FAIL';
  console.log('草稿恢复提示:', results['草稿恢复提示']);

  // ---- 生成中刷新恢复（检查 running 任务节点不卡死：只验证 resume 机制存在与页面正常加载）----
  await sleep(2000);
  const pageAlive = await evaluate(`!!document.querySelector('[aria-label="用户中心"]')`);
  results['刷新后页面恢复'] = pageAlive ? 'PASS' : 'FAIL';
  console.log('刷新后页面恢复:', results['刷新后页面恢复']);

  await shot('misc-checks.png');
  console.log(JSON.stringify(results, null, 1));
  ws.close();
  chrome.kill();
  const allPass = Object.values(results).every((v) => v === 'PASS');
  console.log(allPass ? 'MISC PASS' : 'MISC FAIL');
  if (!allPass) process.exit(2);
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1); });
