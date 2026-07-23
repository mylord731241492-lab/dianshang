async page => {
  const consoleErrors = [];
  const failedResponses = [];
  page.on('console', message => {
    const sourceUrl = String(message.location()?.url || '');
    const expectedAuthProbe =
      sourceUrl.includes('/chat/api/auth/logout') ||
      sourceUrl.includes('/chat/api/agents?requiredPermission=1');
    if (message.type() === 'error' && !expectedAuthProbe) consoleErrors.push(message.text());
  });
  page.on('response', response => {
    if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  const baseUrl = await page.evaluate(() => window.location.origin);
  await page.goto(`${baseUrl}/chat/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.location.pathname.startsWith('/chat/c/'), null, { timeout: 45000 });
  await page.getByText('电商主图设计师', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
  await page.getByRole('button', { name: '技能', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('heading', { name: 'Skills', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByText('试用引导', { exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  const reverseDescribeGuide = page.getByRole('button', { name: '选择 精确反推一张图', exact: true });
  await reverseDescribeGuide.waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: '选择 深读意图与效果', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: '选择 提炼一套视觉风格', exact: true }).waitFor({ state: 'visible', timeout: 15000 });
  await reverseDescribeGuide.click();
  if ((await reverseDescribeGuide.getAttribute('aria-pressed')) !== 'true') {
    throw new Error('Chat trial guide did not select image-reverse-describe');
  }
  const imageRouteSelect = page.getByLabel('选择生图线路', { exact: true });
  await imageRouteSelect.waitFor({ state: 'visible', timeout: 15000 });
  const imageRouteOptions = await imageRouteSelect.locator('option').count();
  if (imageRouteOptions < 2) {
    throw new Error(`Chat image route selector returned only ${imageRouteOptions} option(s)`);
  }

  const bodyText = await page.locator('body').innerText();
  if (/登录|注册|Sign in|Sign up/i.test(bodyText)) {
    throw new Error('Chat production UI fell back to a standalone login or registration screen');
  }
  if (failedResponses.length) {
    throw new Error(`Chat production UI returned server errors: ${failedResponses.join(' | ')}`);
  }
  if (consoleErrors.length) {
    throw new Error(`Chat production UI console errors: ${consoleErrors.join(' | ')}`);
  }

  await page.evaluate(() => {
    document.body.dataset.chatProductionUiSmoke = 'done';
  });
  const currentPath = await page.evaluate(() => window.location.pathname);
  return {
    completed: true,
    path: currentPath,
    managedAgentVisible: true,
    skillsVisible: true,
    skillTrialGuideVisible: true,
    imageRouteSelectorVisible: true,
    imageRouteOptions,
    consoleErrors: 0,
    serverErrors: 0
  };
}
