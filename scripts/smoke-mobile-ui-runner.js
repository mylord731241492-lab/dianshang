async page => {
  const baseUrl = 'http://127.0.0.1:3456';
  const screenshotDir = 'docs/design-references/mobile-2026-06-25';
  const results = [];

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl + '/?mobile-smoke=auth-seed');
  await page.waitForLoadState('load');
  await page.evaluate(async () => {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const login = await response.json();
    if (!login.token || !login.user) {
      throw new Error('admin login failed for mobile smoke');
    }
    localStorage.setItem('auth_token', login.token);
    localStorage.setItem('auth_user', JSON.stringify(login.user));
  });

  async function capture(name, route, expectedText) {
    await page.goto(baseUrl + route);
    await page.waitForLoadState('load');
    await page.waitForTimeout(900);
    const text = await page.locator('body').innerText();
    if (!text.includes(expectedText)) {
      throw new Error(`${name} missing text: ${expectedText}`);
    }
    if (text.includes('404') || text.includes('Internal Server Error')) {
      throw new Error(`${name} rendered an error state`);
    }
    await page.screenshot({
      path: `${screenshotDir}/${name}-mobile-390x844.png`,
      fullPage: false
    });
    results.push({ page: name, route, ok: true, expectedText });
  }

  await capture('home', '/?mobile-smoke=home', '电商全流程工作台');
  await capture('template-image', '/template-image?mobile-smoke=template', '模板');
  await capture('canvas', '/canvas?mobile-smoke=canvas', '新增节点');
  await capture('user-redeem', '/user/redeem?mobile-smoke=redeem', '兑换码提交');
  await capture('admin-dashboard', '/admin/dashboard?mobile-smoke=dashboard', '控制台 Dashboard');
  await capture('admin-api-providers', '/admin/api-providers?mobile-smoke=api-providers', 'API 线路管理');
  await capture('admin-template-workflows', '/admin/template-workflows?mobile-smoke=template-workflows', '模板工作流');

  return results;
}
