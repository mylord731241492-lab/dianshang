async page => {
  const baseUrl = await page.evaluate(() => location.origin);
  const stamp = Date.now();
  const consoleErrors = [];
  const ensure = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('favicon')) consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(error.message));

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    const response = await page.request.fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      ...(options.data !== undefined ? { data: options.data } : {})
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    ensure(response.ok(), `${options.method || 'GET'} ${path} failed with HTTP ${response.status()}: ${text}`);
    return json;
  }

  const username = `node-ui-${stamp}`;
  const password = `Node-Ui!2026-${stamp}`;
  const session = await api('/api/auth/register', {
    method: 'POST',
    data: { username, email: `${username}@test.internal`, password }
  });
  const admin = await api('/api/admin/login', {
    method: 'POST',
    data: { username: 'admin', password: 'CanvasCandidate!2026!Strong' }
  });
  await api(`/api/admin/users/${session.user.id}/balance`, {
    method: 'POST',
    token: admin.token,
    data: { amount: 100, remark: '图片节点和生图节点隔离 UI 验收' }
  });

  const imageNodeId = `image-node-${stamp}`;
  const generationNodeId = `generation-node-${stamp}`;
  const project = await api('/api/user/projects', {
    method: 'POST',
    token: session.token,
    data: {
      name: `节点专项验收 ${stamp}`,
      data: {
        schema: 'hjm.infinite-canvas.project',
        schemaVersion: 1,
        engine: 'infinite-canvas',
        upstreamVersion: '0.10.0',
        project: {
          nodes: [
            {
              id: imageNodeId,
              type: 'image',
              title: '图片节点',
              position: { x: 80, y: 120 },
              width: 320,
              height: 320,
              metadata: { status: 'idle' }
            },
            {
              id: generationNodeId,
              type: 'config',
              title: '生图节点',
              position: { x: 560, y: 80 },
              width: 420,
              height: 420,
              metadata: {
                status: 'idle',
                prompt: '电商产品棚拍，白色背景，柔和阴影',
                composerContent: '电商产品棚拍，白色背景，柔和阴影',
                model: 'gpt-image-2',
                size: '1:1',
                quality: 'auto',
                count: 4
              }
            }
          ],
          connections: [],
          chatSessions: [],
          activeChatId: null,
          backgroundMode: 'lines',
          showImageInfo: false,
          viewport: { x: 350, y: 120, k: 0.75 }
        }
      }
    }
  });

  await page.goto(`${baseUrl}/login?node-ui-bootstrap=1`);
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
  }, { token: session.token, user: session.user });
  await page.goto(`${baseUrl}/canvas/${project.id}?node-ui-smoke=1`);
  await page.waitForFunction(() => document.querySelectorAll('[data-node-id]').length === 2, null, { timeout: 15000 });

  const imageNode = page.locator(`[data-node-id="${imageNodeId}"]`);
  ensure((await imageNode.getByText('图片节点', { exact: true }).count()) === 1, '图片节点没有常驻标题');
  const uploadButton = imageNode.getByRole('button', { name: '选择图片', exact: true });
  ensure((await uploadButton.count()) === 1, '图片节点缺少“选择图片”入口');
  ensure((await imageNode.getByText('拖放图片到这里', { exact: false }).count()) === 1, '图片节点缺少拖放/粘贴提示');
  const uploadSetup = await page.evaluate(nodeId => {
    const input = document.querySelector('main input[type="file"]');
    const button = Array.from(document.querySelectorAll(`[data-node-id="${nodeId}"] button`)).find(candidate => candidate.textContent?.includes('选择图片'));
    if (!(input instanceof HTMLInputElement) || !(button instanceof HTMLButtonElement)) throw new Error('找不到图片节点上传控件');
    const nativeClick = input.click;
    input.click = () => {};
    button.click();
    input.click = nativeClick;
    return { accept: input.accept, buttonText: button.textContent };
  }, imageNodeId);
  await page.getByRole('main').locator('input[type="file"]').setInputFiles('F:\\dianshang-worktrees\\infinite-canvas-candidate\\frontend\\src\\assets\\home-product-workbench.png');
  try {
    await imageNode.locator('img').waitFor({ state: 'visible', timeout: 15000 });
  } catch {
    const notices = await page.locator('.ant-message, .ant-notification').allTextContents();
    const savedAfterDrop = await api(`/api/user/projects/${project.id}`, { token: session.token });
    throw new Error(`图片上传未写回：${JSON.stringify({ uploadSetup, notices, savedNode: savedAfterDrop.data?.project?.nodes?.find(node => node.id === imageNodeId) })}`);
  }
  await imageNode.click({ position: { x: 160, y: 280 } });
  await page.waitForTimeout(300);
  ensure((await page.getByPlaceholder('描述要生成的图片内容').count()) === 0, '图片节点仍打开了通用提示词/模型面板');

  const generationNode = page.locator(`[data-node-id="${generationNodeId}"]`);
  ensure((await generationNode.getByText('生图节点', { exact: true }).count()) === 1, '生图节点没有常驻标题');
  ensure((await generationNode.locator('[data-drawing-node-preview]').count()) === 1, '生图节点缺少独立结果画框');
  await generationNode.click({ position: { x: 210, y: 210 } });
  const drawingPanel = page.locator('[data-drawing-generation-panel]');
  await drawingPanel.waitFor({ state: 'visible', timeout: 10000 });
  ensure((await drawingPanel.getByRole('textbox', { name: '生图提示词' }).count()) === 1, '生图节点缺少提示词输入区');
  ensure((await drawingPanel.getByText('结果保留在本节点', { exact: true }).count()) === 1, '生图节点缺少参数与结果说明');
  const drawingNodeBox = await generationNode.boundingBox();
  const drawingPanelBox = await drawingPanel.boundingBox();
  ensure(Boolean(drawingNodeBox && drawingPanelBox && drawingPanelBox.width > drawingNodeBox.width * 1.6), '绘图参数面板没有按参考图横向展开');
  await page.getByRole('button', { name: '开始生成', exact: true }).click();
  await generationNode.locator('img').first().waitFor({ state: 'visible', timeout: 30000 });
  ensure((await generationNode.locator('img').count()) === 4, '生图节点没有在本节点内显示 4 张结果');
  ensure((await page.locator('[data-node-id]').count()) === 2, '生图结果散落成了额外图片节点');
  const gridClass = await generationNode.locator('.grid').first().getAttribute('class');
  ensure(gridClass?.includes('grid-cols-2') && gridClass?.includes('grid-rows-2'), `4 张结果不是 2×2 四宫格：${gridClass}`);

  await generationNode.locator('img[alt="生成结果 3"]').locator('..').click();
  await page.waitForTimeout(1400);
  const saved = await api(`/api/user/projects/${project.id}`, { token: session.token });
  const savedNode = saved.data?.project?.nodes?.find(node => node.id === generationNodeId);
  ensure(savedNode?.metadata?.generatedImages?.length === 4, '四张生图结果没有持久化');
  ensure(savedNode?.metadata?.selectedGeneratedImageIndex === 2, '选中的宫格结果没有持久化');
  ensure(!JSON.stringify(savedNode).includes('blob:'), '项目 JSON 写入了浏览器 blob 临时地址');
  ensure(consoleErrors.length === 0, `浏览器控制台错误：${JSON.stringify(consoleErrors)}`);

  await api(`/api/user/projects/${project.id}`, { method: 'DELETE', token: session.token });
  console.log(JSON.stringify({
    success: true,
    projectId: project.id,
    imageNode: { upload: true, resultVisible: true },
    generationNode: { imageCount: 4, layout: '2x2', scatteredNodes: 0, selectedIndex: 2 },
    consoleErrors
  }, null, 2));
}
