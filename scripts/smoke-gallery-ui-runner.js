async page => {
  const baseUrl = 'http://127.0.0.1:3456';
  const screenshotDir = 'docs/design-references/frontend-2026-06-25';
  const stamp = Date.now();
  const username = `gallerySmoke${String(stamp).slice(-6)}`;
  const email = `gallery-smoke-${stamp}@local.test`;
  let setup = null;

  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    await page.goto(baseUrl + '/?gallery-smoke=seed');
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

      const prompts = [
        'gallery smoke multi image A, ecommerce clean product visual',
        'gallery smoke multi image B, ecommerce clean product visual'
      ];
      for (const prompt of prompts) {
        const generateResponse = await fetch('/api/template/generate-image', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${registered.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            templateType: 'main-image',
            selectedPrompt: prompt,
            imageModel: 'gpt-image-2',
            imageCount: 1,
            platform: 'JD',
            ratio: '1:1',
            quality: '2K'
          })
        });
        const generated = await generateResponse.json();
        if (!generated.success || !generated.images || !generated.images.length) {
          throw new Error('gallery smoke generation failed');
        }
      }

      const generationsResponse = await fetch('/api/user/generations', {
        headers: { Authorization: `Bearer ${registered.token}` }
      });
      const generations = await generationsResponse.json();
      const ids = (generations.items || [])
        .filter((item) => prompts.includes(item.prompt))
        .map((item) => item.id);
      if (ids.length !== 2) {
        throw new Error(`expected 2 generated gallery records, got ${ids.length}`);
      }

      localStorage.setItem('auth_token', registered.token);
      localStorage.setItem('auth_user', JSON.stringify(registered.user));
      return {
        adminToken: adminLogin.token,
        userId: registered.user.id,
        token: registered.token,
        ids
      };
    }, { username, email });

    await page.goto(baseUrl + '/?gallery-smoke=multi');
    await page.waitForLoadState('load');
    await page.waitForTimeout(700);

    const galleryButton = page.getByRole('button', { name: '图库' });
    const galleryButtonCount = await galleryButton.count();
    if (galleryButtonCount !== 1) {
      throw new Error(`expected one gallery button, got ${galleryButtonCount}`);
    }
    await galleryButton.click();
    await page.waitForTimeout(900);

    const dialogText = await page.locator('body').innerText();
    if (!dialogText.includes('图片生成历史')) {
      throw new Error('gallery dialog did not open');
    }
    if (!dialogText.includes('共 2 张')) {
      throw new Error('gallery dialog did not show 2 records');
    }
    const articleCount = await page.locator('article').count();
    if (articleCount < 2) {
      throw new Error(`expected at least 2 gallery articles, got ${articleCount}`);
    }
    await page.screenshot({
      path: `${screenshotDir}/gallery-multi-state-desktop-1440x900.png`,
      fullPage: false
    });

    const saveAll = page.getByRole('button', { name: '保存全部链接' });
    if (await saveAll.count() !== 1) {
      throw new Error('save all links button missing');
    }
    await page.evaluate(() => {
      window.__gallerySmokeClipboardText = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__gallerySmokeClipboardText = String(text || '');
          },
          readText: async () => window.__gallerySmokeClipboardText || ''
        }
      });
    });
    await saveAll.click();
    await page.waitForTimeout(500);
    const clipboardText = await page.evaluate(() => window.__gallerySmokeClipboardText || '');
    const copiedLinks = clipboardText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (copiedLinks.length !== 2) {
      throw new Error(`expected 2 copied links, got ${copiedLinks.length}`);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(baseUrl + '/?gallery-smoke=mobile-multi');
    await page.waitForLoadState('load');
    await page.waitForTimeout(700);
    const mobileGalleryButton = page.getByRole('button', { name: '图库' });
    if (await mobileGalleryButton.count() !== 1) {
      throw new Error('mobile gallery button missing');
    }
    await mobileGalleryButton.click();
    await page.waitForTimeout(900);
    const mobileMultiText = await page.locator('body').innerText();
    if (!mobileMultiText.includes('图片生成历史') || !mobileMultiText.includes('共 2 张')) {
      throw new Error('mobile gallery multi state missing');
    }
    await page.screenshot({
      path: 'docs/design-references/mobile-2026-06-25/gallery-multi-mobile-390x844.png',
      fullPage: false
    });

    const deleteCheck = await page.evaluate(async ({ token, ids }) => {
      const deleted = [];
      for (const id of ids) {
        const response = await fetch(`/api/user/generations/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        deleted.push(await response.json());
      }
      const generationsResponse = await fetch('/api/user/generations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const generations = await generationsResponse.json();
      return { deleted, remaining: generations.items || [] };
    }, { token: setup.token, ids: setup.ids });
    if (deleteCheck.deleted.some((item) => !item.deleted) || deleteCheck.remaining.length !== 0) {
      throw new Error(`gallery API delete did not clear records: ${JSON.stringify(deleteCheck)}`);
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.reload();
    await page.waitForLoadState('load');
    await page.waitForTimeout(700);
    await galleryButton.click();
    await page.waitForTimeout(900);

    const emptyState = await page.evaluate(() => {
      const dialog = Array.from(document.querySelectorAll('.n-modal, [role="dialog"], body'))
        .find((item) => (item.innerText || '').includes('图片生成历史'));
      return {
        text: dialog ? dialog.innerText : document.body.innerText,
        imageCount: dialog ? dialog.querySelectorAll('article img').length : document.querySelectorAll('article img').length
      };
    });
    if (!emptyState.text.includes('图片生成历史') || !emptyState.text.includes('共 0 张') || emptyState.imageCount !== 0) {
      throw new Error(`gallery empty state missing after deleting generated records: ${JSON.stringify(emptyState)}`);
    }
    await page.screenshot({
      path: 'docs/design-references/mobile-2026-06-25/gallery-empty-mobile-390x844.png',
      fullPage: false
    });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(baseUrl + '/?gallery-smoke=desktop-empty');
    await page.waitForLoadState('load');
    await page.waitForTimeout(700);
    const desktopGalleryButton = page.getByRole('button', { name: '图库' });
    if (await desktopGalleryButton.count() !== 1) {
      throw new Error('desktop gallery button missing after mobile check');
    }
    await desktopGalleryButton.click();
    await page.waitForTimeout(900);
    const desktopEmptyState = await page.evaluate(() => {
      const dialog = Array.from(document.querySelectorAll('.n-modal, [role="dialog"], body'))
        .find((item) => (item.innerText || '').includes('图片生成历史'));
      return {
        text: dialog ? dialog.innerText : document.body.innerText,
        imageCount: dialog ? dialog.querySelectorAll('article img').length : document.querySelectorAll('article img').length
      };
    });
    if (!desktopEmptyState.text.includes('图片生成历史') || !desktopEmptyState.text.includes('共 0 张') || desktopEmptyState.imageCount !== 0) {
      throw new Error(`desktop gallery empty state missing after mobile check: ${JSON.stringify(desktopEmptyState)}`);
    }
    await page.screenshot({
      path: `${screenshotDir}/gallery-empty-state-desktop-1440x900.png`,
      fullPage: false
    });

    return {
      page: 'gallery',
      ok: true,
      generated: setup.ids.length,
      copiedLinks: copiedLinks.length
    };
  } finally {
    if (setup && setup.adminToken && setup.userId) {
      await page.evaluate(async ({ token, userId }) => {
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'gallery ui smoke cleanup' })
        });
        await fetch(`/api/admin/recycle-bin/users/${encodeURIComponent(userId)}/permanent`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ reason: 'gallery ui smoke cleanup' })
        });
      }, { token: setup.adminToken, userId: setup.userId }).catch(() => {});
    }
  }
}
