async page => {
  const currentUrl = page.url();
  const baseUrl = currentUrl.replace(/^(https?:\/\/[^/]+).*$/, '$1');
  const screenshotDir = 'docs/design-references/admin-2026-06-25';
  const stamp = Date.now();
  const echoNumber = 730 + (stamp % 100);
  const state = { token: null, oldSettings: null, oldWorkflows: null, routeId: null, modelId: null };
  const wait = ms => page.waitForTimeout(ms);

  async function json(path, options = {}) {
    return await page.evaluate(async ({ path, options, token }) => {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(path, {
        ...options,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
      const text = await response.text();
      let payload = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch (error) {
        throw new Error(`${path} returned non-json: ${text.slice(0, 120)}`);
      }
      if (!response.ok || payload.success === false) {
        throw new Error(`${path} failed: ${payload.message || response.status}`);
      }
      return payload;
    }, { path, options, token: state.token });
  }

  async function login() {
    await page.goto(baseUrl + '/admin/login?admin-save-echo=seed', { waitUntil: 'networkidle' });
    const payload = await json('/api/admin/login', {
      method: 'POST',
      body: { username: 'admin', password: 'admin123' }
    });
    if (!payload.token || !payload.user) throw new Error('admin save echo login failed');
    state.token = payload.token;
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('admin_auth_token', token);
      localStorage.setItem('admin_auth_user', JSON.stringify(user));
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
    }, { token: payload.token, user: payload.user });
  }

  async function gotoAdmin(path, expected) {
    await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(text => document.body.innerText.includes(text), expected, { timeout: 10000 });
    const bodyText = await page.locator('body').innerText();
    if (bodyText.includes('404') || bodyText.includes('500')) {
      throw new Error(`${path} contains fatal status text`);
    }
    return bodyText;
  }

  async function expectVisibleText(path, expectedText) {
    const text = await page.locator('body').innerText();
    if (!text.includes(expectedText)) {
      throw new Error(`${path} did not echo saved text: ${expectedText}`);
    }
  }

  async function clickIfPresent(name) {
    const button = page.getByRole('button', { name });
    if (await button.count()) {
      await button.first().click();
      await wait(800);
    }
  }

  async function restore() {
    if (state.oldWorkflows) {
      await json('/api/admin/template-workflows', { method: 'PUT', body: state.oldWorkflows }).catch(() => {});
    }
    if (state.modelId) {
      await json(`/api/admin/route-models/${encodeURIComponent(state.modelId)}`, { method: 'DELETE' }).catch(() => {});
    }
    if (state.routeId) {
      await json(`/api/admin/api-providers/${encodeURIComponent(state.routeId)}`, { method: 'DELETE' }).catch(() => {});
    }
    if (state.oldSettings) {
      await json('/api/admin/settings', { method: 'PATCH', body: state.oldSettings }).catch(() => {});
    }
  }

  const result = { settings: false, apiProvider: false, modelPrice: false, templateWorkflow: false, screenshots: [] };

  try {
    await login();

    const settingsBefore = await json('/api/admin/settings');
    state.oldSettings = settingsBefore.settings || settingsBefore.data || settingsBefore;
    await json('/api/admin/settings', {
      method: 'PATCH',
      body: { ...state.oldSettings, registrationGiftCredits: echoNumber, adminUiSaveEchoAt: String(stamp) }
    });
    await gotoAdmin('/admin/settings?save-echo=settings', '系统设置');
    await clickIfPresent('保存设置');
    await page.reload({ waitUntil: 'networkidle' });
    const settingsEcho = await page.evaluate(expected => {
      const values = Array.from(document.querySelectorAll('input, textarea')).map(input => input.value);
      return values.includes(String(expected)) || document.body.innerText.includes(String(expected));
    }, echoNumber);
    if (!settingsEcho) throw new Error(`settings registrationGiftCredits did not echo after reload: ${echoNumber}`);
    await page.screenshot({ path: `${screenshotDir}/save-echo-settings-desktop-1440x900.png`, fullPage: true });
    result.settings = true;
    result.screenshots.push('save-echo-settings-desktop-1440x900.png');

    const routeName = `UI 回显线路 ${stamp}`;
    const routeKey = `ui-save-echo-${stamp}`;
    const baseApi = `https://ui-save-echo-${stamp}.local/v1`;
    const routePayload = await json('/api/admin/api-providers', {
      method: 'POST',
      body: {
        routeKey,
        displayName: routeName,
        name: routeName,
        category: 'image',
        apiFormat: 'openai',
        baseUrl: baseApi,
        apiKey: `sk-ui-save-echo-${stamp}`,
        enabled: true,
        priority: 88
      }
    });
    const route = routePayload.route || routePayload.provider || routePayload.item;
    state.routeId = route.id;
    await gotoAdmin('/admin/api-providers?save-echo=provider', 'API 线路管理');
    await page.reload({ waitUntil: 'networkidle' });
    await expectVisibleText('/admin/api-providers', routeName);
    await expectVisibleText('/admin/api-providers', baseApi);
    await page.screenshot({ path: `${screenshotDir}/save-echo-api-provider-desktop-1440x900.png`, fullPage: true });
    result.apiProvider = true;
    result.screenshots.push('save-echo-api-provider-desktop-1440x900.png');

    const modelKey = `ui-echo-model-${stamp}`;
    const modelName = `UI 回显模型 ${stamp}`;
    const modelPayload = await json(`/api/admin/routes/${encodeURIComponent(state.routeId)}/models`, {
      method: 'POST',
      body: { modelKey, displayName: modelName, realName: modelKey, pricePoints: 23, qualities: ['1K', '2K'] }
    });
    const model = modelPayload.model || modelPayload.item;
    state.modelId = model.id || `${state.routeId}:${modelKey}`;
    await gotoAdmin('/admin/model-prices?save-echo=model', '模型价格');
    await page.reload({ waitUntil: 'networkidle' });
    await expectVisibleText('/admin/model-prices', modelName);
    await page.screenshot({ path: `${screenshotDir}/save-echo-model-prices-desktop-1440x900.png`, fullPage: true });
    result.modelPrice = true;
    result.screenshots.push('save-echo-model-prices-desktop-1440x900.png');

    const workflows = await json('/api/admin/template-workflows');
    state.oldWorkflows = { ...workflows, templates: workflows.items || workflows.templates || workflows.data || [] };
    delete state.oldWorkflows.success;
    delete state.oldWorkflows.items;
    delete state.oldWorkflows.data;
    const templates = state.oldWorkflows.templates || [];
    if (!templates.length) throw new Error('template workflows has no templates to verify');
    const templateName = `一键主图反推复刻 UI回显 ${stamp}`;
    await gotoAdmin('/admin/template-workflows?save-echo=workflow', '模板工作流');
    const nameInput = page.locator('input[placeholder="模板名称"]').first();
    await nameInput.fill(templateName);
    await clickIfPresent('保存配置');
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForLoadState('networkidle');
    const workflowEcho = await page.locator('input[placeholder="模板名称"]').first().inputValue();
    if (workflowEcho !== templateName) {
      throw new Error(`template workflow name did not echo after reload: ${workflowEcho}`);
    }
    await page.screenshot({ path: `${screenshotDir}/save-echo-template-workflows-desktop-1440x900.png`, fullPage: true });
    result.templateWorkflow = true;
    result.screenshots.push('save-echo-template-workflows-desktop-1440x900.png');
  } finally {
    await restore();
  }

  return result;
}
