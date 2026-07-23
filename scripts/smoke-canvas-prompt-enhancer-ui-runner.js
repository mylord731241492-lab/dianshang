async page => {
  const origin = await page.evaluate(() => window.location.origin);
  const pngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nWQAAAAASUVORK5CYII=';
  const originalPrompt = '图1作为唯一产品，制作暖白背景的电商主图';
  const enhancedPrompt = '任务目标：基于图1中的唯一真实产品制作高转化电商主图，完整保持产品轮廓、宽高比例、包装结构、瓶盖、瓶身颜色、标签形状、Logo和原有包装文字。参考图角色：图1只用于锁定产品身份、结构、颜色与材质，不引入其他品牌、商品或文字。构图与镜头：采用正面略低机位商业摄影视角，产品居于视觉中心，占画面约六成，四周保留干净留白，主体边缘完整且不裁切。场景与光影：暖白渐变背景配合克制的台面反射，左前上方柔和主光与右侧弱补光形成自然层次，底部保留真实接触阴影，高光受控不过曝。材质与画质：瓶身纹理、标签纸张、印刷边缘和环境反射清晰自然，焦点准确，曝光稳定，轮廓清楚但不过度锐化，无压缩糊感。禁止主体变形、比例错误、结构缺失、标签或Logo变化、乱码、错别字、水印、二维码、多余商品、悬浮、边缘光晕、背景发灰和廉价CG感。';
  let enhanceRequests = [];
  let generationRequests = 0;

  await page.route('**/api/canvas/enhance-prompt', async route => {
    enhanceRequests.push(route.request().postDataJSON());
    await page.waitForTimeout(120);
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({ success: true, free: true, costPoints: 0, prompt: enhancedPrompt, text: enhancedPrompt })
    });
  });
  page.on('request', request => {
    if (request.url().includes('/api/generate/tasks')) generationRequests += 1;
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/?canvas-prompt-enhancer-login=1`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const data = await response.json();
    if (!response.ok || !data.token || !data.user) throw new Error('隔离 UI 验收登录失败');
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
  });
  await page.goto(`${origin}/canvas?canvas-prompt-enhancer-smoke=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('.vue-flow').first().waitFor({ state: 'visible', timeout: 30000 });

  await page.evaluate(({ pngDataUrl, originalPrompt }) => {
    document.getElementById('canvas-prompt-enhancer-probe')?.remove();
    const probe = document.createElement('div');
    probe.id = 'canvas-prompt-enhancer-probe';
    probe.className = 'vue-flow';
    probe.style.cssText = 'position:fixed;left:48px;top:48px;z-index:99999;width:auto;height:auto;overflow:visible;padding:24px;border-radius:32px;background:#0f172a';
    probe.innerHTML = `
      <div class="image-prompt-generate-node" data-v-99124632>
        <div class="node-header" data-v-99124632>
          <div data-v-99124632>
            <div class="node-title" data-v-99124632>图片生成</div>
            <div class="node-subtitle" data-v-99124632>PROMPT + IMAGE GENERATOR</div>
          </div>
        </div>
        <div class="node-body" data-v-99124632>
          <div class="prompt-shell" data-v-99124632>
            <div class="prompt-topline" data-v-99124632>
              <div class="prompt-pill active" data-v-99124632>提示词</div>
              <div class="prompt-pill" data-v-99124632>参考图 1</div>
            </div>
            <textarea class="prompt-input nodrag nowheel" data-v-99124632>${originalPrompt}</textarea>
          </div>
          <div class="reference-strip" data-v-99124632>
            <div class="reference-list" data-v-99124632>
              <div class="reference-thumb" data-v-99124632><img src="${pngDataUrl}" alt="" data-v-99124632><span data-v-99124632>1</span></div>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(probe);
  }, { pngDataUrl, originalPrompt });

  const button = page.locator('#canvas-prompt-enhancer-probe .hjm-prompt-enhance-button');
  await button.waitFor({ state: 'visible', timeout: 5000 });
  const before = await page.evaluate(() => {
    const host = document.querySelector('#canvas-prompt-enhancer-probe .prompt-shell');
    const field = document.querySelector('#canvas-prompt-enhancer-probe .prompt-input');
    const button = document.querySelector('#canvas-prompt-enhancer-probe .hjm-prompt-enhance-button');
    const hostRect = host.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return {
      buttonText: button.textContent.trim(),
      buttonRightGap: Math.round(hostRect.right - buttonRect.right),
      buttonBottomGap: Math.round(hostRect.bottom - buttonRect.bottom),
      fieldPaddingBottom: getComputedStyle(field).paddingBottom,
      buttonHeight: Math.round(buttonRect.height),
      buttonBackground: style.backgroundColor,
      scriptLoaded: Array.from(document.scripts).some(script => script.src.includes('/assets/canvas-prompt-enhancer.js?v=20260721enhance1')),
      stylesheetLoaded: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link => link.href.includes('/assets/canvas-prompt-enhancer.css?v=20260721enhance1')),
      fieldHeight: Math.round(fieldRect.height)
    };
  });

  if (!before.scriptLoaded || !before.stylesheetLoaded) throw new Error('AI 扩写脚本或样式未加载');
  if (before.buttonText !== '✦ AI 扩写') throw new Error(`按钮文案错误: ${before.buttonText}`);
  if (before.buttonRightGap < 12 || before.buttonRightGap > 13 || before.buttonBottomGap < 12 || before.buttonBottomGap > 13) {
    throw new Error(`按钮未位于右下角: right=${before.buttonRightGap}, bottom=${before.buttonBottomGap}`);
  }
  if (before.fieldPaddingBottom !== '60px') throw new Error(`文本框没有为按钮留白: ${before.fieldPaddingBottom}`);
  if (before.buttonHeight !== 34) throw new Error(`按钮高度错误: ${before.buttonHeight}`);

  const buttonScreenshotPath = 'output/playwright/canvas-prompt-enhancer-button-smoke.png';
  await page.locator('#canvas-prompt-enhancer-probe').screenshot({ path: buttonScreenshotPath });
  await button.click();
  await page.locator('#canvas-prompt-enhancer-probe .prompt-input').waitFor({ state: 'visible' });
  await page.waitForFunction(expected => document.querySelector('#canvas-prompt-enhancer-probe .prompt-input')?.value === expected, enhancedPrompt);

  if (enhanceRequests.length !== 1) throw new Error(`预期 1 次扩写请求，实际 ${enhanceRequests.length}`);
  if (enhanceRequests[0].currentPrompt !== originalPrompt) throw new Error('扩写请求没有保留原提示词');
  if (enhanceRequests[0].referenceImages?.length !== 1) throw new Error('扩写请求没有携带参考图');
  if (!String(enhanceRequests[0].referenceImages[0].dataUrl || '').startsWith('data:image/png;base64,')) throw new Error('参考图没有按真实 Data URL 上传');
  if (generationRequests !== 0) throw new Error('点击 AI 扩写错误触发了生图请求');

  const screenshotPath = 'output/playwright/canvas-prompt-enhancer-smoke.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });

  try {
    await page.evaluate(() => history.pushState({}, '', '/user/center'));
  } catch (error) {
    if (!/execution context was destroyed/i.test(String(error && error.message || error))) throw error;
  }
  await page.waitForURL('**/user/center', { timeout: 10000 });
  await page.waitForFunction(() => !window.__hjmCanvasPromptEnhancer && !document.querySelector('.hjm-prompt-enhance-button'));
  const teardown = await page.evaluate(() => ({
    path: location.pathname,
    debugObjectRemoved: !window.__hjmCanvasPromptEnhancer,
    buttons: document.querySelectorAll('.hjm-prompt-enhance-button').length,
    hosts: document.querySelectorAll('.hjm-prompt-enhance-host').length
  }));
  if (teardown.path !== '/user/center' || !teardown.debugObjectRemoved || teardown.buttons !== 0 || teardown.hosts !== 0) {
    throw new Error(`离开画布 teardown 失败: ${JSON.stringify(teardown)}`);
  }

  return {
    completed: true,
    screenshotPath,
    buttonScreenshotPath,
    before,
    request: {
      currentPrompt: enhanceRequests[0].currentPrompt,
      referenceImageCount: enhanceRequests[0].referenceImages.length
    },
    generationRequests,
    enhancedLength: enhancedPrompt.length,
    teardown
  };
}
