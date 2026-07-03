async page => {
  const originMatch = String(page.url()).match(/^(https?:\/\/[^/]+)/);
  const baseUrl = originMatch ? originMatch[1] : 'http://127.0.0.1:3456';
  const screenshotDir = 'docs/design-references/admin-2026-06-25';
  const results = [];

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl + '/admin/login?admin-pages-smoke=seed', { waitUntil: 'domcontentloaded', timeout: 20000 });

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
    await page.goto(baseUrl + item.route + '?admin-pages-smoke=1', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(850);

    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    if (!bodyText.includes(item.expected)) {
      throw new Error(item.slug + ' missing expected text: ' + item.expected);
    }
    if (bodyText.includes('404') || bodyText.includes('Internal Server Error')) {
      throw new Error(item.slug + ' rendered an error state');
    }

    const metrics = await page.evaluate(() => {
      const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const title = document.querySelector('header.admin-source-topbar h1, header div.text-lg');
      const buttons = Array.from(document.querySelectorAll('button'));
      const visibleButtons = buttons.filter(isVisible);
      const svgCount = document.querySelectorAll('svg').length;
      const tableCount = document.querySelectorAll('table').length;
      const cardCount = document.querySelectorAll('[class*="rounded-3xl"][class*="bg-white"]').length;
      const titleStyle = title ? getComputedStyle(title) : null;
      const buttonRects = visibleButtons.map((button) => {
        const rect = button.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
          text: (button.innerText || button.getAttribute('title') || '').trim().slice(0, 16),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          color: style.color,
          background: style.backgroundColor,
          borderColor: style.borderColor
        };
      });
      const rowHeights = Array.from(document.querySelectorAll('tbody tr'))
        .filter(isVisible)
        .slice(0, 8)
        .map((row) => Math.round(row.getBoundingClientRect().height));
      const actionCells = Array.from(document.querySelectorAll('td:last-child'))
        .filter((cell) => cell.querySelector('button') && isVisible(cell))
        .slice(0, 8)
        .map((cell) => {
          const rect = cell.getBoundingClientRect();
          const style = getComputedStyle(cell);
          return {
            width: Math.round(rect.width),
            background: style.backgroundColor,
            position: style.position
          };
        });
      const oldMintButtons = buttonRects.filter((button) => {
        return button.background.includes('94, 223') || button.background.includes('92, 221');
      });
      return {
        title: title ? title.textContent.trim() : '',
        titleColor: titleStyle ? titleStyle.color : '',
        titleWeight: titleStyle ? titleStyle.fontWeight : '',
        buttonCount: buttons.length,
        visibleButtonCount: visibleButtons.length,
        buttonSamples: buttonRects.slice(0, 12),
        rowHeights,
        actionCells,
        oldMintButtonCount: oldMintButtons.length,
        svgCount,
        tableCount,
        cardCount
      };
    });

    const issues = [];
    if (!metrics.title || !/^rgb\((2, 6, 23|15, 23, 42)\)$/.test(metrics.titleColor)) {
      issues.push(`title color is not dark enough: ${metrics.titleColor || 'missing'}`);
    }
    if (Number(metrics.titleWeight) < 800) {
      issues.push(`title weight too light: ${metrics.titleWeight}`);
    }
    if (metrics.oldMintButtonCount > 0) {
      issues.push(`old mint buttons detected: ${metrics.oldMintButtonCount}`);
    }
    if (metrics.rowHeights.some((height) => height > 92)) {
      issues.push(`table row too tall: ${metrics.rowHeights.join(',')}`);
    }
    if (metrics.actionCells.some((cell) => cell.position === 'sticky' && cell.width > 245)) {
      issues.push(`sticky action column too wide: ${JSON.stringify(metrics.actionCells)}`);
    }
    if (issues.length > 0) {
      throw new Error(`${item.slug} visual audit failed: ${issues.join('; ')}`);
    }

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
