async page => {
  const baseUrl = 'http://127.0.0.1:3456';
  const imagePath = 'logo.png';
  const stamp = Date.now();
  const username = `templateSmoke${String(stamp).slice(-6)}`;
  const email = `template-smoke-${stamp}@local.test`;
  let setup = null;
  let generatedIds = [];

  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    await page.goto(baseUrl + '/?template-smoke=seed');
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
      if (!registered.token || !registered.user) {
        throw new Error('test user register failed');
      }

      localStorage.setItem('auth_token', registered.token);
      localStorage.setItem('auth_user', JSON.stringify(registered.user));
      return {
        adminToken: adminLogin.token,
        userId: registered.user.id,
        token: registered.token
      };
    }, { username, email });

    await page.goto(baseUrl + '/template-image?template-ui-smoke=flow');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1200);

    await page.locator('button').filter({ hasText: '一键主图反推复刻' }).last().click();
    await page.waitForTimeout(800);

    const fileInputs = page.locator('input[type="file"]');
    if (await fileInputs.count() < 2) {
      throw new Error('template file inputs missing');
    }
    await fileInputs.nth(0).setInputFiles(imagePath);
    await page.waitForTimeout(500);
    await fileInputs.nth(1).setInputFiles(imagePath);
    await page.waitForTimeout(900);

    await page.screenshot({
      path: 'docs/design-references/frontend-2026-06-25/template-uploaded-desktop-1440x900.png',
      fullPage: false
    });

    const textAfterUpload = await page.locator('body').innerText();
    if (!textAfterUpload.includes('2 张素材') && !textAfterUpload.includes('1 张素材')) {
      throw new Error('template upload did not update material count');
    }

    await page.getByRole('button', { name: '反推提示词' }).click();
    await page.waitForTimeout(1800);
    const textAfterReverse = await page.locator('body').innerText();
    if (!textAfterReverse.includes('提示词选择') || !textAfterReverse.includes('3 条') || !textAfterReverse.includes('查看提示词')) {
      throw new Error('template reverse prompt did not show prompt choices');
    }
    await page.screenshot({
      path: 'docs/design-references/frontend-2026-06-25/template-reverse-prompts-desktop-1440x900.png',
      fullPage: false
    });

    await page.getByRole('button', { name: '生成图片' }).click();
    await page.waitForTimeout(2200);
    const textAfterGenerate = await page.locator('body').innerText();
    const imageCount = await page.locator('img').count();
    if (!textAfterGenerate.includes('生成结果') || imageCount < 1) {
      throw new Error(`template generate result missing: images=${imageCount}`);
    }
    await page.screenshot({
      path: 'docs/design-references/frontend-2026-06-25/template-generate-result-desktop-1440x900.png',
      fullPage: false
    });

    const generations = await page.evaluate(async ({ token }) => {
      const response = await fetch('/api/user/generations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      return await response.json();
    }, setup);
    generatedIds = (generations.items || []).map((item) => item.id).filter(Boolean);
    if (generatedIds.length < 1) {
      throw new Error('template generation did not persist to user generations');
    }

    return {
      page: 'template-image',
      ok: true,
      imageCount,
      generationCount: generatedIds.length
    };
  } finally {
    if (setup && setup.token) {
      await page.evaluate(async ({ token, generatedIds }) => {
        for (const id of generatedIds || []) {
          await fetch(`/api/user/generations/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
        }
      }, { token: setup.token, generatedIds }).catch(() => {});
    }

    if (setup && setup.adminToken && setup.userId) {
      await page.evaluate(async ({ token, userId }) => {
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'template ui smoke cleanup' })
        });
        await fetch(`/api/admin/recycle-bin/users/${encodeURIComponent(userId)}/permanent`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'template ui smoke cleanup' })
        });
      }, { token: setup.adminToken, userId: setup.userId }).catch(() => {});
    }
  }
}
