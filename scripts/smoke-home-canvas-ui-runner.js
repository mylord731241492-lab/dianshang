async page => {
  const baseUrlMatch = String(page.url()).match(/^(https?:\/\/[^/]+)/);
  const baseUrl = baseUrlMatch ? baseUrlMatch[1] : 'http://127.0.0.1:3456';
  const screenshotDir = 'docs/design-references/frontend-2026-06-25';
  const consoleErrors = [];
  const badResponses = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if (response.status() >= 400 && !url.includes('/favicon')) {
      badResponses.push({ status: response.status(), url });
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/?home-canvas-ui-smoke=home`);
  await page.waitForLoadState('load');
  await page.waitForTimeout(1600);

  const homeState = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const track = document.querySelector('.history-track');
    const cards = Array.from(document.querySelectorAll('.history-card'));
    return {
      hasBrand: text.includes('电商自动化工作台'),
      hasBeta: text.includes('Beta'),
      hasHero: text.includes('电商全流程工作台'),
      hasHistory: text.includes('我的历史画布项目'),
      hasNewCanvas: text.includes('新画布'),
      hasTemplate: text.includes('模板'),
      hasGallery: text.includes('图库'),
      hasTrack: !!track,
      inertiaReady: track?.dataset?.inertiaReady || '',
      cardCount: cards.length
    };
  });

  if (!homeState.hasBrand || !homeState.hasHero || !homeState.hasHistory || !homeState.hasNewCanvas || !homeState.hasTemplate || !homeState.hasGallery) {
    throw new Error(`home required text missing: ${JSON.stringify(homeState)}`);
  }
  if (!homeState.hasTrack || homeState.inertiaReady !== '1') {
    throw new Error(`home history inertia not ready: ${JSON.stringify(homeState)}`);
  }

  const estimateFailures = badResponses.filter((item) => item.url.includes('/api/generation/estimate-cost'));
  if (estimateFailures.length > 0) {
    throw new Error(`home estimate-cost returned error: ${JSON.stringify(estimateFailures)}`);
  }

  await page.screenshot({
    path: `${screenshotDir}/home-dashboard-smoke-desktop-1440x900.png`,
    fullPage: false
  });

  await page.goto(`${baseUrl}/canvas?home-canvas-ui-smoke=canvas`);
  await page.waitForLoadState('load');
  await page.waitForTimeout(1800);

  const canvasState = await page.evaluate(() => {
    const text = document.body.innerText || '';
    return {
      hasVueFlow: !!document.querySelector('.vue-flow'),
      nodeCount: document.querySelectorAll('.vue-flow__node').length,
      hasToolbarText: text.includes('导出') || text.includes('保存') || text.includes('历史记录') || text.includes('图库'),
      hasCanvasText: text.includes('画布') || text.includes('AI') || text.includes('上传') || text.includes('生成')
    };
  });

  if (!canvasState.hasVueFlow || !canvasState.hasToolbarText || !canvasState.hasCanvasText) {
    throw new Error(`canvas did not render expected shell: ${JSON.stringify(canvasState)}`);
  }

  await page.screenshot({
    path: `${screenshotDir}/canvas-open-smoke-desktop-1440x900.png`,
    fullPage: false
  });

  const fatalConsoleErrors = consoleErrors.filter((text) => !text.includes('Local workflow auto save skipped'));
  if (fatalConsoleErrors.length > 0 || badResponses.length > 0) {
    throw new Error(`home/canvas console or response errors: ${JSON.stringify({ fatalConsoleErrors, badResponses })}`);
  }

  return {
    ok: true,
    baseUrl,
    homeState,
    canvasState,
    estimateFailures,
    consoleErrors: fatalConsoleErrors.slice(0, 8),
    badResponses: badResponses.slice(0, 8)
  };
}
