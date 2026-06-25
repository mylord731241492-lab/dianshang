async page => {
  const baseUrl = 'http://127.0.0.1:3456';
  const screenshotDir = 'docs/design-references/admin-2026-06-25';
  const results = [];

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl + '/admin/login?admin-pages-smoke=seed');
  await page.waitForLoadState('load');

  const loginResult = await page.evaluate(async () => {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    return await response.json();
  });

  if (!loginResult.token || !loginResult.user) {
    throw new Error('admin pages smoke login failed');
  }

  await page.evaluate(({ token, user }) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }, loginResult);

  const pages = [
    { slug: 'dashboard', route: '/admin/dashboard', expected: '控制台 Dashboard' },
    { slug: 'users', route: '/admin/users', expected: '用户管理' },
    { slug: 'orders', route: '/admin/orders', expected: '订单管理' },
    { slug: 'logs', route: '/admin/logs', expected: '消费日志' },
    { slug: 'redeem-codes', route: '/admin/redeem-codes', expected: '兑换码管理' },
    { slug: 'api-providers', route: '/admin/api-providers', expected: 'API 线路管理' },
    { slug: 'model-prices', route: '/admin/model-prices', expected: '模型价格' },
    { slug: 'generate-tasks', route: '/admin/generate-tasks', expected: '任务监控' },
    { slug: 'template-workflows', route: '/admin/template-workflows', expected: '模板工作流' },
    { slug: 'settings', route: '/admin/settings', expected: '系统设置' }
  ];

  for (const item of pages) {
    await page.goto(baseUrl + item.route + '?admin-pages-smoke=1');
    await page.waitForLoadState('load');
    await page.waitForTimeout(850);

    const bodyText = await page.locator('body').innerText();
    if (!bodyText.includes(item.expected)) {
      throw new Error(item.slug + ' missing expected text: ' + item.expected);
    }
    if (bodyText.includes('404') || bodyText.includes('Internal Server Error')) {
      throw new Error(item.slug + ' rendered an error state');
    }

    const metrics = await page.evaluate(() => {
      const title = document.querySelector('header div.text-lg');
      const buttons = Array.from(document.querySelectorAll('button'));
      const svgCount = document.querySelectorAll('svg').length;
      const tableCount = document.querySelectorAll('table').length;
      const cardCount = document.querySelectorAll('[class*="rounded-3xl"][class*="bg-white"]').length;
      const titleStyle = title ? getComputedStyle(title) : null;
      return {
        title: title ? title.textContent.trim() : '',
        titleColor: titleStyle ? titleStyle.color : '',
        titleWeight: titleStyle ? titleStyle.fontWeight : '',
        buttonCount: buttons.length,
        svgCount,
        tableCount,
        cardCount
      };
    });

    await page.screenshot({
      path: `${screenshotDir}/full-${item.slug}-desktop-1440x900.png`,
      fullPage: false
    });

    results.push({
      page: item.slug,
      route: item.route,
      ok: true,
      screenshot: `${screenshotDir}/full-${item.slug}-desktop-1440x900.png`,
      metrics
    });
  }

  return results;
}
