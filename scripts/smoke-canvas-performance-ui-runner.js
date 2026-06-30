async page => {
  const baseUrlMatch = String(page.url()).match(/^(https?:\/\/[^/]+)/);
  const baseUrl = baseUrlMatch ? baseUrlMatch[1] : 'http://127.0.0.1:3456';
  const initialPageUrl = String(page.url());
  const isCanvasUrl = initialPageUrl.indexOf(`${baseUrl}/canvas`) === 0;
  const targetUrl = isCanvasUrl
    ? (
        initialPageUrl.includes('canvas-performance-smoke=')
          ? initialPageUrl.replace(/([?&])canvas-performance-smoke=[^&]*/i, '$1canvas-performance-smoke=1')
          : `${initialPageUrl}${initialPageUrl.includes('?') ? '&' : '?'}canvas-performance-smoke=1`
      )
    : `${baseUrl}/canvas?canvas-performance-smoke=1`;
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
  await page.goto(targetUrl);
  await page.waitForLoadState('load');
  await page.waitForTimeout(1800);

  const initialState = await page.evaluate(() => {
    const text = document.body.innerText || '';
    const scripts = Array.from(document.scripts).map((script) => script.src).filter(Boolean);
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.href).filter(Boolean);
    const imageAttrs = Array.from(document.querySelectorAll('.vue-flow__node img, .canvas-chat-panel img, .image-grid img, .canvas-chat-image-preview img'))
      .map((img) => ({
        loading: img.loading,
        decoding: img.decoding,
        broken: img.complete && img.naturalWidth === 0,
        width: img.naturalWidth || 0,
        height: img.naturalHeight || 0
      }));
    return {
      hasVueFlow: !!document.querySelector('.vue-flow'),
      hasViewport: !!document.querySelector('.vue-flow__viewport'),
      hasCanvasText: text.includes('画布') || text.includes('AI') || text.includes('新增节点') || text.includes('图片生成'),
      perfScriptLoaded: scripts.some((src) => src.includes('/assets/canvas-performance-mode.js?v=20260629perf5')),
      perfCssLoaded: styles.some((src) => src.includes('/assets/canvas-performance-mode.css?v=20260629perf5')),
      imageNodePolishCssLoaded: styles.some((src) => src.includes('/assets/canvas-image-node-polish.css?v=20260629image7')),
      imageNodePolishJsLoaded: scripts.some((src) => src.includes('/assets/canvas-image-node-polish.js?v=20260629image7')),
      appBundlePerfVersion: scripts.some((src) => src.includes('/assets/index-DglIsp_g.js?v=20260630dialogagent12')),
      hasPerfApi: !!window.__hjmCanvasPerformanceMode,
      hasImagePolishApi: !!window.__hjmCanvasImageNodePolish,
      hasPerfIsActive: typeof window.__hjmCanvasPerformanceMode?.isActive === 'function',
      hasPerfDebugState: typeof window.__hjmCanvasPerformanceMode?.getDebugState === 'function',
      hasPerfDeferHook: typeof window.__hjmCanvasPerformanceMode?.noteSaveDeferred === 'function',
      nodeCount: document.querySelectorAll('.vue-flow__node').length,
      imageAttrs
    };
  });

  if (!initialState.hasVueFlow || !initialState.hasViewport || !initialState.hasCanvasText) {
    throw new Error(`canvas shell missing: ${JSON.stringify(initialState)}`);
  }
  if (!initialState.perfScriptLoaded || !initialState.perfCssLoaded || !initialState.imageNodePolishCssLoaded || !initialState.imageNodePolishJsLoaded || !initialState.appBundlePerfVersion) {
    throw new Error(`canvas performance assets missing or stale: ${JSON.stringify(initialState)}`);
  }
  if (!initialState.hasPerfApi || !initialState.hasPerfIsActive || !initialState.hasPerfDebugState || !initialState.hasPerfDeferHook) {
    throw new Error(`canvas performance API incomplete: ${JSON.stringify(initialState)}`);
  }
  if (!initialState.hasImagePolishApi) {
    throw new Error(`canvas image node polish API missing: ${JSON.stringify(initialState)}`);
  }

  await page.evaluate(() => {
    const existing = document.getElementById('codex-canvas-performance-image-probe');
    if (existing) existing.remove();
    const wrapper = document.createElement('div');
    wrapper.id = 'codex-canvas-performance-image-probe';
    wrapper.className = 'vue-flow__node';
    wrapper.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:10px;height:10px;overflow:hidden;';
    const img = document.createElement('img');
    img.alt = 'canvas performance probe';
    img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
    wrapper.appendChild(img);
    document.body.appendChild(wrapper);
  });
  await page.waitForTimeout(120);
  const imageProbe = await page.evaluate(() => {
    const probe = document.querySelector('#codex-canvas-performance-image-probe img');
    const result = probe
      ? {
          loading: probe.loading,
          decoding: probe.decoding,
          broken: probe.complete && probe.naturalWidth === 0
        }
      : null;
    document.getElementById('codex-canvas-performance-image-probe')?.remove();
    return result;
  });
  if (!imageProbe || imageProbe.loading !== 'lazy' || imageProbe.decoding !== 'async' || imageProbe.broken) {
    throw new Error(`canvas performance image observer failed: ${JSON.stringify(imageProbe)}`);
  }

  const toolbarProbe = await page.evaluate(async () => {
    const existing = document.getElementById('codex-canvas-toolbar-probe');
    if (existing) existing.remove();
    const node = document.createElement('div');
    node.id = 'codex-canvas-toolbar-probe';
    node.className = 'vue-flow__node vue-flow__node-image';
    node.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    const wrapper = document.createElement('div');
    wrapper.className = 'image-node-wrapper';
    const card = document.createElement('div');
    card.className = 'image-node image-node-selected';
    card.style.cssText = 'position:relative;width:290px;height:220px;';
    const stage = document.createElement('div');
    stage.className = 'relative p-4';
    stage.innerHTML = '<div class="rounded-xl"><img src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27290%27 height=%27220%27 viewBox=%270 0 290 220%27%3E%3Crect width=%27290%27 height=%27220%27 fill=%27%23f97316%27/%3E%3C/svg%3E" alt=""></div>';
    const toolbar = document.createElement('div');
    toolbar.className = 'image-node-toolbar';
    toolbar.setAttribute('data-v-aaeac626', '');
    toolbar.innerHTML = '<button class="image-node-tool-button"><span class="tool-icon"></span><span class="tool-text">AI 扩图</span></button><button class="image-node-tool-button"><span class="tool-icon"></span><span class="tool-text">格式/压缩</span></button><button class="image-node-tool-button"><span class="tool-icon"></span><span class="tool-text">添加到聊天</span></button>';
    toolbar.querySelectorAll('.image-node-tool-button, .tool-icon, .tool-text').forEach((item) => item.setAttribute('data-v-aaeac626', ''));
    const toggle = document.createElement('div');
    toggle.className = 'image-node-toolbar-wrap';
    card.appendChild(stage);
    wrapper.appendChild(card);
    node.appendChild(wrapper);
    node.appendChild(toggle);
    node.appendChild(toolbar);
    document.body.appendChild(node);
    const img = node.querySelector('img');
    if (img && !img.complete) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 1000);
      });
    }
    if (img?.decode) {
      await img.decode().catch(() => {});
    }
    window.__hjmCanvasImageNodePolish?.markAll?.(node);
    const nodeStyle = getComputedStyle(node);
    const wrapperStyle = getComputedStyle(wrapper);
    const cardStyle = getComputedStyle(card);
    const stageRect = stage.querySelector('.rounded-xl').getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const toolbarStyle = getComputedStyle(toolbar);
    const toggleStyle = getComputedStyle(toggle);
    const result = {
      nodeContain: nodeStyle.contain,
      nodeOverflow: nodeStyle.overflow,
      wrapperContain: wrapperStyle.contain,
      wrapperOverflow: wrapperStyle.overflow,
      cardContain: cardStyle.contain,
      cardOverflow: cardStyle.overflow,
      toolbarZIndex: Number(toolbarStyle.zIndex || 0),
      toolbarDisplay: toolbarStyle.display,
      toolbarPosition: toolbarStyle.position,
      toolbarPointerEvents: toolbarStyle.pointerEvents,
      toolbarFlexDirection: toolbarStyle.flexDirection,
      toolbarWidth: Math.round(toolbarRect.width),
      toolbarHeight: Math.round(toolbarRect.height),
      buttonCount: toolbar.querySelectorAll('.image-node-tool-button').length,
      visibleButtonCount: Array.from(toolbar.querySelectorAll('.image-node-tool-button')).filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 20 && rect.height > 20 && rect.left >= toolbarRect.left - 1 && rect.right <= toolbarRect.right + 1;
      }).length,
      maxButtonWidth: Math.max(...Array.from(toolbar.querySelectorAll('.image-node-tool-button')).map((button) => Math.round(button.getBoundingClientRect().width))),
      toolbarAboveStage: toolbarRect.bottom <= stageRect.top - 6,
      toolbarOverlapsStage: !(toolbarRect.left >= stageRect.right || toolbarRect.right <= stageRect.left || toolbarRect.top >= stageRect.bottom || toolbarRect.bottom <= stageRect.top),
      toggleDisplay: toggleStyle.display
    };
    node.remove();
    return result;
  });
  if (
    toolbarProbe.nodeContain !== 'none' ||
    toolbarProbe.nodeOverflow !== 'visible' ||
    toolbarProbe.wrapperOverflow !== 'visible' ||
    toolbarProbe.cardOverflow !== 'visible' ||
    toolbarProbe.toolbarZIndex < 1000 ||
    toolbarProbe.toolbarDisplay !== 'flex' ||
    toolbarProbe.toolbarPosition !== 'absolute' ||
    toolbarProbe.toolbarPointerEvents !== 'auto' ||
    toolbarProbe.toolbarFlexDirection !== 'row' ||
    toolbarProbe.toolbarWidth <= toolbarProbe.toolbarHeight ||
    toolbarProbe.buttonCount < 3 ||
    toolbarProbe.visibleButtonCount < 3 ||
    toolbarProbe.maxButtonWidth > 150 ||
    !toolbarProbe.toolbarAboveStage ||
    toolbarProbe.toolbarOverlapsStage ||
    toolbarProbe.toggleDisplay !== 'none'
  ) {
    throw new Error(`canvas image toolbar is not a top floating bar: ${JSON.stringify(toolbarProbe)}`);
  }

  const imageNodeVisualProbe = await page.evaluate(() => {
    const existing = document.getElementById('codex-canvas-image-node-visual-probe');
    if (existing) existing.remove();
    const node = document.createElement('div');
    node.id = 'codex-canvas-image-node-visual-probe';
    node.className = 'vue-flow__node vue-flow__node-image';
    node.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:320px;';
    node.innerHTML = [
      '<div class="image-node-wrapper">',
      '<div class="image-node">',
      '<div class="relative p-4">',
      '<div class="space-y-4">',
      '<div class="relative h-[180px] rounded-2xl border border-dashed border-black/[0.08] bg-gradient-to-b from-white to-zinc-50 overflow-hidden flex flex-col items-center justify-center transition-all duration-300 hover:border-[var(--accent-color)]/30 hover:bg-[var(--accent-color)]/[0.03]">',
      '<div class="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-4"></div>',
      '<div class="text-sm font-medium text-zinc-700">拖拽图片上传</div>',
      '<div class="text-xs text-zinc-400 mt-1">支持 PNG / JPG / WEBP</div>',
      '<input type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer">',
      '</div>',
      '<div class="flex gap-2"><input type="text"><button>上传</button></div>',
      '</div>',
      '</div>',
      '<div class="image-node-toolbar-wrap"></div>',
      '<div class="image-node-toolbar"></div>',
      '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(node);
    const uploadZone = node.querySelector('.relative.h-\\[180px\\]');
    const urlRow = node.querySelector('.space-y-4 > .flex.gap-2');
    const toolbar = node.querySelector('.image-node-toolbar');
    const uploadRect = uploadZone.getBoundingClientRect();
    const result = {
      uploadWidth: Math.round(uploadRect.width),
      uploadHeight: Math.round(uploadRect.height),
      uploadAspect: Number((uploadRect.width / Math.max(1, uploadRect.height)).toFixed(2)),
      urlRowDisplay: getComputedStyle(urlRow).display,
      toolbarZIndex: Number(getComputedStyle(toolbar).zIndex || 0),
      toolbarPointerEvents: getComputedStyle(toolbar).pointerEvents
    };
    node.remove();
    return result;
  });
  if (
    imageNodeVisualProbe.uploadHeight < 250 ||
    Math.abs(imageNodeVisualProbe.uploadAspect - 1) > 0.12 ||
    imageNodeVisualProbe.urlRowDisplay !== 'none' ||
    imageNodeVisualProbe.toolbarZIndex < 1000 ||
    imageNodeVisualProbe.toolbarPointerEvents !== 'none'
  ) {
    throw new Error(`canvas image node visual polish failed: ${JSON.stringify(imageNodeVisualProbe)}`);
  }

  const loadedImageNodeProbe = await page.evaluate(async () => {
    const existing = document.getElementById('codex-canvas-loaded-image-node-probe');
    if (existing) existing.remove();
    const node = document.createElement('div');
    node.id = 'codex-canvas-loaded-image-node-probe';
    node.className = 'vue-flow__node vue-flow__node-image';
    node.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';
    node.innerHTML = [
      '<div class="image-node-wrapper">',
      '<div class="image-node image-node-selected">',
      '<div class="absolute inset-x-0 top-0 h-[120px]"></div>',
      '<div class="relative flex h-12 items-center justify-between gap-3 border-b border-black/5 px-3"><div class="truncate">参考图</div><div>原图可用</div></div>',
      '<div class="relative p-4"><div class="rounded-xl overflow-hidden relative border border-black/5 bg-zinc-50 group/img">',
      '<img class="w-full h-auto object-cover max-h-[220px]" src="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27800%27 height=%271000%27 viewBox=%270 0 800 1000%27%3E%3Crect width=%27800%27 height=%271000%27 fill=%27%23f97316%27/%3E%3C/svg%3E" alt="">',
      '</div></div>',
      '<div class="flex h-8 items-center justify-between gap-2 border-t border-black/5 bg-white/55 px-3 text-[11px] font-bold text-slate-500"><span>PNG · 800x1000 · 原图可用</span><span class="rounded-full"></span></div>',
      '<div class="image-quick-connect"></div>',
      '<div class="image-node-toolbar-wrap"></div>',
      '<div class="image-node-toolbar"><button>AI 扩图</button><button>图片裁剪</button><button>下载</button></div>',
      '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(node);
    const card = node.querySelector('.image-node');
    const stage = node.querySelector('.rounded-xl');
    const img = node.querySelector('img');
    const header = node.querySelector('.relative.flex.h-12');
    const meta = node.querySelector('.flex.h-8');
    const toolbar = node.querySelector('.image-node-toolbar');
    const toolbarWrap = node.querySelector('.image-node-toolbar-wrap');
    if (img && !img.complete) {
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;
        setTimeout(resolve, 1000);
      });
    }
    if (img?.decode) {
      await img.decode().catch(() => {});
    }
    window.__hjmCanvasImageNodePolish?.markAll?.(node);
    const result = {
      cardWidth: Math.round(card.getBoundingClientRect().width),
      stageWidth: Math.round(stage.getBoundingClientRect().width),
      stageHeight: Math.round(stage.getBoundingClientRect().height),
      imageWidth: Math.round(img.getBoundingClientRect().width),
      imageHeight: Math.round(img.getBoundingClientRect().height),
      imageObjectFit: getComputedStyle(img).objectFit,
      imageMaxHeight: getComputedStyle(img).maxHeight,
      headerPosition: getComputedStyle(header).position,
      headerTop: getComputedStyle(header).top,
      metaPosition: getComputedStyle(meta).position,
      metaTop: getComputedStyle(meta).top,
      orientation: node.getAttribute('data-image-orientation'),
      source: node.getAttribute('data-image-source'),
      toolbarBottom: Math.round(toolbar.getBoundingClientRect().bottom),
      stageTop: Math.round(stage.getBoundingClientRect().top),
      toolbarAboveStage: toolbar.getBoundingClientRect().bottom <= stage.getBoundingClientRect().top - 6,
      toolbarOverlapsStage: !(toolbar.getBoundingClientRect().left >= stage.getBoundingClientRect().right || toolbar.getBoundingClientRect().right <= stage.getBoundingClientRect().left || toolbar.getBoundingClientRect().top >= stage.getBoundingClientRect().bottom || toolbar.getBoundingClientRect().bottom <= stage.getBoundingClientRect().top),
      toolbarWrapDisplay: getComputedStyle(toolbarWrap).display
    };
    node.remove();
    return result;
  });
  if (
    loadedImageNodeProbe.imageObjectFit !== 'contain' ||
    loadedImageNodeProbe.imageHeight <= 220 ||
    loadedImageNodeProbe.stageHeight <= 220 ||
    loadedImageNodeProbe.headerPosition !== 'absolute' ||
    loadedImageNodeProbe.metaPosition !== 'absolute' ||
    loadedImageNodeProbe.orientation !== 'portrait' ||
    !loadedImageNodeProbe.toolbarAboveStage ||
    loadedImageNodeProbe.toolbarOverlapsStage ||
    loadedImageNodeProbe.toolbarWrapDisplay !== 'none'
  ) {
    throw new Error(`canvas loaded image node is not picture-first: ${JSON.stringify(loadedImageNodeProbe)}`);
  }

  const imageNodeRatioProbe = await page.evaluate(async () => {
    const existing = document.getElementById('codex-canvas-image-node-ratio-probe');
    if (existing) existing.remove();
    const root = document.createElement('div');
    root.id = 'codex-canvas-image-node-ratio-probe';
    root.style.cssText = 'position:absolute;left:-9999px;top:-9999px;display:flex;gap:80px;align-items:flex-start;';
    const cases = [
      { name: 'square', width: 900, height: 900, label: '标注' },
      { name: 'landscape', width: 1200, height: 600, label: '参考图' },
      { name: 'portrait', width: 600, height: 1200, label: '未标题-2' },
      { name: 'long', width: 663, height: 14999, label: '长图' },
      { name: 'generated', width: 800, height: 800, label: '图像生成结果' }
    ];
    const svg = (item) => `data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27${item.width}%27 height=%27${item.height}%27 viewBox=%270 0 ${item.width} ${item.height}%27%3E%3Crect width=%27${item.width}%27 height=%27${item.height}%27 fill=%27%23f97316%27/%3E%3C/svg%3E`;
    cases.forEach((item) => {
      const node = document.createElement('div');
      node.className = 'vue-flow__node vue-flow__node-image';
      node.innerHTML = [
        '<div class="image-node-wrapper">',
        '<div class="image-node image-node-selected">',
        '<div class="absolute inset-x-0 top-0 h-[120px]"></div>',
        `<div class="relative flex h-12 items-center justify-between gap-3 border-b border-black/5 px-3"><div class="truncate">${item.label}</div><div>原图可用</div></div>`,
        '<div class="relative p-4"><div class="rounded-xl overflow-hidden relative border border-black/5 bg-zinc-50 group/img">',
        `<img class="w-full h-auto object-cover max-h-[220px]" src="${svg(item)}" alt="${item.name}">`,
        '</div></div>',
        `<div class="flex h-8 items-center justify-between gap-2 border-t border-black/5 bg-white/55 px-3 text-[11px] font-bold text-slate-500"><span>PNG · ${item.width}x${item.height}</span><span class="rounded-full"></span></div>`,
        '<div class="image-quick-connect"></div>',
        '<div class="image-node-toolbar-wrap"></div>',
        '<div class="image-node-toolbar"><button>AI 扩图</button><button>图片裁剪</button><button>下载</button></div>',
        '</div>',
        '</div>'
      ].join('');
      root.appendChild(node);
    });
    document.body.appendChild(root);
    const images = Array.from(root.querySelectorAll('img'));
    await Promise.all(images.map(async (img) => {
      if (!img.complete) {
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          setTimeout(resolve, 1000);
        });
      }
      if (img.decode) await img.decode().catch(() => {});
    }));
    window.__hjmCanvasImageNodePolish?.markAll?.(root);
    const measurements = cases.map((item, index) => {
      const node = root.children[index];
      const stage = node.querySelector('.rounded-xl');
      const img = node.querySelector('img');
      const toolbar = node.querySelector('.image-node-toolbar');
      const wrap = node.querySelector('.image-node-toolbar-wrap');
      const stageRect = stage.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      const toolbarRect = toolbar.getBoundingClientRect();
      return {
        name: item.name,
        expectedOrientation: item.name === 'generated' ? 'square' : item.name,
        orientation: node.getAttribute('data-image-orientation'),
        source: node.getAttribute('data-image-source'),
        imageWidth: Math.round(imgRect.width),
        imageHeight: Math.round(imgRect.height),
        imageRatio: Number((imgRect.width / Math.max(1, imgRect.height)).toFixed(3)),
        sourceRatio: Number((item.width / item.height).toFixed(3)),
        imageObjectFit: getComputedStyle(img).objectFit,
        imageMaxHeight: getComputedStyle(img).maxHeight,
        toolbarAboveStage: toolbarRect.bottom <= stageRect.top - 6,
        toolbarOverlapsStage: !(toolbarRect.left >= stageRect.right || toolbarRect.right <= stageRect.left || toolbarRect.top >= stageRect.bottom || toolbarRect.bottom <= stageRect.top),
        toolbarWrapDisplay: getComputedStyle(wrap).display
      };
    });
    root.remove();
    return measurements;
  });
  const imageNodeRatioFailures = imageNodeRatioProbe.filter((item) => {
    const ratioDiff = Math.abs(item.imageRatio - item.sourceRatio);
    const longOk = item.name === 'long'
      ? item.orientation === 'long' && item.imageWidth >= 170 && item.imageWidth <= 270 && item.imageMaxHeight === 'none'
      : ratioDiff <= 0.04 && item.orientation === item.expectedOrientation;
    const generatedOk = item.name !== 'generated' || item.source === 'generated';
    return !longOk || !generatedOk || item.imageObjectFit !== 'contain' || !item.toolbarAboveStage || item.toolbarOverlapsStage || item.toolbarWrapDisplay !== 'none';
  });
  if (imageNodeRatioFailures.length > 0) {
    throw new Error(`canvas image node ratio/top toolbar probe failed: ${JSON.stringify({ imageNodeRatioProbe, imageNodeRatioFailures })}`);
  }

  const brokenImages = initialState.imageAttrs.filter((img) => img.broken);
  if (brokenImages.length > 0) {
    throw new Error(`canvas has broken images: ${JSON.stringify(brokenImages)}`);
  }
  const lazyFailures = initialState.imageAttrs.filter((img) => img.loading !== 'lazy' || img.decoding !== 'async');
  if (lazyFailures.length > 0) {
    throw new Error(`canvas images are not lazy/async decoded: ${JSON.stringify(lazyFailures)}`);
  }

  await page.mouse.move(760, 430);
  await page.mouse.down();
  await page.mouse.move(700, 440, { steps: 8 });
  await page.mouse.move(640, 430, { steps: 8 });
  await page.mouse.up();

  const afterDrag = await page.evaluate(() => {
    const viewport = document.querySelector('.vue-flow__viewport');
    const debugState = window.__hjmCanvasPerformanceMode?.getDebugState?.();
    return {
      active: document.documentElement.classList.contains('canvas-performance-active'),
      bodyActive: document.body.classList.contains('canvas-performance-active'),
      apiActive: window.__hjmCanvasPerformanceMode?.isActive?.() === true,
      debugActive: debugState?.active === true,
      viewportWillChange: viewport ? getComputedStyle(viewport).willChange : ''
    };
  });
  if (!afterDrag.active || !afterDrag.bodyActive || !afterDrag.apiActive || !afterDrag.debugActive) {
    throw new Error(`canvas performance class did not activate after drag: ${JSON.stringify(afterDrag)}`);
  }
  if (!String(afterDrag.viewportWillChange || '').includes('transform')) {
    throw new Error(`viewport will-change not enabled while active: ${JSON.stringify(afterDrag)}`);
  }

  await page.waitForTimeout(950);
  const afterDragIdle = await page.evaluate(() => ({
    active: document.documentElement.classList.contains('canvas-performance-active'),
    bodyActive: document.body.classList.contains('canvas-performance-active'),
    apiActive: window.__hjmCanvasPerformanceMode?.isActive?.() === true
  }));
  if (afterDragIdle.active || afterDragIdle.bodyActive || afterDragIdle.apiActive) {
    throw new Error(`canvas performance class did not clear after drag idle: ${JSON.stringify(afterDragIdle)}`);
  }

  const beforeWheelNodeVisual = await page.evaluate(() => {
    const node = document.querySelector('.vue-flow__node');
    if (!node) return null;
    const style = getComputedStyle(node);
    return {
      boxShadow: style.boxShadow,
      transitionDuration: style.transitionDuration,
      backdropFilter: style.backdropFilter || style.webkitBackdropFilter || ''
    };
  });

  await page.mouse.wheel(0, -600);
  const afterWheel = await page.evaluate(() => ({
    active: document.documentElement.classList.contains('canvas-performance-active'),
    bodyActive: document.body.classList.contains('canvas-performance-active'),
    zooming: document.documentElement.classList.contains('canvas-performance-zooming'),
    dragging: document.documentElement.classList.contains('canvas-performance-dragging'),
    apiActive: window.__hjmCanvasPerformanceMode?.isActive?.() === true,
    debugMode: window.__hjmCanvasPerformanceMode?.getDebugState?.().mode || '',
    nodeVisual: (() => {
      const node = document.querySelector('.vue-flow__node');
      if (!node) return null;
      const style = getComputedStyle(node);
      return {
        boxShadow: style.boxShadow,
        transitionDuration: style.transitionDuration,
        backdropFilter: style.backdropFilter || style.webkitBackdropFilter || ''
      };
    })()
  }));
  if (!afterWheel.active || !afterWheel.bodyActive || !afterWheel.zooming || afterWheel.dragging || !afterWheel.apiActive || afterWheel.debugMode !== 'zooming') {
    throw new Error(`canvas performance class did not activate after wheel: ${JSON.stringify(afterWheel)}`);
  }
  if (beforeWheelNodeVisual && afterWheel.nodeVisual) {
    if (
      beforeWheelNodeVisual.boxShadow !== afterWheel.nodeVisual.boxShadow ||
      beforeWheelNodeVisual.transitionDuration !== afterWheel.nodeVisual.transitionDuration ||
      beforeWheelNodeVisual.backdropFilter !== afterWheel.nodeVisual.backdropFilter
    ) {
      throw new Error(`canvas node visual style changed during wheel zoom: ${JSON.stringify({ beforeWheelNodeVisual, afterWheelNodeVisual: afterWheel.nodeVisual })}`);
    }
  }

  await page.waitForTimeout(700);
  const afterWheelIdle = await page.evaluate(() => ({
    active: document.documentElement.classList.contains('canvas-performance-active'),
    bodyActive: document.body.classList.contains('canvas-performance-active'),
    zooming: document.documentElement.classList.contains('canvas-performance-zooming'),
    dragging: document.documentElement.classList.contains('canvas-performance-dragging'),
    apiActive: window.__hjmCanvasPerformanceMode?.isActive?.() === true
  }));
  if (afterWheelIdle.active || afterWheelIdle.bodyActive || afterWheelIdle.zooming || afterWheelIdle.dragging || afterWheelIdle.apiActive) {
    throw new Error(`canvas performance class did not clear after wheel idle: ${JSON.stringify(afterWheelIdle)}`);
  }

  for (let i = 0; i < 20; i += 1) {
    await page.mouse.wheel(0, i % 2 === 0 ? -180 : 180);
  }
  const afterRepeatedWheel = await page.evaluate(() => ({
    active: document.documentElement.classList.contains('canvas-performance-active'),
    bodyActive: document.body.classList.contains('canvas-performance-active'),
    apiActive: window.__hjmCanvasPerformanceMode?.isActive?.() === true
  }));
  if (!afterRepeatedWheel.active || !afterRepeatedWheel.bodyActive || !afterRepeatedWheel.apiActive) {
    throw new Error(`canvas performance class did not activate after repeated wheel: ${JSON.stringify(afterRepeatedWheel)}`);
  }
  await page.waitForTimeout(900);
  const afterRepeatedWheelIdle = await page.evaluate(() => ({
    active: document.documentElement.classList.contains('canvas-performance-active'),
    bodyActive: document.body.classList.contains('canvas-performance-active'),
    apiActive: window.__hjmCanvasPerformanceMode?.isActive?.() === true
  }));
  if (afterRepeatedWheelIdle.active || afterRepeatedWheelIdle.bodyActive || afterRepeatedWheelIdle.apiActive) {
    throw new Error(`canvas performance class did not clear after repeated wheel idle: ${JSON.stringify(afterRepeatedWheelIdle)}`);
  }

  const chatPanelState = await page.evaluate(() => {
    const toggle = document.querySelector('.canvas-chat-toggle');
    if (toggle) toggle.click();
    return {
      clickedToggle: !!toggle
    };
  });
  await page.waitForTimeout(700);
  const chatPanelReady = await page.evaluate(() => {
    const text = document.body.innerText || '';
    return {
      hasChatPanel:
        !!document.querySelector('.canvas-chat-panel') ||
        !!document.querySelector('[class*="canvas-chat"]') ||
        text.includes('Canvas Chat') ||
        text.includes('对话') ||
        text.includes('快速'),
      textSample: text.slice(0, 300)
    };
  });
  if (chatPanelState.clickedToggle && !chatPanelReady.hasChatPanel) {
    throw new Error(`canvas chat panel did not open after toggle: ${JSON.stringify({ chatPanelState, chatPanelReady })}`);
  }
  await page.mouse.move(620, 420);
  await page.mouse.down();
  await page.mouse.move(570, 430, { steps: 6 });
  await page.mouse.move(530, 415, { steps: 6 });
  await page.mouse.up();
  const afterChatPanelDrag = await page.evaluate(() => ({
    active: document.documentElement.classList.contains('canvas-performance-active'),
    bodyActive: document.body.classList.contains('canvas-performance-active'),
    apiActive: window.__hjmCanvasPerformanceMode?.isActive?.() === true
  }));
  if (!afterChatPanelDrag.active || !afterChatPanelDrag.bodyActive || !afterChatPanelDrag.apiActive) {
    throw new Error(`canvas performance class did not activate after chat-panel drag: ${JSON.stringify({ chatPanelState, chatPanelReady, afterChatPanelDrag })}`);
  }
  await page.waitForTimeout(900);
  const afterChatPanelDragIdle = await page.evaluate(() => ({
    active: document.documentElement.classList.contains('canvas-performance-active'),
    bodyActive: document.body.classList.contains('canvas-performance-active'),
    apiActive: window.__hjmCanvasPerformanceMode?.isActive?.() === true
  }));
  if (afterChatPanelDragIdle.active || afterChatPanelDragIdle.bodyActive || afterChatPanelDragIdle.apiActive) {
    throw new Error(`canvas performance class did not clear after chat-panel drag idle: ${JSON.stringify(afterChatPanelDragIdle)}`);
  }

  const fatalConsoleErrors = consoleErrors.filter((text) => !text.includes('Local workflow auto save skipped'));
  if (fatalConsoleErrors.length > 0 || badResponses.length > 0) {
    throw new Error(`canvas performance smoke console or response errors: ${JSON.stringify({ fatalConsoleErrors, badResponses })}`);
  }

  return {
    ok: true,
    baseUrl,
    initialState,
    imageProbe,
    toolbarProbe,
    imageNodeVisualProbe,
    loadedImageNodeProbe,
    imageNodeRatioProbe,
    afterDrag,
    afterDragIdle,
    afterWheel,
    afterWheelIdle,
    afterRepeatedWheel,
    afterRepeatedWheelIdle,
    chatPanelState,
    chatPanelReady,
    afterChatPanelDrag,
    afterChatPanelDragIdle,
    consoleErrors: fatalConsoleErrors.slice(0, 8),
    badResponses: badResponses.slice(0, 8)
  };
}
