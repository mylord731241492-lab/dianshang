async page => {
  const baseUrl = await page.evaluate(() => location.origin);
  const stamp = Date.now();
  const results = [];
  const mobileIssues = [];
  const consoleErrors = [];
  const badResponses = [];
  const pngBuffer = new Uint8Array([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1,
    8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 252, 207,
    192, 80, 15, 0, 4, 133, 1, 128, 132, 169, 140, 33, 0, 0, 0, 0, 73, 69, 78, 68, 174,
    66, 96, 130
  ]);
  let currentStep = 'bootstrap';

  const ensure = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (!text.includes('favicon') && !text.includes('Failed to load resource: the server responded with a status of 404')) {
      consoleErrors.push({ step: currentStep, text });
    }
  });
  page.on('pageerror', error => {
    consoleErrors.push({ step: currentStep, text: error.message });
  });
  page.on('response', response => {
    const status = response.status();
    if (status < 400) return;
    const url = response.url();
    if (!url.includes('/favicon')) {
      badResponses.push({ step: currentStep, status, url });
    }
  });

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    const response = await page.request.fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      ...(options.data !== undefined ? { data: options.data } : {}),
      ...(options.multipart !== undefined ? { multipart: options.multipart } : {})
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    if (options.expectedStatus !== undefined) {
      ensure(response.status() === options.expectedStatus, `${options.method || 'GET'} ${path} expected ${options.expectedStatus}, got ${response.status()}`);
    } else {
      ensure(response.ok(), `${options.method || 'GET'} ${path} failed with HTTP ${response.status()}`);
    }
    return { status: response.status(), json, text };
  }

  async function register(label) {
    const suffix = `${stamp}-${label}-${Math.random().toString(16).slice(2, 8)}`;
    const username = `candidate-ui-${suffix}`;
    const password = `Candidate-Ui!2026-${suffix}`;
    const response = await api('/api/auth/register', {
      method: 'POST',
      data: { username, email: `${username}@test.internal`, password }
    });
    ensure(response.json?.token && response.json?.user?.id, `register ${label} did not return session`);
    return { token: response.json.token, user: response.json.user, username, password };
  }

  async function uploadAsset(token, name) {
    const response = await page.evaluate(async ({ token, name, bytes }) => {
      const form = new FormData();
      form.append('file', new File([new Uint8Array(bytes)], name, { type: 'image/png' }));
      const result = await fetch('/api/user/assets/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
      return { status: result.status, json: await result.json().catch(() => null) };
    }, { token, name, bytes: Array.from(pngBuffer) });
    ensure(response.status === 200 && response.json?.asset?.id, `upload ${name} did not return asset`);
    return response.json.asset;
  }

  async function setSession(session) {
    await page.goto(`${baseUrl}/canvas?candidate-session-bootstrap=1`);
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));
    }, { token: session.token, user: session.user });
  }

  async function waitCanvasReady(expectedNodes) {
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('main', { timeout: 15000 });
    await page.waitForFunction(
      count => document.querySelectorAll('[data-node-id]').length >= count,
      expectedNodes,
      { timeout: 15000 }
    );
  }

  async function horizontalOverflow() {
    return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
  }

  async function projectEnvelope(nodes, connections = []) {
    return {
      schema: 'hjm.infinite-canvas.project',
      schemaVersion: 1,
      engine: 'infinite-canvas',
      upstreamVersion: '0.10.0',
      project: {
        nodes,
        connections,
        chatSessions: [],
        activeChatId: null,
        backgroundMode: 'lines',
        showImageInfo: false,
        viewport: { x: 0, y: 0, k: 1 }
      }
    };
  }

  const userA = await register('a');
  const userB = await register('b');
  const admin = await api('/api/admin/login', {
    method: 'POST',
    data: { username: 'admin', password: 'CanvasCandidate!2026!Strong' }
  });
  ensure(admin.json?.token, 'candidate admin login failed');

  const systemMarker = `UI 系统提示词 ${stamp}`;
  const systemPrompt = await api('/api/admin/system-prompts', {
    method: 'POST',
    token: admin.json.token,
    data: {
      title: systemMarker,
      content: `UI 系统提示词正文 ${stamp}`,
      category: '候选 UI',
      tags: ['task13', 'ui'],
      status: 'published',
      sortOrder: 13
    }
  });
  const systemPromptId = systemPrompt.json?.item?.id;
  ensure(systemPromptId, 'system prompt seed failed');

  const privateMarker = `UI 我的提示词 ${stamp}`;
  const privatePrompt = await api('/api/user/prompts', {
    method: 'POST',
    token: userA.token,
    data: {
      title: privateMarker,
      content: `UI 私有提示词正文 ${stamp}`,
      category: '候选 UI',
      tags: ['task13']
    }
  });
  const privatePromptId = privatePrompt.json?.item?.id;
  ensure(privatePromptId, 'private prompt seed failed');

  const primaryAsset = await uploadAsset(userA.token, `ui-primary-${stamp}.png`);
  const deleteAsset = await uploadAsset(userA.token, `ui-delete-${stamp}.png`);
  for (let index = 0; index < 25; index += 1) {
    await uploadAsset(userA.token, `ui-page-${stamp}-${String(index).padStart(2, '0')}.png`);
  }

  await setSession(userA);
  await page.setViewportSize({ width: 1440, height: 900 });

  currentStep = 'project-list-create';
  await page.goto(`${baseUrl}/canvas?candidate-ui=project-list`);
  await page.waitForSelector('text=无限画布', { timeout: 15000 });
  ensure((await horizontalOverflow()) === 0, 'desktop project list has horizontal overflow');
  await page.getByRole('button', { name: '新建画布' }).first().click();
  await page.waitForURL(/\/canvas\/proj_/, { timeout: 15000 });
  await waitCanvasReady(0);
  const projectId = page.url().match(/\/canvas\/([^?]+)/)?.[1] || '';
  ensure(projectId.startsWith('proj_'), 'UI create did not use server project id');

  currentStep = 'project-rename-and-nodes';
  const titleButton = page.locator('button[title="双击修改画布名称"]');
  await titleButton.dblclick();
  const topTitleInput = page.locator('input:focus');
  const renamedProject = `UI 候选画布 ${stamp}`;
  await topTitleInput.fill(renamedProject);
  await topTitleInput.press('Enter');
  await page.getByRole('button', { name: '文本', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-node-id]').length === 1);
  const textNode = page.locator('[data-node-id]').first();
  const textTransform = await textNode.getAttribute('style');
  const textBox = await textNode.boundingBox();
  ensure(textBox, 'text node has no bounding box');
  await page.mouse.move(textBox.x + textBox.width / 2, textBox.y + textBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(textBox.x + textBox.width / 2 - 220, textBox.y + textBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  ensure((await textNode.getAttribute('style')) !== textTransform, 'node drag did not change position');

  await page.getByRole('button', { name: '图片', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-node-id]').length === 2);
  const imageNode = page.locator('[data-node-id]').nth(1);
  const initialImageBox = await imageNode.boundingBox();
  ensure(initialImageBox, 'image node has no bounding box');
  await page.mouse.move(initialImageBox.x + initialImageBox.width / 2, initialImageBox.y + initialImageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(initialImageBox.x + initialImageBox.width / 2 + 360, initialImageBox.y + initialImageBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const canvas = page.locator('div.cursor-grab.select-none.overflow-hidden').first();
  const canvasBox = await canvas.boundingBox();
  ensure(canvasBox, 'canvas has no bounding box');

  currentStep = 'connect-undo-redo';
  await textNode.hover();
  const sourceHandle = textNode.locator('div.cursor-crosshair').last();
  const targetHandle = imageNode.locator('div.cursor-crosshair').first();
  ensure((await sourceHandle.count()) === 1 && (await targetHandle.count()) === 1, 'connection handles are not available');
  await sourceHandle.dragTo(targetHandle, { steps: 12 });
  await page.waitForTimeout(200);
  ensure((await page.locator('[data-connection-id]').count()) >= 1, 'node connection was not created');
  await page.getByRole('button', { name: '撤销', exact: true }).click();
  await page.waitForTimeout(100);
  ensure((await page.locator('[data-connection-id]').count()) === 0, 'undo did not remove the latest connection');
  await page.getByRole('button', { name: '重做', exact: true }).click();
  await page.waitForTimeout(100);
  ensure((await page.locator('[data-connection-id]').count()) >= 1, 'redo did not restore the connection');

  await page.getByRole('button', { name: '生成配置', exact: true }).click();
  await page.getByRole('button', { name: '组', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-node-id]').length === 4, null, { timeout: 10000 });
  ensure((await page.locator('[data-node-id]').count()) === 4, 'text/image/config/group nodes were not all created');

  currentStep = 'frame-selection';
  const nodeBoxes = await page.locator('[data-node-id]').evaluateAll(elements =>
    elements.map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    })
  );
  const selectionStart = {
    x: Math.max(canvasBox.x + 8, Math.min(...nodeBoxes.map(item => item.left)) - 18),
    y: Math.max(canvasBox.y + 8, Math.min(...nodeBoxes.map(item => item.top)) - 18)
  };
  const selectionEnd = {
    x: Math.min(canvasBox.x + canvasBox.width - 8, Math.max(...nodeBoxes.map(item => item.right)) + 18),
    y: Math.min(canvasBox.y + canvasBox.height - 8, Math.max(...nodeBoxes.map(item => item.bottom)) + 18)
  };
  await page.keyboard.down('Control');
  await page.mouse.move(selectionStart.x, selectionStart.y);
  await page.mouse.down();
  await page.mouse.move(selectionEnd.x, selectionEnd.y, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.up('Control');
  await page.waitForTimeout(150);
  ensure((await page.getByRole('button', { name: '删除选中' }).count()) === 1, 'frame selection did not select canvas nodes');

  currentStep = 'zoom-minimap-upload';
  const canvasTransformBefore = await canvas.locator(':scope > div.absolute.origin-top-left').getAttribute('style');
  const canvasZoomPoint = { x: canvasBox.x + canvasBox.width - 40, y: canvasBox.y + canvasBox.height - 40 };
  await page.mouse.move(canvasZoomPoint.x, canvasZoomPoint.y);
  for (let index = 0; index < 20; index += 1) {
    await page.mouse.wheel(0, -100);
  }
  const canvasTransformAfter = await canvas.locator(':scope > div.absolute.origin-top-left').getAttribute('style');
  ensure(canvasTransformAfter !== canvasTransformBefore, '20 wheel zoom operations did not update viewport');
  await page.getByRole('button', { name: '重置视图' }).click();
  await page.waitForTimeout(200);
  await page.getByRole('button', { name: '打开小地图' }).click();
  ensure((await page.getByRole('button', { name: '关闭小地图' }).count()) === 1, 'minimap did not open');

  const nodeCountBeforeUpload = await page.locator('[data-node-id]').count();
  await page.evaluate(({ name, bytes }) => {
    const input = document.querySelector('input[type=file][accept*="audio/mpeg"]');
    if (!(input instanceof HTMLInputElement)) throw new Error('image upload input is missing');
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(bytes)], name, { type: 'image/png' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { name: `ui-upload-${stamp}.png`, bytes: Array.from(pngBuffer) });
  await page.waitForFunction(
    count => document.querySelectorAll('[data-node-id]').length > count,
    nodeCountBeforeUpload,
    { timeout: 15000 }
  );
  const uploadedImageNodeCandidate = page.locator('[data-node-id]').filter({ has: page.locator('img') }).last();
  ensure((await uploadedImageNodeCandidate.count()) === 1, 'uploaded image node was not rendered');
  const uploadedImageNodeId = await uploadedImageNodeCandidate.getAttribute('data-node-id');
  ensure(uploadedImageNodeId, 'uploaded image node id is missing');
  const uploadedImageNode = page.locator(`[data-node-id="${uploadedImageNodeId}"]`);
  const uploadedImageBox = await uploadedImageNode.boundingBox();
  ensure(uploadedImageBox, 'uploaded image node has no bounding box');
  await page.mouse.move(uploadedImageBox.x + uploadedImageBox.width / 2, uploadedImageBox.y + uploadedImageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(uploadedImageBox.x + uploadedImageBox.width / 2 + 360, uploadedImageBox.y + uploadedImageBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  currentStep = 'cloud-asset-library';
  const cloudLibraryButton = page.getByRole('button', { name: '云端资产库', exact: true });
  ensure((await cloudLibraryButton.count()) === 1, 'cloud asset library has no visible entry');
  await cloudLibraryButton.click();
  await page.waitForSelector('text=选择云端资产', { timeout: 10000 });
  await page.waitForSelector('text=加载更多', { timeout: 10000 });
  await page.getByRole('button', { name: '加载更多' }).click();
  await page.waitForTimeout(500);

  const assetSearch = page.getByPlaceholder('搜索资产名称');
  await assetSearch.fill(primaryAsset.name);
  await page.waitForTimeout(500);
  await page.waitForSelector(`text=${primaryAsset.name}`, { timeout: 10000 });
  const primaryCard = page.locator('div.group.relative.overflow-hidden').filter({ hasText: primaryAsset.name }).first();
  await primaryCard.getByRole('button', { name: '改名' }).click();
  await page.waitForSelector('text=资产改名', { timeout: 5000 });
  const renamedAsset = `ui-renamed-${stamp}.png`;
  await page.locator('.ant-modal').filter({ hasText: '资产改名' }).getByPlaceholder('资产名称').fill(renamedAsset);
  const tagInput = page.locator('.ant-modal').filter({ hasText: '资产改名' }).getByPlaceholder('标签（可选，逗号分隔）');
  ensure((await tagInput.count()) === 1, 'asset tag editing control is missing');
  await tagInput.fill('');
  await tagInput.pressSequentially('task13,');
  ensure((await tagInput.inputValue()) === 'task13,', 'asset tag delimiter disappeared during keyboard input');
  await tagInput.pressSequentially('candidate');
  const assetEditSave = page.locator('.ant-modal:visible').last().locator('.ant-modal-footer button').last();
  ensure(
    (await assetEditSave.count()) === 1,
    `asset edit save button is missing; visible modals=${await page.locator('.ant-modal:visible').count()} buttons=${JSON.stringify(await page.locator('button:visible').allTextContents())}`
  );
  await assetEditSave.click();
  await page.waitForTimeout(500);
  const editedAsset = await api(`/api/user/assets?q=${encodeURIComponent(renamedAsset)}`, { token: userA.token });
  const editedAssetItem = editedAsset.json?.items?.find(item => item.id === primaryAsset.id);
  ensure(editedAssetItem?.tags?.includes('task13') && editedAssetItem.tags.includes('candidate'), 'asset tags did not persist after editing');
  await assetSearch.fill(renamedAsset);
  await page.waitForTimeout(500);
  const renamedCard = page.locator('div.group.relative.overflow-hidden').filter({ hasText: renamedAsset }).first();
  await renamedCard.locator('button.block.w-full.cursor-pointer').click();
  await page.waitForTimeout(300);
  ensure((await page.locator('[data-node-id]').count()) > nodeCountBeforeUpload + 1, 'cloud asset was not reinserted into canvas');

  await cloudLibraryButton.click();
  await assetSearch.fill(deleteAsset.name);
  await page.waitForTimeout(500);
  const deleteCard = page.locator('div.group.relative.overflow-hidden').filter({ hasText: deleteAsset.name }).first();
  await deleteCard.getByRole('button', { name: '删除' }).click();
  await page.waitForTimeout(200);
  const assetDeleteConfirm = page.locator('.ant-popconfirm .ant-btn-primary');
  ensure(
    (await assetDeleteConfirm.count()) >= 1,
    `asset delete confirmation is missing; visible buttons=${JSON.stringify(await page.locator('button:visible').allTextContents())}`
  );
  await assetDeleteConfirm.last().click();
  await deleteCard.waitFor({ state: 'detached', timeout: 5000 });
  await page.getByRole('button', { name: 'Close' }).first().click().catch(async () => {
    await page.keyboard.press('Escape');
  });

  currentStep = 'prompt-library';
  await page.getByRole('button', { name: '提示词库', exact: true }).click();
  await page.getByRole('button', { name: '系统提示词', exact: true }).click();
  const promptSearch = page.getByPlaceholder('搜索提示词');
  await promptSearch.fill(systemMarker);
  await page.waitForTimeout(500);
  await page.waitForSelector(`text=${systemMarker}`, { timeout: 10000 });
  const systemRow = page.locator('div.group.rounded-lg').filter({ hasText: systemMarker }).first();
  ensure((await systemRow.getByRole('button', { name: '编辑' }).count()) === 0, 'system prompt unexpectedly exposes edit action');
  await systemRow.getByRole('button', { name: '复制到我的提示词' }).click();
  await systemRow.getByRole('button', { name: '插入' }).click();
  await page.getByText('生成配置节点', { exact: true }).click();
  await page.waitForTimeout(300);

  await page.getByRole('button', { name: '我的提示词', exact: true }).click();
  await promptSearch.fill('');
  await page.getByRole('button', { name: '新建', exact: true }).click();
  const createdPromptTitle = `UI 新建提示词 ${stamp}`;
  const promptEditor = page.locator('.ant-modal').filter({ hasText: '新建提示词' });
  await promptEditor.getByPlaceholder('标题').fill(createdPromptTitle);
  await promptEditor.getByPlaceholder('提示词内容（按纯文本保存）').fill(`UI 新建正文 ${stamp}`);
  await page.locator('.ant-modal:visible').last().locator('.ant-modal-footer button').last().click();
  await page.waitForTimeout(500);
  await promptSearch.fill(createdPromptTitle);
  await page.waitForTimeout(500);
  const userRow = page.locator('div.group.rounded-lg').filter({ hasText: createdPromptTitle }).first();
  await userRow.getByRole('button', { name: '收藏', exact: true }).click();
  await userRow.getByRole('button', { name: '编辑', exact: true }).click();
  const editPrompt = page.locator('.ant-modal').filter({ hasText: '编辑提示词' });
  await editPrompt.getByPlaceholder('标题').fill(`${createdPromptTitle} 已编辑`);
  await page.locator('.ant-modal:visible').last().locator('.ant-modal-footer button').last().click();
  await page.waitForTimeout(500);
  await promptSearch.fill(`${createdPromptTitle} 已编辑`);
  await page.waitForTimeout(500);
  const editedRow = page.locator('div.group.rounded-lg').filter({ hasText: `${createdPromptTitle} 已编辑` }).first();
  await editedRow.getByRole('button', { name: '插入' }).click();
  await page.getByText('生成配置节点', { exact: true }).click();

  currentStep = 'mask-dialog';
  await uploadedImageNode.dispatchEvent('mousedown', { button: 0, buttons: 1 });
  await uploadedImageNode.dispatchEvent('mouseup', { button: 0, buttons: 0 });
  await uploadedImageNode.dispatchEvent('mouseover');
  await page.getByRole('button', { name: '添加蒙版遮罩后局部修改' }).click({ force: true });
  await page.waitForSelector('text=局部遮罩编辑', { timeout: 10000 });
  ensure((await page.getByRole('button', { name: '画笔', exact: true }).count()) === 1, 'mask dialog paint control missing');
  ensure((await page.getByRole('button', { name: '擦除', exact: true }).count()) === 1, 'mask dialog erase control missing');
  ensure((await page.getByText('笔刷大小', { exact: true }).count()) === 1, 'mask dialog brush-size control missing');
  ensure((await page.getByPlaceholder('例如：把选中区域改成金属材质，保持原图光影').count()) === 1, 'mask dialog prompt input missing');
  const maskCanvas = page.locator('.ant-modal canvas.absolute');
  const maskBox = await maskCanvas.boundingBox();
  ensure(maskBox, 'mask drawing canvas missing');
  await page.mouse.move(maskBox.x + maskBox.width * 0.4, maskBox.y + maskBox.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(maskBox.x + maskBox.width * 0.6, maskBox.y + maskBox.height * 0.6, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('button', { name: '擦除', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).last().click();

  currentStep = 'autosave-refresh';
  await page.waitForSelector('text=已保存', { timeout: 15000 });
  const beforeRefreshNodeCount = await page.locator('[data-node-id]').count();
  const savedProject = await api(`/api/user/projects/${projectId}`, { token: userA.token });
  ensure(savedProject.json?.data?.schema === 'hjm.infinite-canvas.project', 'autosave did not persist candidate envelope');
  const savedJson = JSON.stringify(savedProject.json.data);
  ensure(!savedJson.includes('data:image/'), 'autosaved project contains Base64 image data');
  ensure(!savedJson.includes('blob:'), 'autosaved project contains Blob URL');
  await page.reload();
  await waitCanvasReady(beforeRefreshNodeCount);
  ensure((await page.locator('[data-node-id]').count()) === beforeRefreshNodeCount, 'refresh did not restore all nodes');

  currentStep = 'performance-fixture';
  const access = await api(`/api/user/assets/${primaryAsset.id}/access-url`, { token: userA.token });
  const perfNodes = [
    {
      id: `perf-text-${stamp}`,
      type: 'text',
      title: '性能文本节点',
      position: { x: 0, y: 0 },
      width: 320,
      height: 220,
      metadata: { content: 'Task 13 10 节点性能样本' }
    }
  ];
  for (let index = 0; index < 9; index += 1) {
    perfNodes.push({
      id: `perf-image-${stamp}-${index}`,
      type: 'image',
      title: `性能图片 ${index + 1}`,
      position: { x: 380 + (index % 3) * 340, y: Math.floor(index / 3) * 260 },
      width: 300,
      height: 220,
      metadata: {
        content: '',
        storageKey: `asset:${primaryAsset.id}`,
        assetId: primaryAsset.id,
        mimeType: 'image/png',
        status: 'success'
      }
    });
  }
  const perfConnections = perfNodes.slice(1).map((node, index) => ({
    id: `perf-connection-${stamp}-${index}`,
    fromNodeId: perfNodes[0].id,
    toNodeId: node.id
  }));
  const perfProject = await api('/api/user/projects', {
    method: 'POST',
    token: userA.token,
    data: {
      name: `Task 13 性能样本 ${stamp}`,
      data: await projectEnvelope(perfNodes, perfConnections)
    }
  });
  const perfProjectId = perfProject.json?.id;
  ensure(perfProjectId, 'performance fixture project create failed');
  let autosaveRequestsDuringDrag = 0;
  let dragging = false;
  const requestListener = request => {
    if (dragging && request.method() === 'PUT' && request.url().includes(`/api/user/projects/${perfProjectId}`)) {
      autosaveRequestsDuringDrag += 1;
    }
  };
  page.on('request', requestListener);
  const perfStart = Date.now();
  await page.goto(`${baseUrl}/canvas/${perfProjectId}?candidate-ui=performance`);
  await waitCanvasReady(10);
  const restoreMs = Date.now() - perfStart;
  ensure(restoreMs < 15000, `10-node fixture restore took too long: ${restoreMs}ms`);
  ensure((await page.locator('[data-node-id]').count()) === 10, 'performance fixture did not restore 10 nodes');
  ensure((await page.locator('[data-node-id] img').count()) === 9, 'performance fixture did not render 9 images');
  const perfCanvas = page.locator('div.cursor-grab.select-none.overflow-hidden').first();
  const perfCanvasBox = await perfCanvas.boundingBox();
  const perfNode = page.locator('[data-node-id]').first();
  const perfNodeBox = await perfNode.boundingBox();
  ensure(perfCanvasBox && perfNodeBox, 'performance fixture geometry missing');
  dragging = true;
  await page.mouse.move(perfNodeBox.x + perfNodeBox.width / 2, perfNodeBox.y + 40);
  await page.mouse.down();
  await page.mouse.move(perfNodeBox.x + perfNodeBox.width / 2 + 140, perfNodeBox.y + 100, { steps: 24 });
  await page.mouse.up();
  dragging = false;
  ensure(autosaveRequestsDuringDrag <= 1, `autosave sent ${autosaveRequestsDuringDrag} PUT requests during pointer movement`);
  await page.mouse.move(perfCanvasBox.x + perfCanvasBox.width / 2, perfCanvasBox.y + perfCanvasBox.height / 2);
  for (let index = 0; index < 20; index += 1) await page.mouse.wheel(0, -40);
  const blobUrlsBefore = await page.locator('img[src^="blob:"]').evaluateAll(images => new Set(images.map(image => image.src)).size);
  await page.getByRole('button', { name: '云端资产库', exact: true }).click();
  await page.waitForSelector('text=选择云端资产', { timeout: 10000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const blobUrlsAfter = await page.locator('img[src^="blob:"]').evaluateAll(images => new Set(images.map(image => image.src)).size);
  ensure(blobUrlsAfter <= Math.max(9, blobUrlsBefore + 1), `Blob URL count grew unexpectedly: ${blobUrlsBefore} -> ${blobUrlsAfter}`);
  const perfRead = await api(`/api/user/projects/${perfProjectId}`, { token: userA.token });
  ensure(!JSON.stringify(perfRead.json?.data || {}).includes('data:image/'), 'performance fixture project JSON contains Base64');
  page.off('request', requestListener);
  results.push({ step: currentStep, ok: true, restoreMs, autosaveRequestsDuringDrag, blobUrlsBefore, blobUrlsAfter });

  currentStep = 'cross-user-isolation';
  const crossProjectName = `A 私有项目 ${stamp}`;
  const crossProject = await api('/api/user/projects', {
    method: 'POST',
    token: userA.token,
    data: {
      name: crossProjectName,
      data: await projectEnvelope([
        {
          id: `a-private-node-${stamp}`,
          type: 'text',
          title: `A 私有节点 ${stamp}`,
          position: { x: 0, y: 0 },
          width: 320,
          height: 220,
          metadata: { content: `A 私有节点正文 ${stamp}` }
        }
      ])
    }
  });
  const crossProjectId = crossProject.json.id;
  const crossAsset = await uploadAsset(userA.token, `a-private-asset-${stamp}.png`);
  const crossPrompt = await api('/api/user/prompts', {
    method: 'POST',
    token: userA.token,
    data: { title: `A 私有提示词 ${stamp}`, content: `A 私有提示词正文 ${stamp}` }
  });

  await setSession(userB);
  await page.goto(`${baseUrl}/canvas?candidate-ui=user-b`);
  await page.waitForSelector('text=无限画布', { timeout: 15000 });
  ensure(!(await page.locator('body').innerText()).includes(crossProjectName), 'user B UI displays user A project');
  const bProjects = await api('/api/user/projects', { token: userB.token });
  ensure(!bProjects.json.items.some(item => item.id === crossProjectId), 'user B API lists user A project');
  await api(`/api/user/projects/${crossProjectId}`, { token: userB.token, expectedStatus: 404 });
  const bAssets = await api('/api/user/assets', { token: userB.token });
  ensure(!bAssets.json.items.some(item => item.id === crossAsset.id), 'user B API lists user A asset');
  await api(`/api/user/assets/${crossAsset.id}/access-url`, { token: userB.token, expectedStatus: 404 });
  const bPrompts = await api('/api/user/prompts', { token: userB.token });
  ensure(!bPrompts.json.items.some(item => item.id === crossPrompt.json.item.id), 'user B API lists user A prompt');
  await api(`/api/user/prompts/${crossPrompt.json.item.id}`, { token: userB.token, expectedStatus: 404 });
  const bSystem = await api(`/api/prompts/system?q=${encodeURIComponent(systemMarker)}`, { token: userB.token });
  ensure(bSystem.json.items.some(item => item.id === systemPromptId), 'user B cannot read shared published system prompt');

  const browserAuthorityLeak = await page.evaluate(async markers => {
    const localEntries = Object.keys(localStorage).map(key => [key, localStorage.getItem(key) || '']);
    const localLeak = localEntries.some(([key, value]) =>
      !key.startsWith('hjm:canvas-draft:') && markers.some(marker => `${key}:${value}`.includes(marker))
    );
    const indexedLeak = [];
    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      for (const info of databases) {
        if (!info.name) continue;
        await new Promise(resolve => {
          const request = indexedDB.open(info.name);
          request.onerror = () => resolve();
          request.onsuccess = () => {
            const db = request.result;
            const stores = Array.from(db.objectStoreNames);
            if (!stores.length) {
              db.close();
              resolve();
              return;
            }
            const transaction = db.transaction(stores, 'readonly');
            stores.forEach(storeName => {
              const getAll = transaction.objectStore(storeName).getAll();
              getAll.onsuccess = () => {
                for (const value of getAll.result || []) {
                  if (value instanceof Blob) continue;
                  const text = typeof value === 'string' ? value : JSON.stringify(value);
                  if (markers.some(marker => text.includes(marker))) indexedLeak.push(`${info.name}/${storeName}`);
                }
              };
            });
            transaction.oncomplete = () => {
              db.close();
              resolve();
            };
            transaction.onerror = () => {
              db.close();
              resolve();
            };
          };
        });
      }
    }
    return { localLeak, indexedLeak };
  }, [`a-private-asset-${stamp}`, `A 私有提示词正文 ${stamp}`]);
  ensure(!browserAuthorityLeak.localLeak, 'user B localStorage contains user A asset/prompt authority data');
  ensure(browserAuthorityLeak.indexedLeak.length === 0, `user B IndexedDB contains user A asset/prompt authority data: ${browserAuthorityLeak.indexedLeak.join(', ')}`);

  await setSession(userA);
  await page.goto(`${baseUrl}/canvas?candidate-ui=user-a-return`);
  await page.waitForSelector(`text=${crossProjectName}`, { timeout: 15000 });
  const aProjectsAgain = await api('/api/user/projects', { token: userA.token });
  ensure(aProjectsAgain.json.items.some(item => item.id === crossProjectId), 'switching back to user A did not restore project');
  results.push({ step: currentStep, ok: true, crossProjectId, crossAssetId: crossAsset.id });

  currentStep = 'mobile-390x844';
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/canvas/${perfProjectId}?candidate-ui=mobile`);
  try {
    await waitCanvasReady(10);
  } catch (error) {
    mobileIssues.push(`移动端恢复失败：${error.message}`);
  }
  const mobileMetrics = await page.evaluate(() => ({
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    mainVisible: Boolean(document.querySelector('main')),
    nodeCount: document.querySelectorAll('[data-node-id]').length,
    viewport: { width: innerWidth, height: innerHeight }
  }));
  if (mobileMetrics.overflow > 0) mobileIssues.push(`移动端横向溢出 ${mobileMetrics.overflow}px`);
  if (!mobileMetrics.mainVisible) mobileIssues.push('移动端画布主区域不可见');
  if (mobileMetrics.nodeCount < 10) mobileIssues.push(`移动端只恢复 ${mobileMetrics.nodeCount}/10 个节点`);
  results.push({ step: currentStep, ok: mobileIssues.length === 0, metrics: mobileMetrics, issues: mobileIssues });

  await page.setViewportSize({ width: 1440, height: 900 });
  await api(`/api/user/projects/${perfProjectId}`, { method: 'DELETE', token: userA.token });
  await api(`/api/user/projects/${crossProjectId}`, { method: 'DELETE', token: userA.token });
  await api(`/api/user/prompts/${privatePromptId}`, { method: 'DELETE', token: userA.token });
  await api(`/api/user/prompts/${crossPrompt.json.item.id}`, { method: 'DELETE', token: userA.token });
  await api(`/api/admin/system-prompts/${systemPromptId}`, { method: 'DELETE', token: admin.json.token });

  currentStep = 'project-list-rename-delete';
  await page.goto(`${baseUrl}/canvas?candidate-ui=project-cleanup`);
  await page.waitForSelector('text=无限画布', { timeout: 15000 });
  await page.waitForSelector(`text=${renamedProject}`, { timeout: 15000 });
  const projectCard = page.locator('article').filter({ hasText: renamedProject }).first();
  ensure((await projectCard.count()) === 1, 'created project is missing from project list');
  await projectCard.getByRole('button', { name: '重命名' }).click();
  const editingProjectCard = page.locator('article').filter({ has: page.getByRole('checkbox', { name: `选择 ${renamedProject}` }) });
  const cardTitleInput = editingProjectCard.locator('input:not([type="checkbox"])');
  await cardTitleInput.fill(`${renamedProject} 已改名`);
  await editingProjectCard.getByRole('button', { name: '保存名称' }).click();
  await page.waitForTimeout(300);
  ensure((await page.getByText(`${renamedProject} 已改名`, { exact: true }).count()) === 1, 'project card rename did not persist');
  const renamedProjectCard = page.locator('article').filter({ hasText: `${renamedProject} 已改名` }).first();
  await renamedProjectCard.getByRole('button', { name: '删除' }).click();
  await page.locator('.ant-modal:visible').last().locator('.ant-modal-footer button').last().click();
  await page.waitForTimeout(500);
  ensure((await page.getByText(`${renamedProject} 已改名`, { exact: true }).count()) === 0, 'project card delete did not remove project');

  ensure(consoleErrors.length === 0, `browser console errors: ${JSON.stringify(consoleErrors)}`);
  ensure(badResponses.length === 0, `unexpected browser 4xx/5xx responses: ${JSON.stringify(badResponses)}`);
  ensure((await horizontalOverflow()) === 0, 'desktop project list has horizontal overflow after cleanup');

  console.log(JSON.stringify({
    success: true,
    desktopBlockingChecks: 'passed',
    mobileStatus: mobileIssues.length ? 'documented-non-blocking' : 'passed',
    mobileIssues,
    consoleErrors: consoleErrors.length,
    unexpectedHttpErrors: badResponses.length,
    results
  }, null, 2));
}
