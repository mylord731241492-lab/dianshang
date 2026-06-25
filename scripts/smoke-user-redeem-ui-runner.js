async page => {
  const baseUrl = 'http://127.0.0.1:3456';
  const stamp = Date.now();
  const code = `UIREDEEM${stamp}`;
  const results = [];

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl + '/?user-redeem-smoke=auth-seed');

  const setup = await page.evaluate(async (redeemCode) => {
    const adminResponse = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const adminLogin = await adminResponse.json();
    if (!adminLogin.token || !adminLogin.user) {
      throw new Error('admin login failed');
    }

    const createResponse = await fetch('/api/admin/redeem-codes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminLogin.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: redeemCode,
        amount: 3,
        maxUses: 1,
        enabled: true
      })
    });
    const created = await createResponse.json();
    if (!created.success) {
      throw new Error(created.message || 'create redeem code failed');
    }

    localStorage.setItem('auth_token', adminLogin.token);
    localStorage.setItem('auth_user', JSON.stringify(adminLogin.user));
    return { token: adminLogin.token, username: adminLogin.user.username, code: redeemCode };
  }, code);

  async function bridgeText() {
    return await page.locator('.uc-data-bridge').innerText();
  }

  await page.goto(baseUrl + '/user/redeem?ui-smoke=redeem');
  await page.waitForLoadState('load');
  await page.waitForTimeout(900);

  const bridge = page.locator('.uc-data-bridge');
  await bridge.waitFor({ state: 'visible', timeout: 10000 });
  const input = page.locator('.uc-data-bridge input[name="code"]');
  const button = page.locator('.uc-data-bridge button[type="submit"]');
  if (await input.count() !== 1 || await button.count() !== 1) {
    throw new Error('redeem bridge form missing');
  }

  await input.fill('NOT_A_REAL_CODE');
  await button.click();
  await page.waitForTimeout(900);
  const invalidText = await bridgeText();
  if (!invalidText.includes('兑换码不存在')) {
    throw new Error('invalid redeem code did not show error notice');
  }
  await page.screenshot({
    path: 'docs/design-references/frontend-2026-06-25/user-redeem-invalid-desktop-1440x900.png',
    fullPage: false
  });
  results.push({ page: 'user-redeem', action: 'invalid-code-error', ok: true });

  await input.fill(setup.code);
  await button.click();
  await page.waitForTimeout(900);
  const successText = await bridgeText();
  if (!successText.includes('兑换成功') || !successText.includes('增加 3 算力')) {
    throw new Error('valid redeem code did not show success notice');
  }
  await page.screenshot({
    path: 'docs/design-references/frontend-2026-06-25/user-redeem-success-desktop-1440x900.png',
    fullPage: false
  });
  results.push({ page: 'user-redeem', action: 'valid-code-success', ok: true });

  await page.evaluate(async ({ token, code: redeemCode }) => {
    await fetch(`/api/admin/redeem-codes/${encodeURIComponent(redeemCode)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
  }, setup);

  return results;
}
