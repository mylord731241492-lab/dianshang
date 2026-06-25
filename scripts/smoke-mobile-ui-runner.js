async page => {
  const baseUrlMatch = String(page.url()).match(/^(https?:\/\/[^/]+)/);
  const baseUrl = baseUrlMatch ? baseUrlMatch[1] : 'http://127.0.0.1:3456';
  const screenshotDir = 'docs/design-references/mobile-2026-06-25';
  const results = [];
  const consoleErrors = [];
  const badResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if (response.status() >= 400 && !url.includes('/favicon')) {
      badResponses.push({ status: response.status(), url });
    }
  });

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
    const metrics = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const scrollWidth = document.documentElement.scrollWidth;
      const text = document.body.innerText || '';
      return {
        width,
        scrollWidth,
        horizontalOverflow: Math.max(0, scrollWidth - width),
        titleBrokenIntoChars: text.includes('电\n商\n全\n流\n程\n工\n作\n台'),
        hasVueFlow: !!document.querySelector('.vue-flow'),
        nodeCount: document.querySelectorAll('.vue-flow__node').length
      };
    });
    if (metrics.titleBrokenIntoChars) {
      throw new Error(`${name} title is broken into single characters`);
    }
    if (name === 'home' && metrics.horizontalOverflow > 8) {
      throw new Error(`${name} has unexpected horizontal overflow: ${metrics.horizontalOverflow}`);
    }
    if (name === 'canvas' && (!metrics.hasVueFlow || metrics.nodeCount < 1)) {
      throw new Error(`${name} missing Vue Flow nodes on mobile: ${JSON.stringify(metrics)}`);
    }
    await page.screenshot({
      path: `${screenshotDir}/${name}-mobile-390x844.png`,
      fullPage: false
    });
    results.push({ page: name, route, ok: true, expectedText, metrics });
  }

  await capture('home', '/?mobile-smoke=home', '电商全流程工作台');
  await capture('template-image', '/template-image?mobile-smoke=template', '模板');
  await capture('canvas', '/canvas?mobile-smoke=canvas', '新增节点');
  await capture('user-redeem', '/user/redeem?mobile-smoke=redeem', '兑换码提交');
  await capture('admin-dashboard', '/admin/dashboard?mobile-smoke=dashboard', '控制台 Dashboard');
  await capture('admin-api-providers', '/admin/api-providers?mobile-smoke=api-providers', 'API 线路管理');
  await capture('admin-template-workflows', '/admin/template-workflows?mobile-smoke=template-workflows', '模板工作流');

  const fatalConsoleErrors = consoleErrors.filter((text) => !text.includes('Local workflow auto save skipped'));
  if (fatalConsoleErrors.length > 0 || badResponses.length > 0) {
    throw new Error(`mobile smoke console or response errors: ${JSON.stringify({ fatalConsoleErrors, badResponses })}`);
  }

  return { ok: true, baseUrl, results, consoleErrors: fatalConsoleErrors, badResponses };
}
