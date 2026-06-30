async page => {
  const baseUrl = 'http://127.0.0.1:5173';
  const screenshotDir = 'docs/design-references/source-frontend-2026-06-26';
  const results = [];
  const consoleErrors = [];
  const badResponses = [];
  const expectedResponses = [];
  const badStaticResponses = [];
  let currentStep = 'bootstrap';
  const stamp = Date.now();
  const registerUser = {
    username: `sourceSmoke${String(stamp).slice(-7)}`,
    email: `source-smoke-${stamp}@local.test`,
    password: 'test123456'
  };

  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (
        !text.includes('favicon') &&
        !text.includes('Statsig') &&
        !text.includes('Failed to load resource: the server responded with a status of 404') &&
        !(currentStep.startsWith('unauth-') && text.includes('Failed to load resource: the server responded with a status of 401'))
      ) {
        consoleErrors.push(text);
      }
    }
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/') && response.status() >= 400) {
      const item = { step: currentStep, url, status: response.status() };
      if (isExpectedApiFailure(url, response.status(), currentStep)) {
        expectedResponses.push(item);
      } else {
        badResponses.push(item);
      }
    } else if (response.status() >= 400 && !url.includes('/favicon')) {
      badStaticResponses.push({ url, status: response.status() });
    }
  });

  function isExpectedApiFailure(url, status, step) {
    return step.startsWith('unauth-') &&
      status === 401 &&
      (
        url.includes('/api/user/generations') ||
        url.includes('/api/user/profile') ||
        url.includes('/api/user/balance-logs') ||
        url.includes('/api/user/api-status')
      );
  }

  async function ensure(condition, message) {
    if (!condition) {
      throw new Error(message);
    }
  }

  async function visibleMetrics() {
    return await page.evaluate(() => ({
      path: location.pathname,
      title: document.querySelector('h1')?.textContent || '',
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      text: document.body.innerText.slice(0, 500)
    }));
  }

  async function waitReady() {
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(300);
  }

  async function clickUnique(locator, label) {
    const count = await locator.count();
    if (count !== 1) {
      throw new Error(`${label} expected one target, got ${count}`);
    }
    await locator.click();
  }

  async function fillUnique(locator, value, label) {
    const count = await locator.count();
    if (count !== 1) {
      throw new Error(`${label} expected one target, got ${count}`);
    }
    await locator.fill(value);
  }

  async function expectUnauthPage(path, waitText, expectedText, screenshotName) {
    currentStep = `unauth-${path.replace(/^\//, '').replace(/\//g, '-')}`;
    await page.goto(baseUrl + path + '?source-frontend-ui-smoke=unauth');
    await waitReady();
    await page.waitForSelector(`text=${waitText}`, { timeout: 10000 });
    const metrics = await visibleMetrics();
    await ensure(metrics.horizontalOverflow === 0, `${path} unauth horizontal overflow`);
    await ensure(metrics.text.includes(expectedText), `${path} did not show expected unauth message`);
    await page.screenshot({
      path: `${screenshotDir}/${screenshotName}`,
      fullPage: true
    });
    results.push({ step: currentStep, ok: true, metrics });
  }

  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(baseUrl + '/register?source-frontend-ui-smoke=register');
  await waitReady();
  await fillUnique(page.getByPlaceholder('请输入用户名'), registerUser.username, 'register username');
  await fillUnique(page.getByPlaceholder('请输入邮箱'), registerUser.email, 'register email');
  await fillUnique(page.getByPlaceholder('请输入密码'), registerUser.password, 'register password');
  await clickUnique(page.locator('button').filter({ hasText: '发送验证码' }), 'register send code');
  await page.waitForTimeout(700);
  const codeValue = await page.getByPlaceholder('请输入验证码').inputValue();
  await ensure(Boolean(codeValue.trim()), 'register code was not auto-filled');
  await clickUnique(page.locator('button').filter({ hasText: '注册' }), 'register submit');
  await page.waitForTimeout(1200);
  await ensure(page.url().includes('/gallery'), 'register did not redirect to gallery');
  const registeredUser = await page.evaluate(() => {
    const raw = localStorage.getItem('auth_user');
    return raw ? JSON.parse(raw) : null;
  });
  await ensure(registeredUser && registeredUser.id, 'registered user session missing');
  await page.screenshot({
    path: `${screenshotDir}/register-success-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'register', ok: true, username: registerUser.username, userId: registeredUser.id });

  const cleanupResult = await page.evaluate(async ({ userId }) => {
    const adminResponse = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const adminLogin = await adminResponse.json();
    if (!adminLogin.token) {
      throw new Error('admin login for source smoke cleanup failed');
    }
    const deleteResponse = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminLogin.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'source frontend smoke cleanup' })
    });
    const deleted = await deleteResponse.json();
    const permanentResponse = await fetch(`/api/admin/recycle-bin/users/${encodeURIComponent(userId)}/permanent`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${adminLogin.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: 'source frontend smoke cleanup' })
    });
    const permanent = await permanentResponse.json();
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    return { deleted, permanent };
  }, { userId: registeredUser.id });
  await ensure(cleanupResult.deleted.success !== false, 'registered user soft delete failed');
  await ensure(cleanupResult.permanent.success !== false, 'registered user permanent cleanup failed');
  results.push({ step: 'register-cleanup', ok: true, userId: registeredUser.id });

  await expectUnauthPage('/gallery', '图库历史', '请先登录', 'unauth-gallery-desktop-1440x900.png');
  await expectUnauthPage('/user/center', '用户中心', '请先登录', 'unauth-user-center-desktop-1440x900.png');
  await expectUnauthPage('/user/records', '生成记录', '请先登录', 'unauth-records-desktop-1440x900.png');
  await expectUnauthPage('/user/redeem', '兑换码', '请先登录', 'unauth-redeem-desktop-1440x900.png');
  await ensure(expectedResponses.length >= 4, 'unauth API failures were not observed as expected');

  currentStep = 'login';
  await page.goto(baseUrl + '/login?source-frontend-ui-smoke=login');
  await waitReady();
  await fillUnique(page.getByPlaceholder('请输入用户名'), 'admin', 'login username');
  await fillUnique(page.getByPlaceholder('请输入密码'), 'admin123', 'login password');
  await clickUnique(page.locator('button').filter({ hasText: '登录' }), 'login button');
  await page.waitForTimeout(1200);
  await ensure(page.url().includes('/gallery'), 'login did not redirect to gallery');
  results.push({ step: 'login', ok: true, url: page.url() });

  currentStep = 'home-index-user-navigation';
  await page.goto(baseUrl + '/?source-frontend-ui-smoke=home-index');
  await waitReady();
  await page.waitForSelector('text=前端迁移索引', { timeout: 10000 });
  const homeMigrationStats = await page.evaluate(() => {
    const summaryValues = Array.from(document.querySelectorAll('.migration-summary dt')).map((item) => item.textContent?.trim() || '');
    const phaseTitles = Array.from(document.querySelectorAll('.phase-item h2')).map((item) => item.textContent?.trim() || '');
    return { summaryValues, phaseTitles };
  });
  await ensure(
    homeMigrationStats.summaryValues.includes('21') &&
      homeMigrationStats.summaryValues.includes('0') &&
      homeMigrationStats.summaryValues.includes('21'),
    `home migration stats mismatch: ${JSON.stringify(homeMigrationStats)}`
  );
  await ensure(
    homeMigrationStats.phaseTitles.includes('前台源码化') &&
      homeMigrationStats.phaseTitles.includes('旧画布保留') &&
      homeMigrationStats.phaseTitles.includes('后台迁移'),
    `home phase board missing: ${JSON.stringify(homeMigrationStats)}`
  );
  await page.screenshot({
    path: `${screenshotDir}/home-migration-index-desktop-1440x900.png`,
    fullPage: true
  });
  await clickUnique(page.locator('.migration-links a[href="/user/center"]'), 'home user center source link');
  await page.waitForTimeout(700);
  await ensure(page.url().includes('/user/center'), 'home migration index did not navigate to user center');
  await page.waitForSelector('text=用户中心', { timeout: 10000 });
  const userCenterMetrics = await visibleMetrics();
  await ensure(userCenterMetrics.horizontalOverflow === 0, 'user center has horizontal overflow');
  await clickUnique(page.locator('.user-actions button').filter({ hasText: '图库历史' }), 'user center gallery action');
  await page.waitForTimeout(700);
  await ensure(page.url().includes('/gallery'), 'user center gallery action did not navigate to gallery');
  results.push({ step: 'home-index-user-navigation', ok: true, metrics: userCenterMetrics });

  currentStep = 'canvas-legacy-source';
  await page.goto(baseUrl + '/canvas?source-frontend-ui-smoke=canvas');
  await waitReady();
  await page.waitForSelector('text=旧画布', { timeout: 10000 });
  const canvasLegacyMetrics = await visibleMetrics();
  await ensure(canvasLegacyMetrics.horizontalOverflow === 0, 'canvas legacy source has horizontal overflow');
  const canvasLegacyCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.canvas-legacy-status article').length,
    iframeCount: document.querySelectorAll('.canvas-legacy-frame').length,
    legacyLinks: Array.from(document.querySelectorAll('a')).filter((link) => link.textContent?.includes('新窗口打开旧画布')).length,
    text: document.body.innerText
  }));
  await ensure(canvasLegacyCounts.statCards === 3, `canvas legacy stat card mismatch: ${JSON.stringify(canvasLegacyCounts)}`);
  await ensure(canvasLegacyCounts.iframeCount === 0, `canvas legacy iframe should not exist: ${JSON.stringify(canvasLegacyCounts)}`);
  await ensure(canvasLegacyCounts.legacyLinks >= 1, `canvas legacy new window link missing: ${JSON.stringify(canvasLegacyCounts)}`);
  await ensure(canvasLegacyCounts.text.includes('本地保存必须在新窗口旧画布中使用'), 'canvas legacy file permission boundary missing');
  await ensure(canvasLegacyCounts.text.includes('不重启新画布'), 'canvas legacy source did not show boundary text');
  await page.screenshot({
    path: `${screenshotDir}/canvas-legacy-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'canvas-legacy-source', ok: true, counts: canvasLegacyCounts, metrics: canvasLegacyMetrics });

  currentStep = 'gallery-search-refresh';
  await page.goto(baseUrl + '/gallery?source-frontend-ui-smoke=gallery');
  await waitReady();
  await page.waitForSelector('text=图库历史', { timeout: 10000 });
  const gallerySearch = page.getByPlaceholder('搜索提示词 / 模型');
  await fillUnique(gallerySearch, 'simple', 'gallery search');
  await page.waitForTimeout(400);
  const filteredGalleryCards = await page.locator('.gallery-card').count();
  await ensure(filteredGalleryCards >= 1, 'gallery search did not keep any matching card');
  await clickUnique(page.locator('.gallery-filters button').filter({ hasText: '刷新' }), 'gallery refresh');
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${screenshotDir}/gallery-search-click-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'gallery-search-refresh', ok: true, cards: filteredGalleryCards, metrics: await visibleMetrics() });

  currentStep = 'template-switch-fill';
  await page.goto(baseUrl + '/template-image?source-frontend-ui-smoke=template');
  await waitReady();
  await page.waitForSelector('text=模板生图工作台', { timeout: 10000 });
  const beforeTemplateTitle = await page.locator('.template-hero-panel h2').innerText();
  const whiteBgTemplate = page.locator('.template-category button').filter({ hasText: '白底图' });
  await clickUnique(whiteBgTemplate, 'template white background button');
  await page.waitForTimeout(300);
  const afterTemplateTitle = await page.locator('.template-hero-panel h2').innerText();
  await ensure(afterTemplateTitle !== beforeTemplateTitle, 'template click did not switch selected template');
  const promptBox = page.locator('.form-grid textarea');
  await fillUnique(promptBox, 'source frontend smoke prompt, no generation', 'template prompt box');
  await page.screenshot({
    path: `${screenshotDir}/template-switch-fill-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'template-switch-fill', ok: true, selected: afterTemplateTitle, metrics: await visibleMetrics() });

  currentStep = 'records-search-refresh';
  await page.goto(baseUrl + '/user/records?source-frontend-ui-smoke=records');
  await waitReady();
  await page.waitForSelector('text=生成记录', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索提示词 / 模型'), 'simple', 'records search');
  await page.waitForTimeout(400);
  const filteredRecordImages = await page.locator('.records-image-list article').count();
  await ensure(filteredRecordImages >= 1, 'records search did not keep any matching record');
  await clickUnique(page.locator('.records-toolbar button').filter({ hasText: '刷新' }), 'records refresh');
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${screenshotDir}/records-search-refresh-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'records-search-refresh', ok: true, records: filteredRecordImages, metrics: await visibleMetrics() });

  currentStep = 'redeem-fill-refresh';
  await page.goto(baseUrl + '/user/redeem?source-frontend-ui-smoke=redeem');
  await waitReady();
  await page.waitForSelector('text=兑换码', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('请输入兑换码'), 'DO_NOT_SUBMIT_SMOKE', 'redeem code input');
  await clickUnique(page.locator('.redeem-refresh'), 'redeem refresh');
  await page.waitForTimeout(500);
  const redeemBalance = await page.locator('.redeem-balance strong').innerText();
  await ensure(Boolean(redeemBalance.trim()), 'redeem balance missing after refresh click');
  await page.screenshot({
    path: `${screenshotDir}/redeem-fill-refresh-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'redeem-fill-refresh', ok: true, balance: redeemBalance, metrics: await visibleMetrics() });

  currentStep = 'mobile-records';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl + '/user/records?source-frontend-ui-smoke=mobile-records');
  await waitReady();
  await page.waitForSelector('text=生成记录', { timeout: 10000 });
  const mobileRecordsMetrics = await visibleMetrics();
  await ensure(mobileRecordsMetrics.horizontalOverflow === 0, `mobile records overflow: ${mobileRecordsMetrics.horizontalOverflow}`);
  await page.screenshot({
    path: `${screenshotDir}/records-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-records', ok: true, metrics: mobileRecordsMetrics });

  currentStep = 'mobile-redeem';
  await page.goto(baseUrl + '/user/redeem?source-frontend-ui-smoke=mobile-redeem');
  await waitReady();
  await page.waitForSelector('text=兑换码', { timeout: 10000 });
  const mobileRedeemMetrics = await visibleMetrics();
  await ensure(mobileRedeemMetrics.horizontalOverflow === 0, `mobile redeem overflow: ${mobileRedeemMetrics.horizontalOverflow}`);
  await page.screenshot({
    path: `${screenshotDir}/redeem-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-redeem', ok: true, metrics: mobileRedeemMetrics });

  currentStep = 'logout';
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl + '/user/center?source-frontend-ui-smoke=logout');
  await waitReady();
  await page.waitForSelector('text=用户中心', { timeout: 10000 });
  await clickUnique(page.locator('.user-actions button').filter({ hasText: '退出登录' }), 'user center logout');
  await page.waitForTimeout(700);
  await ensure(page.url().includes('/login'), 'logout did not navigate to login');
  const authStateAfterLogout = await page.evaluate(() => ({
    token: localStorage.getItem('auth_token'),
    user: localStorage.getItem('auth_user')
  }));
  await ensure(!authStateAfterLogout.token && !authStateAfterLogout.user, 'logout did not clear auth storage');
  await page.screenshot({
    path: `${screenshotDir}/logout-success-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'logout', ok: true, url: page.url() });

  currentStep = 'admin-login-source';
  await page.goto(baseUrl + '/admin/login?source-frontend-ui-smoke=admin-login');
  await waitReady();
  await page.waitForSelector('text=后台登录', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('请输入管理员账号'), 'admin', 'admin login username');
  await fillUnique(page.getByPlaceholder('请输入管理员密码'), 'admin123', 'admin login password');
  await clickUnique(page.locator('button').filter({ hasText: '进入后台' }), 'admin login submit');
  await page.waitForTimeout(1200);
  await ensure(page.url().includes('/admin/login'), 'admin login should stay on source page after success');
  await page.waitForSelector('text=管理员登录成功', { timeout: 10000 });
  const adminAuthState = await page.evaluate(() => ({
    token: localStorage.getItem('auth_token'),
    user: localStorage.getItem('auth_user')
  }));
  await ensure(Boolean(adminAuthState.token) && adminAuthState.user?.includes('admin'), 'admin login did not persist auth session');
  await page.screenshot({
    path: `${screenshotDir}/admin-login-success-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'admin-login-source', ok: true, url: page.url() });

  currentStep = 'admin-dashboard-source';
  await page.goto(baseUrl + '/admin/dashboard?source-frontend-ui-smoke=admin-dashboard');
  await waitReady();
  await page.waitForSelector('text=控制台 Dashboard', { timeout: 10000 });
  await page.waitForSelector('text=模型使用', { timeout: 10000 });
  const adminDashboardMetrics = await visibleMetrics();
  await ensure(adminDashboardMetrics.horizontalOverflow === 0, 'admin dashboard has horizontal overflow');
  const adminDashboardCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid article').length,
    panels: document.querySelectorAll('.admin-source-panel').length,
    rankingRows: document.querySelectorAll('.admin-table-list.ranking > div').length,
    taskRows: document.querySelectorAll('.admin-table-list.tasks > div').length
  }));
  await ensure(adminDashboardCounts.statCards === 6, `admin dashboard stat card mismatch: ${JSON.stringify(adminDashboardCounts)}`);
  await ensure(adminDashboardCounts.panels >= 4, `admin dashboard panel mismatch: ${JSON.stringify(adminDashboardCounts)}`);
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin dashboard refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-dashboard-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'admin-dashboard-source', ok: true, counts: adminDashboardCounts, metrics: adminDashboardMetrics });

  currentStep = 'admin-users-source';
  await page.goto(baseUrl + '/admin/users?source-frontend-ui-smoke=admin-users');
  await waitReady();
  await page.waitForSelector('text=用户管理', { timeout: 10000 });
  await page.waitForSelector('text=用户列表', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索用户名 / 邮箱 / 角色 / 状态'), 'admin', 'admin users search');
  await clickUnique(page.locator('.admin-users-toolbar button').filter({ hasText: '查询' }), 'admin users query');
  await page.waitForTimeout(700);
  const adminUsersMetrics = await visibleMetrics();
  await ensure(adminUsersMetrics.horizontalOverflow === 0, 'admin users has horizontal overflow');
  const adminUsersCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid.users article').length,
    rows: document.querySelectorAll('.admin-users-list article').length,
    text: document.body.innerText
  }));
  await ensure(adminUsersCounts.statCards === 5, `admin users stat card mismatch: ${JSON.stringify(adminUsersCounts)}`);
  await ensure(adminUsersCounts.rows >= 1, `admin users list is empty: ${JSON.stringify(adminUsersCounts)}`);
  await ensure(adminUsersCounts.text.includes('admin@local'), 'admin users search did not show admin account');
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin users refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-users-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'admin-users-source', ok: true, counts: adminUsersCounts, metrics: adminUsersMetrics });

  currentStep = 'admin-generate-tasks-source';
  await page.goto(baseUrl + '/admin/generate-tasks?source-frontend-ui-smoke=admin-generate-tasks');
  await waitReady();
  await page.waitForSelector('text=任务监控', { timeout: 10000 });
  await page.waitForSelector('text=生成任务列表', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索提示词 / 用户 / 模型 / 线路'), 'simple', 'admin tasks search');
  await clickUnique(page.locator('.admin-tasks-toolbar button').filter({ hasText: '查询' }), 'admin tasks query');
  await page.waitForTimeout(700);
  const adminTasksMetrics = await visibleMetrics();
  await ensure(adminTasksMetrics.horizontalOverflow === 0, 'admin generate tasks has horizontal overflow');
  const adminTasksCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid article').length,
    rows: document.querySelectorAll('.admin-tasks-list article').length,
    text: document.body.innerText
  }));
  await ensure(adminTasksCounts.statCards === 6, `admin tasks stat card mismatch: ${JSON.stringify(adminTasksCounts)}`);
  await ensure(adminTasksCounts.rows >= 1, `admin tasks list is empty: ${JSON.stringify(adminTasksCounts)}`);
  await ensure(adminTasksCounts.text.includes('gpt-image-2'), 'admin tasks search did not show image model task');
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin tasks refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-generate-tasks-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'admin-generate-tasks-source', ok: true, counts: adminTasksCounts, metrics: adminTasksMetrics });

  currentStep = 'admin-usage-logs-source';
  await page.goto(baseUrl + '/admin/logs?source-frontend-ui-smoke=admin-logs');
  await waitReady();
  await page.waitForSelector('text=消费日志', { timeout: 10000 });
  await page.waitForSelector('text=流水列表', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索备注 / 用户 ID / 类型'), '注册赠送', 'admin logs search');
  await clickUnique(page.locator('.admin-logs-toolbar button').filter({ hasText: '查询' }), 'admin logs query');
  await page.waitForTimeout(700);
  const adminLogsMetrics = await visibleMetrics();
  await ensure(adminLogsMetrics.horizontalOverflow === 0, 'admin usage logs has horizontal overflow');
  const adminLogsCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid.users article').length,
    rows: document.querySelectorAll('.admin-logs-list article').length,
    text: document.body.innerText
  }));
  await ensure(adminLogsCounts.statCards === 5, `admin logs stat card mismatch: ${JSON.stringify(adminLogsCounts)}`);
  await ensure(adminLogsCounts.rows >= 1, `admin logs list is empty: ${JSON.stringify(adminLogsCounts)}`);
  await ensure(adminLogsCounts.text.includes('注册赠送'), 'admin logs search did not show register gift log');
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin logs refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-usage-logs-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'admin-usage-logs-source', ok: true, counts: adminLogsCounts, metrics: adminLogsMetrics });

  currentStep = 'admin-orders-source';
  await page.goto(baseUrl + '/admin/orders?source-frontend-ui-smoke=admin-orders');
  await waitReady();
  await page.waitForSelector('text=订单管理', { timeout: 10000 });
  await page.waitForSelector('text=订单列表', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索订单号 / 用户 / 邮箱'), 'HJM', 'admin orders search');
  await clickUnique(page.locator('.admin-orders-toolbar button').filter({ hasText: '查询' }), 'admin orders query');
  await page.waitForTimeout(700);
  const adminOrdersMetrics = await visibleMetrics();
  await ensure(adminOrdersMetrics.horizontalOverflow === 0, 'admin orders has horizontal overflow');
  const adminOrdersCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid article').length,
    rows: document.querySelectorAll('.admin-orders-list article').length,
    text: document.body.innerText
  }));
  await ensure(adminOrdersCounts.statCards === 6, `admin orders stat card mismatch: ${JSON.stringify(adminOrdersCounts)}`);
  await ensure(adminOrdersCounts.rows >= 1, `admin orders list is empty: ${JSON.stringify(adminOrdersCounts)}`);
  await ensure(adminOrdersCounts.text.includes('HJM000001'), 'admin orders search did not show order number');
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin orders refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-orders-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({ step: 'admin-orders-source', ok: true, counts: adminOrdersCounts, metrics: adminOrdersMetrics });

  currentStep = 'admin-redeem-codes-source';
  await page.goto(baseUrl + '/admin/redeem-codes?source-frontend-ui-smoke=admin-redeem-codes');
  await waitReady();
  await page.waitForSelector('text=兑换码管理', { timeout: 10000 });
  await page.waitForSelector('text=兑换码列表', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索兑换码 / 状态 / 算力'), 'HAJIMI', 'admin redeem codes search');
  await clickUnique(page.locator('.admin-redeem-codes-toolbar button').filter({ hasText: '查询' }), 'admin redeem codes query');
  await page.waitForTimeout(700);
  const adminRedeemCodesMetrics = await visibleMetrics();
  await ensure(adminRedeemCodesMetrics.horizontalOverflow === 0, 'admin redeem codes has horizontal overflow');
  const adminRedeemCodesCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid article').length,
    rows: document.querySelectorAll('.admin-redeem-codes-list article').length,
    text: document.body.innerText
  }));
  await ensure(
    adminRedeemCodesCounts.statCards === 6,
    `admin redeem codes stat card mismatch: ${JSON.stringify(adminRedeemCodesCounts)}`
  );
  await ensure(
    adminRedeemCodesCounts.rows >= 1,
    `admin redeem codes list is empty: ${JSON.stringify(adminRedeemCodesCounts)}`
  );
  await ensure(
    adminRedeemCodesCounts.text.includes('HAJIMI2024'),
    'admin redeem codes search did not show HAJIMI2024'
  );
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin redeem codes refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-redeem-codes-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({
    step: 'admin-redeem-codes-source',
    ok: true,
    counts: adminRedeemCodesCounts,
    metrics: adminRedeemCodesMetrics
  });

  currentStep = 'admin-model-prices-source';
  await page.goto(baseUrl + '/admin/model-prices?source-frontend-ui-smoke=admin-model-prices');
  await waitReady();
  await page.waitForSelector('text=模型价格', { timeout: 10000 });
  await page.waitForSelector('text=模型价格列表', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索模型 / 线路 / 类型'), 'gpt-image-2', 'admin model prices search');
  await clickUnique(page.locator('.admin-model-prices-toolbar button').filter({ hasText: '查询' }), 'admin model prices query');
  await page.waitForTimeout(700);
  const adminModelPricesMetrics = await visibleMetrics();
  await ensure(adminModelPricesMetrics.horizontalOverflow === 0, 'admin model prices has horizontal overflow');
  const adminModelPricesCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid article').length,
    rows: document.querySelectorAll('.admin-model-prices-list article').length,
    text: document.body.innerText
  }));
  await ensure(
    adminModelPricesCounts.statCards === 6,
    `admin model prices stat card mismatch: ${JSON.stringify(adminModelPricesCounts)}`
  );
  await ensure(
    adminModelPricesCounts.rows >= 1,
    `admin model prices list is empty: ${JSON.stringify(adminModelPricesCounts)}`
  );
  await ensure(
    adminModelPricesCounts.text.includes('GPT Image 2'),
    'admin model prices search did not show GPT Image 2'
  );
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin model prices refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-model-prices-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({
    step: 'admin-model-prices-source',
    ok: true,
    counts: adminModelPricesCounts,
    metrics: adminModelPricesMetrics
  });

  currentStep = 'admin-api-providers-source';
  await page.goto(baseUrl + '/admin/api-providers?source-frontend-ui-smoke=admin-api-providers');
  await waitReady();
  await page.waitForSelector('text=API 线路', { timeout: 10000 });
  await page.waitForSelector('text=线路列表', { timeout: 10000 });
  await page.waitForSelector('text=应用官方双线路', { timeout: 10000 });
  const adminApiProviderTargetVisible = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('/images/generations') && text.includes('/images/edits') && text.includes('/responses');
  });
  await ensure(adminApiProviderTargetVisible, 'admin api providers official endpoints are missing');
  await fillUnique(page.getByPlaceholder('搜索线路 / 模型 / Base URL'), 'gpt-image-2', 'admin api providers search');
  await clickUnique(page.locator('.admin-api-providers-toolbar button').filter({ hasText: '查询' }), 'admin api providers query');
  await page.waitForTimeout(700);
  const adminApiProvidersMetrics = await visibleMetrics();
  await ensure(adminApiProvidersMetrics.horizontalOverflow === 0, 'admin api providers has horizontal overflow');
  const adminApiProvidersCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid article').length,
    rows: document.querySelectorAll('.admin-api-providers-list article').length,
    text: document.body.innerText
  }));
  await ensure(
    adminApiProvidersCounts.statCards === 6,
    `admin api providers stat card mismatch: ${JSON.stringify(adminApiProvidersCounts)}`
  );
  await ensure(
    adminApiProvidersCounts.rows >= 1,
    `admin api providers list is empty: ${JSON.stringify(adminApiProvidersCounts)}`
  );
  await ensure(
    adminApiProvidersCounts.text.includes('gpt-image-2') &&
      adminApiProvidersCounts.text.includes('/images/generations') &&
      adminApiProvidersCounts.text.includes('/images/edits') &&
      adminApiProvidersCounts.text.includes('应用官方双线路'),
    'admin api providers search did not show official dual route target'
  );
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin api providers refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-api-providers-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({
    step: 'admin-api-providers-source',
    ok: true,
    counts: adminApiProvidersCounts,
    metrics: adminApiProvidersMetrics
  });

  currentStep = 'admin-template-workflows-source';
  await page.goto(baseUrl + '/admin/template-workflows?source-frontend-ui-smoke=admin-template-workflows');
  await waitReady();
  await page.waitForSelector('text=模板工作流', { timeout: 10000 });
  await page.waitForSelector('text=模板列表', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索模板 / 分类 / 标签'), '白底图', 'admin template workflows search');
  await clickUnique(page.locator('.admin-template-workflows-toolbar button').filter({ hasText: '查询' }), 'admin template workflows query');
  await page.waitForTimeout(700);
  const adminTemplateWorkflowsMetrics = await visibleMetrics();
  await ensure(adminTemplateWorkflowsMetrics.horizontalOverflow === 0, 'admin template workflows has horizontal overflow');
  const adminTemplateWorkflowsCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid article').length,
    rows: document.querySelectorAll('.admin-template-workflows-list article').length,
    text: document.body.innerText
  }));
  await ensure(
    adminTemplateWorkflowsCounts.statCards === 6,
    `admin template workflows stat card mismatch: ${JSON.stringify(adminTemplateWorkflowsCounts)}`
  );
  await ensure(
    adminTemplateWorkflowsCounts.rows >= 1,
    `admin template workflows list is empty: ${JSON.stringify(adminTemplateWorkflowsCounts)}`
  );
  await ensure(
    adminTemplateWorkflowsCounts.text.includes('白底图') &&
      adminTemplateWorkflowsCounts.text.includes('平台') &&
      adminTemplateWorkflowsCounts.text.includes('比例'),
    'admin template workflows search did not show template summary'
  );
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin template workflows refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-template-workflows-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({
    step: 'admin-template-workflows-source',
    ok: true,
    counts: adminTemplateWorkflowsCounts,
    metrics: adminTemplateWorkflowsMetrics
  });

  currentStep = 'admin-recycle-bin-source';
  await page.goto(baseUrl + '/admin/recycle-bin?source-frontend-ui-smoke=admin-recycle-bin');
  await waitReady();
  await page.waitForSelector('text=回收站', { timeout: 10000 });
  await page.waitForSelector('text=已删除用户', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索用户名 / 邮箱 / ID / 角色'), 'deleted', 'admin recycle bin search');
  await clickUnique(page.locator('.admin-recycle-bin-toolbar button').filter({ hasText: '查询' }), 'admin recycle bin query');
  await page.waitForTimeout(700);
  const adminRecycleBinMetrics = await visibleMetrics();
  await ensure(adminRecycleBinMetrics.horizontalOverflow === 0, 'admin recycle bin has horizontal overflow');
  const adminRecycleBinCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid article').length,
    rows: document.querySelectorAll('.admin-recycle-bin-list article').length,
    empty: document.body.innerText.includes('回收站暂无已删除用户'),
    text: document.body.innerText
  }));
  await ensure(
    adminRecycleBinCounts.statCards === 6,
    `admin recycle bin stat card mismatch: ${JSON.stringify(adminRecycleBinCounts)}`
  );
  await ensure(
    adminRecycleBinCounts.rows >= 0 && (adminRecycleBinCounts.rows > 0 || adminRecycleBinCounts.empty),
    `admin recycle bin list did not render rows or empty state: ${JSON.stringify(adminRecycleBinCounts)}`
  );
  await ensure(adminRecycleBinCounts.text.includes('不恢复、不永久删除'), 'admin recycle bin did not show readonly boundary');
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin recycle bin refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-recycle-bin-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({
    step: 'admin-recycle-bin-source',
    ok: true,
    counts: adminRecycleBinCounts,
    metrics: adminRecycleBinMetrics
  });

  currentStep = 'admin-settings-source';
  await page.goto(baseUrl + '/admin/settings?source-frontend-ui-smoke=admin-settings');
  await waitReady();
  await page.waitForSelector('text=系统设置', { timeout: 10000 });
  await page.waitForSelector('text=设置列表', { timeout: 10000 });
  await fillUnique(page.getByPlaceholder('搜索设置 / 分组 / 值'), '站点', 'admin settings search');
  await clickUnique(page.locator('.admin-settings-toolbar button').filter({ hasText: '查询' }), 'admin settings query');
  await page.waitForTimeout(700);
  const adminSettingsMetrics = await visibleMetrics();
  await ensure(adminSettingsMetrics.horizontalOverflow === 0, 'admin settings has horizontal overflow');
  const adminSettingsCounts = await page.evaluate(() => ({
    statCards: document.querySelectorAll('.admin-stat-grid article').length,
    editableFields: document.querySelectorAll('.admin-settings-edit-panel input').length,
    saveButtons: Array.from(document.querySelectorAll('button')).filter((button) => button.textContent?.includes('保存设置')).length,
    rows: document.querySelectorAll('.admin-settings-list article').length,
    toolRows: document.querySelectorAll('.admin-settings-tools-list article').length,
    text: document.body.innerText
  }));
  await ensure(
    adminSettingsCounts.statCards === 6,
    `admin settings stat card mismatch: ${JSON.stringify(adminSettingsCounts)}`
  );
  await ensure(adminSettingsCounts.rows >= 1, `admin settings list is empty: ${JSON.stringify(adminSettingsCounts)}`);
  await ensure(adminSettingsCounts.editableFields >= 3, `admin settings editable pilot missing: ${JSON.stringify(adminSettingsCounts)}`);
  await ensure(adminSettingsCounts.saveButtons >= 1, `admin settings save button missing: ${JSON.stringify(adminSettingsCounts)}`);
  await ensure(adminSettingsCounts.text.includes('站点名称') && adminSettingsCounts.text.includes('保存试点'), 'admin settings did not show expected editable pilot content');
  await clickUnique(page.locator('.admin-source-actions button').filter({ hasText: '刷新' }), 'admin settings refresh');
  await page.waitForTimeout(600);
  await page.screenshot({
    path: `${screenshotDir}/admin-settings-source-desktop-1440x900.png`,
    fullPage: true
  });
  results.push({
    step: 'admin-settings-source',
    ok: true,
    counts: adminSettingsCounts,
    metrics: adminSettingsMetrics
  });

  currentStep = 'mobile-admin-dashboard';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl + '/admin/dashboard?source-frontend-ui-smoke=mobile-admin-dashboard');
  await waitReady();
  await page.waitForSelector('text=控制台 Dashboard', { timeout: 10000 });
  const mobileAdminDashboardMetrics = await visibleMetrics();
  await ensure(mobileAdminDashboardMetrics.horizontalOverflow === 0, `mobile admin dashboard overflow: ${mobileAdminDashboardMetrics.horizontalOverflow}`);
  await page.screenshot({
    path: `${screenshotDir}/admin-dashboard-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-dashboard', ok: true, metrics: mobileAdminDashboardMetrics });

  currentStep = 'mobile-admin-users';
  await page.goto(baseUrl + '/admin/users?source-frontend-ui-smoke=mobile-admin-users');
  await waitReady();
  await page.waitForSelector('text=用户管理', { timeout: 10000 });
  const mobileAdminUsersMetrics = await visibleMetrics();
  await ensure(mobileAdminUsersMetrics.horizontalOverflow === 0, `mobile admin users overflow: ${mobileAdminUsersMetrics.horizontalOverflow}`);
  await page.screenshot({
    path: `${screenshotDir}/admin-users-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-users', ok: true, metrics: mobileAdminUsersMetrics });

  currentStep = 'mobile-admin-generate-tasks';
  await page.goto(baseUrl + '/admin/generate-tasks?source-frontend-ui-smoke=mobile-admin-generate-tasks');
  await waitReady();
  await page.waitForSelector('text=任务监控', { timeout: 10000 });
  const mobileAdminTasksMetrics = await visibleMetrics();
  await ensure(mobileAdminTasksMetrics.horizontalOverflow === 0, `mobile admin generate tasks overflow: ${mobileAdminTasksMetrics.horizontalOverflow}`);
  await page.screenshot({
    path: `${screenshotDir}/admin-generate-tasks-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-generate-tasks', ok: true, metrics: mobileAdminTasksMetrics });

  currentStep = 'mobile-admin-usage-logs';
  await page.goto(baseUrl + '/admin/logs?source-frontend-ui-smoke=mobile-admin-logs');
  await waitReady();
  await page.waitForSelector('text=消费日志', { timeout: 10000 });
  const mobileAdminLogsMetrics = await visibleMetrics();
  await ensure(mobileAdminLogsMetrics.horizontalOverflow === 0, `mobile admin usage logs overflow: ${mobileAdminLogsMetrics.horizontalOverflow}`);
  await page.screenshot({
    path: `${screenshotDir}/admin-usage-logs-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-usage-logs', ok: true, metrics: mobileAdminLogsMetrics });

  currentStep = 'mobile-admin-orders';
  await page.goto(baseUrl + '/admin/orders?source-frontend-ui-smoke=mobile-admin-orders');
  await waitReady();
  await page.waitForSelector('text=订单管理', { timeout: 10000 });
  const mobileAdminOrdersMetrics = await visibleMetrics();
  await ensure(mobileAdminOrdersMetrics.horizontalOverflow === 0, `mobile admin orders overflow: ${mobileAdminOrdersMetrics.horizontalOverflow}`);
  await page.screenshot({
    path: `${screenshotDir}/admin-orders-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-orders', ok: true, metrics: mobileAdminOrdersMetrics });

  currentStep = 'mobile-admin-redeem-codes';
  await page.goto(baseUrl + '/admin/redeem-codes?source-frontend-ui-smoke=mobile-admin-redeem-codes');
  await waitReady();
  await page.waitForSelector('text=兑换码管理', { timeout: 10000 });
  const mobileAdminRedeemCodesMetrics = await visibleMetrics();
  await ensure(
    mobileAdminRedeemCodesMetrics.horizontalOverflow === 0,
    `mobile admin redeem codes overflow: ${mobileAdminRedeemCodesMetrics.horizontalOverflow}`
  );
  await page.screenshot({
    path: `${screenshotDir}/admin-redeem-codes-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-redeem-codes', ok: true, metrics: mobileAdminRedeemCodesMetrics });

  currentStep = 'mobile-admin-model-prices';
  await page.goto(baseUrl + '/admin/model-prices?source-frontend-ui-smoke=mobile-admin-model-prices');
  await waitReady();
  await page.waitForSelector('text=模型价格', { timeout: 10000 });
  const mobileAdminModelPricesMetrics = await visibleMetrics();
  await ensure(
    mobileAdminModelPricesMetrics.horizontalOverflow === 0,
    `mobile admin model prices overflow: ${mobileAdminModelPricesMetrics.horizontalOverflow}`
  );
  await page.screenshot({
    path: `${screenshotDir}/admin-model-prices-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-model-prices', ok: true, metrics: mobileAdminModelPricesMetrics });

  currentStep = 'mobile-admin-api-providers';
  await page.goto(baseUrl + '/admin/api-providers?source-frontend-ui-smoke=mobile-admin-api-providers');
  await waitReady();
  await page.waitForSelector('text=API 线路', { timeout: 10000 });
  const mobileAdminApiProvidersMetrics = await visibleMetrics();
  await ensure(
    mobileAdminApiProvidersMetrics.horizontalOverflow === 0,
    `mobile admin api providers overflow: ${mobileAdminApiProvidersMetrics.horizontalOverflow}`
  );
  await page.screenshot({
    path: `${screenshotDir}/admin-api-providers-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-api-providers', ok: true, metrics: mobileAdminApiProvidersMetrics });

  currentStep = 'mobile-admin-template-workflows';
  await page.goto(baseUrl + '/admin/template-workflows?source-frontend-ui-smoke=mobile-admin-template-workflows');
  await waitReady();
  await page.waitForSelector('text=模板工作流', { timeout: 10000 });
  const mobileAdminTemplateWorkflowsMetrics = await visibleMetrics();
  await ensure(
    mobileAdminTemplateWorkflowsMetrics.horizontalOverflow === 0,
    `mobile admin template workflows overflow: ${mobileAdminTemplateWorkflowsMetrics.horizontalOverflow}`
  );
  await page.screenshot({
    path: `${screenshotDir}/admin-template-workflows-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-template-workflows', ok: true, metrics: mobileAdminTemplateWorkflowsMetrics });

  currentStep = 'mobile-admin-recycle-bin';
  await page.goto(baseUrl + '/admin/recycle-bin?source-frontend-ui-smoke=mobile-admin-recycle-bin');
  await waitReady();
  await page.waitForSelector('text=回收站', { timeout: 10000 });
  const mobileAdminRecycleBinMetrics = await visibleMetrics();
  await ensure(
    mobileAdminRecycleBinMetrics.horizontalOverflow === 0,
    `mobile admin recycle bin overflow: ${mobileAdminRecycleBinMetrics.horizontalOverflow}`
  );
  await page.screenshot({
    path: `${screenshotDir}/admin-recycle-bin-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-recycle-bin', ok: true, metrics: mobileAdminRecycleBinMetrics });

  currentStep = 'mobile-admin-settings';
  await page.goto(baseUrl + '/admin/settings?source-frontend-ui-smoke=mobile-admin-settings');
  await waitReady();
  await page.waitForSelector('text=系统设置', { timeout: 10000 });
  const mobileAdminSettingsMetrics = await visibleMetrics();
  await ensure(
    mobileAdminSettingsMetrics.horizontalOverflow === 0,
    `mobile admin settings overflow: ${mobileAdminSettingsMetrics.horizontalOverflow}`
  );
  await page.screenshot({
    path: `${screenshotDir}/admin-settings-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-admin-settings', ok: true, metrics: mobileAdminSettingsMetrics });

  currentStep = 'mobile-canvas-legacy-source';
  await page.goto(baseUrl + '/canvas?source-frontend-ui-smoke=mobile-canvas');
  await waitReady();
  await page.waitForSelector('text=旧画布', { timeout: 10000 });
  const mobileCanvasLegacyMetrics = await visibleMetrics();
  await ensure(
    mobileCanvasLegacyMetrics.horizontalOverflow === 0,
    `mobile canvas legacy overflow: ${mobileCanvasLegacyMetrics.horizontalOverflow}`
  );
  await page.screenshot({
    path: `${screenshotDir}/canvas-legacy-source-mobile-390x844.png`,
    fullPage: true
  });
  results.push({ step: 'mobile-canvas-legacy-source', ok: true, metrics: mobileCanvasLegacyMetrics });

  if (badResponses.length) {
    throw new Error(`source frontend API failures: ${JSON.stringify(badResponses)}`);
  }
  if (badStaticResponses.length) {
    throw new Error(`source frontend static failures: ${JSON.stringify(badStaticResponses)}`);
  }
  if (consoleErrors.length) {
    throw new Error(`source frontend console errors: ${JSON.stringify(consoleErrors)}`);
  }

  return results;
}
