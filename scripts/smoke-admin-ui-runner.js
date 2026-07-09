async page => {
  const baseUrl = 'http://127.0.0.1:3456';
  const results = [];

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl + '/?ui-smoke=auth-seed');
  const loginResult = await page.evaluate(async () => {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    return await response.json();
  });
  if (!loginResult.token || !loginResult.user) {
    throw new Error('admin ui smoke login failed');
  }
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('admin_auth_token', token);
    localStorage.setItem('admin_auth_user', JSON.stringify(user));
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }, loginResult);

  async function pageText() {
    return await page.locator('body').innerText();
  }

  async function gotoAndExpect(route, label, expectedText) {
    await page.goto(baseUrl + route);
    await page.waitForLoadState('load');
    await page.waitForTimeout(500);
    const text = await pageText();
    if (!text.includes(expectedText)) {
      throw new Error(label + ' missing text: ' + expectedText);
    }
    if (text.includes('404') || text.includes('Internal Server Error')) {
      throw new Error(label + ' rendered an error state');
    }
    results.push({ page: label, ok: true, expectedText });
  }

  async function uniqueButton(name, label) {
    const locator = page.getByRole('button', { name });
    const count = await locator.count();
    if (count !== 1) {
      throw new Error(label + ' expected one button "' + name + '", got ' + count);
    }
    return locator;
  }

  await gotoAndExpect('/admin/dashboard?ui-smoke=dashboard', 'dashboard', '控制台 Dashboard');
  await page.screenshot({
    path: 'docs/design-references/admin-2026-06-25/admin-ui-smoke-dashboard-desktop-1440x900.png',
    fullPage: false
  });

  await gotoAndExpect('/admin/settings?ui-smoke=settings', 'settings', '系统设置');
  const settingsSave = await uniqueButton('保存设置', 'settings');
  await settingsSave.click();
  await page.waitForTimeout(700);
  results.push({ page: 'settings', action: 'save-settings-click', ok: true });
  await page.screenshot({
    path: 'docs/design-references/admin-2026-06-25/admin-ui-smoke-settings-desktop-1440x900.png',
    fullPage: false
  });

  await gotoAndExpect('/admin/api-providers?ui-smoke=api-providers', 'api-providers', 'API 线路管理');
  const providerInputsBefore = await page.locator('input').count();
  const addProvider = await uniqueButton('新增线路', 'api-providers');
  await addProvider.click();
  await page.waitForTimeout(700);
  const providerInputsAfter = await page.locator('input').count();
  const providerText = await pageText();
  if (providerInputsAfter <= providerInputsBefore || !providerText.includes('Base URL')) {
    throw new Error('api provider modal did not open expected form');
  }
  results.push({ page: 'api-providers', action: 'open-add-provider-modal', ok: true });
  await page.screenshot({
    path: 'docs/design-references/admin-2026-06-25/admin-ui-smoke-api-provider-modal-desktop-1440x900.png',
    fullPage: false
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await gotoAndExpect('/admin/redeem-codes?ui-smoke=redeem-codes', 'redeem-codes', '兑换码管理');
  const redeemInputsBefore = await page.locator('input').count();
  const createRedeem = await uniqueButton('创建兑换码', 'redeem-codes');
  await createRedeem.click();
  await page.waitForTimeout(700);
  const redeemInputsAfter = await page.locator('input').count();
  const redeemText = await pageText();
  if (redeemInputsAfter <= redeemInputsBefore || !redeemText.includes('点数')) {
    throw new Error('redeem code modal did not open expected form');
  }
  results.push({ page: 'redeem-codes', action: 'open-create-redeem-modal', ok: true });
  await page.screenshot({
    path: 'docs/design-references/admin-2026-06-25/admin-ui-smoke-redeem-modal-desktop-1440x900.png',
    fullPage: false
  });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await gotoAndExpect('/admin/template-workflows?ui-smoke=template-workflows', 'template-workflows', '模板工作流');
  const saveWorkflow = await uniqueButton('保存配置', 'template-workflows');
  await saveWorkflow.click();
  await page.waitForTimeout(800);
  results.push({ page: 'template-workflows', action: 'save-config-click', ok: true });
  await page.screenshot({
    path: 'docs/design-references/admin-2026-06-25/admin-ui-smoke-template-workflows-desktop-1440x900.png',
    fullPage: false
  });

  return results;
}
