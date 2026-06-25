async page => {
  const originMatch = String(page.url()).match(/^(https?:\/\/[^/]+)/);
  const baseUrl = originMatch ? originMatch[1] : 'http://127.0.0.1:3456';
  const screenshotPath = 'docs/design-references/frontend-2026-06-25/canvas-json-smoke-desktop-1440x900.png';
  const workflowId = 'canvas_json_smoke_' + Date.now();
  const canvasData = {
    nodes: [
      {
        id: 'json_text_node',
        type: 'text',
        position: { x: 120, y: 140 },
        data: {
          label: '文本输入',
          content: '画布 JSON smoke：本地导入/导出结构验证'
        }
      },
      {
        id: 'json_image_node',
        type: 'imageConfig',
        position: { x: 480, y: 140 },
        data: {
          label: '文生图',
          prompt: '电商自动化工作台，透明玻璃质感，干净工具台界面',
          model: 'gpt-image-2',
          size: '1024x1024'
        }
      }
    ],
    edges: [
      {
        id: 'json_edge_1',
        source: 'json_text_node',
        target: 'json_image_node',
        sourceHandle: 'right',
        targetHandle: 'left'
      }
    ],
    viewport: { x: 0, y: 0, zoom: 1 }
  };

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(baseUrl + '/?canvas-json-smoke=seed');
  await page.waitForLoadState('load');

  const result = await page.evaluate(async ({ workflowId, canvasData }) => {
    const loginResponse = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const login = await loginResponse.json();
    if (!login.token || !login.user) {
      throw new Error('admin login failed');
    }

    localStorage.setItem('auth_token', login.token);
    localStorage.setItem('auth_user', JSON.stringify(login.user));

    const saveResponse = await fetch(`/api/workflows/${encodeURIComponent(workflowId)}/save-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.token}`
      },
      body: JSON.stringify({
        name: '画布 JSON Smoke',
        data: canvasData
      })
    });
    const saved = await saveResponse.json();
    if (!saved.success || saved.workflowId !== workflowId) {
      throw new Error('save-json failed');
    }

    const projectResponse = await fetch(`/api/user/projects/${encodeURIComponent(workflowId)}`, {
      headers: { Authorization: `Bearer ${login.token}` }
    });
    const project = await projectResponse.json();
    if (!project.success || !project.data || project.data.nodes.length !== 2 || project.data.edges.length !== 1) {
      throw new Error('saved project json was not readable');
    }

    localStorage.setItem('ai-canvas-projects-summary', JSON.stringify([
      {
        id: workflowId,
        name: '画布 JSON Smoke',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        canvasData
      }
    ]));

    return {
      token: login.token,
      user: login.user,
      workflowId,
      nodes: project.data.nodes.length,
      edges: project.data.edges.length
    };
  }, { workflowId, canvasData });

  const consoleIssues = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      consoleIssues.push(message.text());
    }
  });

  await page.goto(baseUrl + '/canvas/' + encodeURIComponent(result.workflowId) + '?canvas-json-smoke=1');
  await page.waitForLoadState('load');
  await page.waitForTimeout(1800);

  const jsonInputs = page.locator('input[type="file"][accept*="json"]');
  if (await jsonInputs.count() < 1) {
    throw new Error('canvas json file input was not found');
  }
  await page.evaluate(({ canvasData }) => {
    const input = document.querySelector('input[type="file"][accept*="json"]');
    if (!input) {
      throw new Error('canvas json file input was not found in browser');
    }
    const file = new File(
      [JSON.stringify(canvasData, null, 2)],
      'canvas-json-smoke.workflow.json',
      { type: 'application/json' }
    );
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, { canvasData });
  await page.waitForTimeout(1200);

  const pageState = await page.evaluate(() => {
    const bodyText = document.body.innerText || '';
    const vueFlow = document.querySelector('.vue-flow');
    const nodes = document.querySelectorAll('.vue-flow__node, [data-id="json_text_node"], [data-id="json_image_node"]');
    return {
      bodyLength: bodyText.trim().length,
      hasVueFlow: Boolean(vueFlow),
      nodeCount: nodes.length,
      hasCanvasText: bodyText.includes('画布') || bodyText.includes('文生图') || bodyText.includes('文本输入')
    };
  });

  if (!pageState.hasVueFlow || pageState.bodyLength < 80 || pageState.nodeCount < 2) {
    throw new Error('canvas page did not import and render the workflow json nodes');
  }

  await page.screenshot({
    path: screenshotPath,
    fullPage: false
  });

  const cleanup = await page.evaluate(async ({ workflowId, token }) => {
    const response = await fetch(`/api/user/projects/${encodeURIComponent(workflowId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    return await response.json();
  }, { workflowId: result.workflowId, token: result.token });

  if (!cleanup.success) {
    throw new Error('cleanup project failed');
  }

  return {
    ok: true,
    workflowId: result.workflowId,
    nodes: result.nodes,
    edges: result.edges,
    pageState,
    screenshot: screenshotPath,
    consoleErrors: consoleIssues
  };
}
