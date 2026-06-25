async page => {
  const originMatch = String(page.url()).match(/^(https?:\/\/[^/]+)/);
  const baseUrl = originMatch ? originMatch[1] : 'http://127.0.0.1:3456';
  const results = [];

  async function login() {
    await page.goto(baseUrl + '/?user-center-layout-smoke=auth-seed');
    const loginResult = await page.evaluate(async () => {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });
      return await response.json();
    });
    if (!loginResult.token || !loginResult.user) {
      throw new Error('user center layout smoke login failed');
    }
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
    }, loginResult);
  }

  async function pageMetrics() {
    return await page.evaluate(() => {
      const shell = document.querySelector('#app .mx-auto.flex.h-full');
      const main = document.querySelector('#app main.flex-1');
      const shellRect = shell ? shell.getBoundingClientRect() : null;
      const mainStyle = main ? getComputedStyle(main) : null;
      return {
        bodyClass: document.body.className,
        shellWidth: shellRect ? Math.round(shellRect.width) : 0,
        mainDisplay: mainStyle ? mainStyle.display : '',
        mainColumns: mainStyle ? mainStyle.gridTemplateColumns : '',
        brokenImages: Array.from(document.images).filter(image => image.complete && image.naturalWidth === 0).length,
        avatarFallbacks: document.querySelectorAll('.uc-avatar-fallback').length,
        text: document.body.innerText
      };
    });
  }

  await login();

  await page.setViewportSize({ width: 1440, height: 900 });
  const desktopPages = [
    {
      name: 'user-center',
      route: '/user/center',
      screenshot: 'docs/design-references/frontend-2026-06-25/user-center-desktop-1440x900.png',
      expected: '用户中心'
    },
    {
      name: 'user-records',
      route: '/user/records',
      screenshot: 'docs/design-references/frontend-2026-06-25/user-records-bridge-desktop-1440x900.png',
      expected: '真实记录'
    },
    {
      name: 'user-redeem',
      route: '/user/redeem',
      screenshot: 'docs/design-references/frontend-2026-06-25/user-redeem-bridge-desktop-1440x900.png',
      expected: '兑换码提交'
    }
  ];

  for (const item of desktopPages) {
    await page.goto(baseUrl + item.route + '?layout-smoke=desktop');
    await page.waitForLoadState('load');
    await page.waitForTimeout(900);
    const metrics = await pageMetrics();
    if (!metrics.text.includes(item.expected)) {
      throw new Error(`${item.name} missing expected text: ${item.expected}`);
    }
    if (!metrics.bodyClass.includes('uc-user-page')) {
      throw new Error(`${item.name} did not enable user page class`);
    }
    if (metrics.shellWidth < 900) {
      throw new Error(`${item.name} desktop shell is still too narrow: ${metrics.shellWidth}`);
    }
    if (metrics.mainDisplay !== 'grid') {
      throw new Error(`${item.name} desktop main did not become grid layout`);
    }
    if (metrics.brokenImages > 0 && metrics.avatarFallbacks < 1) {
      throw new Error(`${item.name} has broken images without avatar fallback`);
    }
    await page.screenshot({ path: item.screenshot, fullPage: false });
    results.push({ page: item.name, viewport: 'desktop', ok: true, metrics });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl + '/user/center?layout-smoke=mobile');
  await page.waitForLoadState('load');
  await page.waitForTimeout(900);
  const mobileMetrics = await pageMetrics();
  if (!mobileMetrics.text.includes('用户中心')) {
    throw new Error('mobile user center missing expected text');
  }
  if (mobileMetrics.shellWidth > 430) {
    throw new Error(`mobile user center shell became too wide: ${mobileMetrics.shellWidth}`);
  }
  if (mobileMetrics.brokenImages > 0 && mobileMetrics.avatarFallbacks < 1) {
    throw new Error('mobile user center has broken images without avatar fallback');
  }
  await page.screenshot({
    path: 'docs/design-references/mobile-2026-06-25/user-center-mobile-390x844.png',
    fullPage: false
  });
  results.push({ page: 'user-center', viewport: 'mobile', ok: true, metrics: mobileMetrics });

  return results;
}
