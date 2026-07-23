async page => {
  const origin = await page.evaluate(() => window.location.origin);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${origin}/canvas?canvas-prompt-readability-smoke=1`, {
    waitUntil: 'domcontentloaded'
  });
  await page.locator('.vue-flow').first().waitFor({ state: 'visible', timeout: 30000 });

  const result = await page.evaluate(() => {
    document.getElementById('canvas-prompt-readability-probe')?.remove();
    const probe = document.createElement('div');
    probe.id = 'canvas-prompt-readability-probe';
    probe.className = 'vue-flow';
    probe.style.cssText = [
      'position:fixed',
      'left:48px',
      'top:48px',
      'z-index:99999',
      'width:auto',
      'height:auto',
      'overflow:visible',
      'padding:24px',
      'border-radius:32px',
      'background:#0f172a'
    ].join(';');
    probe.innerHTML = `
      <div class="image-prompt-generate-node" data-v-99124632>
        <div class="node-header" data-v-99124632>
          <div data-v-99124632>
            <div class="node-title" data-v-99124632>图片生成</div>
            <div class="node-subtitle" data-v-99124632>PROMPT + IMAGE GENERATOR</div>
          </div>
        </div>
        <div class="node-body" data-v-99124632>
          <textarea class="prompt-input nodrag nowheel" data-v-99124632 readonly>用图1的产品生成一个电商主图，清晰展现包装文字与产品质感。主图风格参考图2，保持排版留白和自然光影。</textarea>
        </div>
      </div>`;
    document.body.appendChild(probe);

    const node = probe.querySelector('.image-prompt-generate-node');
    const prompt = probe.querySelector('.prompt-input');
    const nodeStyle = getComputedStyle(node);
    const promptStyle = getComputedStyle(prompt);
    return {
      nodeWidth: Math.round(node.getBoundingClientRect().width),
      promptHeight: Math.round(prompt.getBoundingClientRect().height),
      promptMinHeight: promptStyle.minHeight,
      fontSize: promptStyle.fontSize,
      fontWeight: promptStyle.fontWeight,
      lineHeight: promptStyle.lineHeight,
      color: promptStyle.color,
      stylesheetLoaded: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link =>
        link.href.includes('/assets/canvas-image-node-polish.css?v=20260721promptread1')
      )
    };
  });

  if (!result.stylesheetLoaded) throw new Error('Prompt readability stylesheet is missing');
  if (result.nodeWidth !== 480) throw new Error(`Expected node width 480px, got ${result.nodeWidth}px`);
  if (result.promptHeight < 168) throw new Error(`Expected prompt height >= 168px, got ${result.promptHeight}px`);
  if (result.fontSize !== '15px') throw new Error(`Expected 15px font, got ${result.fontSize}`);
  if (result.fontWeight !== '600') throw new Error(`Expected weight 600, got ${result.fontWeight}`);
  if (result.lineHeight !== '27px') throw new Error(`Expected 27px line height, got ${result.lineHeight}`);

  const screenshotPath = 'canvas-prompt-readability-smoke.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await page.evaluate(() => {
    document.body.dataset.canvasPromptReadabilitySmoke = 'done';
  });
  return { completed: true, screenshotPath, ...result };
}
