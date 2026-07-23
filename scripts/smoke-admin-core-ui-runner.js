async page => {
  const baseUrl = 'http://127.0.0.1:4597';
  const stamp = Date.now();
  const username = `admin_ui_${stamp}`;
  const email = `admin-ui-${stamp}@local.test`;
  const modelKey = `ui-model-${stamp}`;
  let setup = null;

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    window.confirm = () => true;
  });

  try {
    await page.goto(baseUrl + '/admin/login?admin-core-ui=seed');
    setup = await page.evaluate(async ({ username, email }) => {
      const json = async (path, options = {}) => {
        const response = await fetch(path, options);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || `${response.status} ${path}`);
        return data;
      };
      const adminLogin = await json('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' })
      });
      const code = await json('/api/auth/send-email-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, type: 'register' })
      });
      const registered = await json('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password: 'test123456', code: code.code })
      });
      const adminHeaders = {
        'Authorization': `Bearer ${adminLogin.token}`,
        'Content-Type': 'application/json'
      };
      await json(`/api/admin/users/${encodeURIComponent(registered.user.id)}/balance`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ amount: 30, remark: 'admin core UI smoke setup' })
      });
      await json('/api/template/generate-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${registered.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateType: 'main-image',
          selectedPrompt: 'admin UI smoke image',
          imageModel: 'gpt-image-2',
          imageCount: 1,
          ratio: '1:1',
          quality: '1K'
        })
      });
      const taskData = await json('/api/admin/generate-tasks', { headers: adminHeaders });
      const historyTask = taskData.items.find((item) => String(item.id).startsWith('gen_') && item.userId === registered.user.id);
      if (!historyTask) throw new Error('history task setup missing');

      localStorage.setItem('admin_auth_token', adminLogin.token);
      localStorage.setItem('admin_auth_user', JSON.stringify(adminLogin.user));
      return {
        adminToken: adminLogin.token,
        userId: registered.user.id,
        historyTaskId: historyTask.id
      };
    }, { username, email });

    await page.goto(baseUrl + '/admin/users?admin-core-ui=users');
    await page.waitForLoadState('load');
    const userRow = page.locator('.admin-users-list article').filter({ hasText: username });
    await userRow.waitFor({ state: 'visible', timeout: 10000 });
    await userRow.getByRole('button', { name: /余额/ }).click();
    const userForm = page.getByTestId('admin-user-action-form');
    await userForm.waitFor({ state: 'visible' });
    await userForm.locator('input[placeholder="正数增加，负数扣减"]').fill('5');
    await userForm.getByRole('button', { name: '确认保存' }).click();
    await page.getByText('用户余额已更新，并已写入余额日志。', { exact: true }).waitFor({ state: 'visible' });

    await page.locator('.admin-users-list article').filter({ hasText: username }).getByRole('button', { name: /删除/ }).click();
    await page.locator('.admin-users-list article').filter({ hasText: username }).waitFor({ state: 'detached' });

    await page.goto(baseUrl + '/admin/recycle-bin?admin-core-ui=recycle');
    const recycleRow = page.locator('.admin-recycle-bin-list article').filter({ hasText: username });
    await recycleRow.waitFor({ state: 'visible', timeout: 10000 });
    await recycleRow.getByRole('button', { name: /恢复/ }).click();
    await recycleRow.waitFor({ state: 'detached' });

    await page.goto(baseUrl + '/admin/generate-tasks?admin-core-ui=tasks');
    const taskRow = page.locator('.admin-tasks-list article').filter({ hasText: setup.historyTaskId });
    await taskRow.waitFor({ state: 'visible', timeout: 10000 });
    await taskRow.getByRole('button', { name: /删除记录/ }).click();
    await taskRow.waitFor({ state: 'detached' });

    await page.goto(baseUrl + '/admin/model-prices?admin-core-ui=models');
    await page.getByTestId('open-model-price-form').click();
    const modelForm = page.getByTestId('model-price-form');
    await modelForm.waitFor({ state: 'visible' });
    await modelForm.locator('input[placeholder="例如 gpt-image-2"]').fill(modelKey);
    await modelForm.locator('input[placeholder="后台和前台显示名称"]').fill('UI Smoke Model');
    await modelForm.locator('input[placeholder="0 或正数"]').fill('13');
    await modelForm.locator('input[placeholder="例如 1k, 2k, 4k"]').fill('1k, 2k');
    await modelForm.getByRole('button', { name: /保存模型/ }).click();
    await page.getByText('模型已新增。', { exact: true }).waitFor({ state: 'visible' });

    let modelRow = page.locator('.admin-model-prices-list article').filter({ hasText: modelKey });
    await modelRow.waitFor({ state: 'visible' });
    await modelRow.getByRole('button', { name: '禁用' }).click();
    modelRow = page.locator('.admin-model-prices-list article').filter({ hasText: modelKey });
    await modelRow.getByText('已禁用', { exact: true }).waitFor({ state: 'visible' });
    await modelRow.getByRole('button', { name: /删除/ }).click();
    await modelRow.waitFor({ state: 'detached' });

    await page.goto(baseUrl + '/admin/api-providers?admin-core-ui=providers');
    const lingsuanRow = page.locator('.admin-api-providers-list article').filter({ hasText: 'lignsuan-guanzhuan' });
    await lingsuanRow.waitFor({ state: 'visible', timeout: 10000 });
    const packyRow = page.locator('.admin-api-providers-list article').filter({ hasText: 'route_openai_gpt_image_2' });
    await packyRow.waitFor({ state: 'visible', timeout: 10000 });
    if (!(await lingsuanRow.textContent()).includes('非流式 · b64_json')) {
      throw new Error('lingsuan row does not show its official non-streaming Base64 mode');
    }
    if (!(await packyRow.textContent()).includes('非流式 · url')) {
      throw new Error('Packy row was affected by lingsuan response mode');
    }
    await lingsuanRow.getByRole('button', { name: '编辑' }).click();
    const providerForm = page.getByTestId('api-provider-form');
    await providerForm.waitFor({ state: 'visible' });
    await page.getByText('当前线路请求预览', { exact: true }).waitFor({ state: 'visible' });
    const streamToggle = providerForm.locator('label').filter({ hasText: '流式返图' }).locator('input[type="checkbox"]');
    if (await streamToggle.isChecked()) throw new Error('lingsuan rule must be non-streaming');
    if (!(await streamToggle.isDisabled())) throw new Error('lingsuan stream toggle must be locked by the adapter rule');
    if (await providerForm.locator('label').filter({ hasText: '流式预览数量' }).count()) {
      throw new Error('lingsuan rule must not expose partial_images');
    }
    const requestPreview = await page.locator('.admin-api-default-reference').textContent();
    if (!requestPreview.includes('image[]=<file>') || !requestPreview.includes('data[].b64_json') || requestPreview.includes('stream=true') || requestPreview.includes('response_format=')) {
      throw new Error('lingsuan official request preview does not match the adapter rule');
    }
    await providerForm.getByRole('button', { name: /保存线路/ }).click();
    await page.getByText('API 线路已保存。', { exact: true }).waitFor({ state: 'visible' });
    const savedRoute = await page.evaluate(async () => {
      const token = localStorage.getItem('admin_auth_token');
      const response = await fetch('/api/admin/api-providers', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      return data.items.find((item) => item.id === 'pub_route_mr5yltmuc7edcb2b');
    });
    if (savedRoute?.apiFormat !== 'lingsuan-images' || savedRoute?.requestFormat !== 'lingsuan-images' || savedRoute?.imageResponseFormat !== 'b64_json' || savedRoute?.imageStream !== false || savedRoute?.imagePartialImages !== 0 || savedRoute?.imageEditEndpoint !== '/v1/images/edits') {
      throw new Error(`lingsuan route fields were not persisted: ${JSON.stringify(savedRoute)}`);
    }

    const refreshedPackyRow = page.locator('.admin-api-providers-list article').filter({ hasText: 'route_openai_gpt_image_2' });
    await refreshedPackyRow.getByRole('button', { name: '编辑' }).click();
    await providerForm.waitFor({ state: 'visible' });
    await providerForm.getByText('Packy Images', { exact: true }).waitFor({ state: 'visible' });
    const packyStreamToggle = providerForm.locator('label').filter({ hasText: '流式返图' }).locator('input[type="checkbox"]');
    if (await packyStreamToggle.isChecked()) throw new Error('Packy Images rule must be non-streaming');
    if (!(await packyStreamToggle.isDisabled())) throw new Error('Packy Images stream toggle must be locked by the adapter rule');
    const packyRequestPreview = await page.locator('.admin-api-default-reference').textContent();
    if (!packyRequestPreview.includes('image=<file>') || !packyRequestPreview.includes('不发送 response_format') || packyRequestPreview.includes('image[]=<file>') || packyRequestPreview.includes('response_format=')) {
      throw new Error('Packy Images request preview does not match the strict image-group adapter');
    }
    await providerForm.getByRole('button', { name: '取消' }).click();

    const errors = await page.locator('.admin-feedback-error').allTextContents();
    if (errors.length) throw new Error(`unexpected admin UI errors: ${errors.join(' | ')}`);
    await page.evaluate(() => {
      document.body.dataset.adminCoreUiSmoke = 'done';
    });
    return { completed: true };
  } finally {
    if (setup?.adminToken && setup?.userId) {
      await page.evaluate(async ({ token, userId }) => {
        const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
        await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { method: 'DELETE', headers });
        await fetch(`/api/admin/recycle-bin/users/${encodeURIComponent(userId)}/permanent`, { method: 'DELETE', headers });
      }, { token: setup.adminToken, userId: setup.userId }).catch(() => {});
    }
  }
}
