async page => {
  const baseUrl = 'http://127.0.0.1:3456';
  const stamp = Date.now();
  const username = `ui_delete_${stamp}`;
  const email = `ui-delete-${stamp}@local.test`;
  let setup = null;
  const results = [];

  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    await page.goto(baseUrl + '/?admin-delete-smoke=auth-seed');
    setup = await page.evaluate(async ({ username, email }) => {
      const adminResponse = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });
      const adminLogin = await adminResponse.json();
      if (!adminLogin.token || !adminLogin.user) {
        throw new Error('admin login failed');
      }

      const codeResponse = await fetch('/api/auth/send-email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' })
      });
      const codeData = await codeResponse.json();
      if (!codeData.code) {
        throw new Error('register code missing');
      }

      const registerResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password: 'test123456',
          code: codeData.code
        })
      });
      const registered = await registerResponse.json();
      if (!registered.user || !registered.user.id) {
        throw new Error('test user register failed');
      }

      localStorage.setItem('auth_token', adminLogin.token);
      localStorage.setItem('auth_user', JSON.stringify(adminLogin.user));
      return {
        adminToken: adminLogin.token,
        userId: registered.user.id,
        username,
        email
      };
    }, { username, email });

    await page.goto(baseUrl + '/admin/users?ui-smoke=delete');
    await page.waitForLoadState('load');
    await page.waitForTimeout(900);

    const userRow = page.locator('tr').filter({ hasText: setup.username });
    if (await userRow.count() !== 1) {
      throw new Error('created user row missing in admin users table');
    }
    await page.screenshot({
      path: 'docs/design-references/admin-2026-06-25/admin-user-delete-target-desktop-1440x900.png',
      fullPage: false
    });

    await page.evaluate((targetUsername) => {
      const row = Array.from(document.querySelectorAll('tr')).find((item) => item.innerText.includes(targetUsername));
      const button = row && Array.from(row.querySelectorAll('button')).find((item) => {
        return item.title === '删除' || item.innerText.trim().includes('删除');
      });
      if (!button) {
        throw new Error('delete button missing for created user');
      }
      button.click();
    }, setup.username);
    await page.waitForTimeout(500);

    const deleteModal = page.getByText('确认删除用户', { exact: true });
    await deleteModal.waitFor({ state: 'visible', timeout: 10000 });
    const passwordInput = page.locator('input[placeholder="管理员密码，必填"]');
    if (await passwordInput.count() !== 1) {
      throw new Error('delete modal password input missing');
    }
    await passwordInput.fill('admin123');
    const reasonInput = page.locator('textarea[placeholder="删除原因，可选"]');
    if (await reasonInput.count() === 1) {
      await reasonInput.fill('admin delete ui smoke');
    }
    await page.screenshot({
      path: 'docs/design-references/admin-2026-06-25/admin-user-delete-confirm-desktop-1440x900.png',
      fullPage: false
    });
    const confirmDelete = page.getByRole('button', { name: '确认删除' });
    if (await confirmDelete.count() !== 1) {
      throw new Error('confirm delete button missing');
    }
    await confirmDelete.click();
    await page.waitForTimeout(1000);
    results.push({ page: 'admin-users', action: 'soft-delete-confirm', ok: true });

    await page.goto(baseUrl + '/admin/recycle-bin?ui-smoke=restore');
    await page.waitForLoadState('load');
    await page.waitForTimeout(900);
    const recycleRow = page.locator('tr').filter({ hasText: setup.username });
    if (await recycleRow.count() !== 1) {
      throw new Error('deleted user missing in recycle bin table');
    }
    await page.screenshot({
      path: 'docs/design-references/admin-2026-06-25/admin-user-recycle-row-desktop-1440x900.png',
      fullPage: false
    });

    await page.evaluate((targetUsername) => {
      const row = Array.from(document.querySelectorAll('tr')).find((item) => item.innerText.includes(targetUsername));
      const button = row && Array.from(row.querySelectorAll('button')).find((item) => {
        return item.title === '恢复' || item.innerText.trim().includes('恢复');
      });
      if (!button) {
        throw new Error('restore button missing for deleted user');
      }
      button.click();
    }, setup.username);
    await page.waitForTimeout(1000);
    const recycleText = await page.locator('body').innerText();
    if (recycleText.includes(setup.username)) {
      throw new Error('restored user still visible in recycle bin');
    }
    await page.screenshot({
      path: 'docs/design-references/admin-2026-06-25/admin-user-restore-complete-desktop-1440x900.png',
      fullPage: false
    });
    results.push({ page: 'admin-recycle-bin', action: 'restore-user', ok: true });

    return results;
  } finally {
    if (setup && setup.adminToken && setup.userId) {
      await page.evaluate(async ({ token, userId }) => {
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'admin delete ui smoke cleanup' })
        });
        await fetch(`/api/admin/recycle-bin/users/${encodeURIComponent(userId)}/permanent`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'admin delete ui smoke cleanup' })
        });
      }, { token: setup.adminToken, userId: setup.userId }).catch(() => {});
    }
  }
}
