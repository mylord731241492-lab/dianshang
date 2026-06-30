async page => {
  const baseUrlMatch = String(page.url()).match(/^(https?:\/\/[^/]+)/);
  const baseUrl = baseUrlMatch ? baseUrlMatch[1] : 'http://127.0.0.1:3456';
  const initialPageUrl = String(page.url());
  const isCanvasUrl = initialPageUrl.indexOf(`${baseUrl}/canvas`) === 0;
  const targetUrl = isCanvasUrl
    ? (
        initialPageUrl.includes('canvas-frame-budget-smoke=')
          ? initialPageUrl.replace(/([?&])canvas-frame-budget-smoke=[^&]*/i, '$1canvas-frame-budget-smoke=1')
          : `${initialPageUrl}${initialPageUrl.includes('?') ? '&' : '?'}canvas-frame-budget-smoke=1`
      )
    : `${baseUrl}/canvas?canvas-frame-budget-smoke=1`;
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

  const probeState = await page.evaluate(() => {
    const viewport = document.querySelector('.vue-flow__viewport');
    if (!viewport) return { installed: false, reason: 'missing viewport' };
    if (document.querySelectorAll('.vue-flow__node').length >= 2) {
      return { installed: false, reason: 'existing nodes present', nodeCount: document.querySelectorAll('.vue-flow__node').length };
    }
    const probeWrap = document.createElement('div');
    probeWrap.id = 'codex-canvas-frame-budget-probes';
    probeWrap.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    for (let i = 0; i < 8; i += 1) {
      const node = document.createElement('div');
      node.className = 'vue-flow__node codex-canvas-frame-budget-probe';
      node.style.cssText = [
        'position:absolute',
        `left:${120 + (i % 4) * 230}px`,
        `top:${100 + Math.floor(i / 4) * 220}px`,
        'width:190px',
        'height:150px',
        'border-radius:18px',
        'background:#f8fafc',
        'border:1px solid rgba(15,23,42,.14)',
        'box-shadow:0 14px 30px rgba(15,23,42,.16)',
        'overflow:hidden'
      ].join(';');
      const img = document.createElement('img');
      img.alt = 'frame budget probe';
      img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMAAAACACAYAAAD8M/1hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAmElEQVR4nO3RAQ0AAAjDMO5fNCCDkC5z0KmtAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwL4BXmQAAT+oK8wAAAAASUVORK5CYII=';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.style.cssText = 'display:block;width:100%;height:96px;object-fit:cover;background:linear-gradient(135deg,#f8fafc,#bfdbfe);';
      const label = document.createElement('div');
      label.textContent = `性能探针 ${i + 1}`;
      label.style.cssText = 'padding:12px 14px;color:#172033;font:600 15px/1.2 system-ui;';
      node.appendChild(img);
      node.appendChild(label);
      probeWrap.appendChild(node);
    }
    viewport.appendChild(probeWrap);
    window.__hjmCanvasPerformanceMode?.optimizeImages?.(probeWrap);
    return {
      installed: true,
      nodeCount: document.querySelectorAll('.vue-flow__node').length,
      imageCount: probeWrap.querySelectorAll('img[loading="lazy"]').length
    };
  });

  const initialState = await page.evaluate(() => {
    const scripts = Array.from(document.scripts).map((script) => script.src).filter(Boolean);
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.href).filter(Boolean);
    return {
      hasVueFlow: !!document.querySelector('.vue-flow'),
      hasViewport: !!document.querySelector('.vue-flow__viewport'),
      perfScriptLoaded: scripts.some((src) => src.includes('/assets/canvas-performance-mode.js?v=20260629perf5')),
      perfCssLoaded: styles.some((src) => src.includes('/assets/canvas-performance-mode.css?v=20260629perf5')),
      hasPerfApi: !!window.__hjmCanvasPerformanceMode,
      nodeCount: document.querySelectorAll('.vue-flow__node').length,
      probeNodeCount: document.querySelectorAll('.codex-canvas-frame-budget-probe').length
    };
  });

  if (!initialState.hasVueFlow || !initialState.hasViewport || !initialState.perfScriptLoaded || !initialState.perfCssLoaded || !initialState.hasPerfApi) {
    throw new Error(`canvas frame budget prerequisites missing: ${JSON.stringify(initialState)}`);
  }

  async function collectFrameStats(label, durationMs, action) {
    const statsPromise = page.evaluate(({ sampleLabel, sampleDurationMs }) => new Promise((resolve) => {
      const deltas = [];
      let start = 0;
      let last = 0;

      function finish() {
        const sorted = deltas.slice().sort((a, b) => a - b);
        const sum = deltas.reduce((total, value) => total + value, 0);
        const percentile = (ratio) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] : 0;
        resolve({
          label: sampleLabel,
          frames: deltas.length,
          avgDelta: deltas.length ? Number((sum / deltas.length).toFixed(2)) : 0,
          p95Delta: Number(percentile(0.95).toFixed(2)),
          maxDelta: Number((sorted[sorted.length - 1] || 0).toFixed(2)),
          longFramesOver50: deltas.filter((value) => value > 50).length,
          longFramesOver100: deltas.filter((value) => value > 100).length,
          longFramesOver200: deltas.filter((value) => value > 200).length
        });
      }

      function tick(timestamp) {
        if (!start) {
          start = timestamp;
          last = timestamp;
        } else {
          deltas.push(timestamp - last);
          last = timestamp;
        }
        if (timestamp - start < sampleDurationMs) {
          requestAnimationFrame(tick);
        } else {
          finish();
        }
      }

      requestAnimationFrame(tick);
    }), { sampleLabel: label, sampleDurationMs: durationMs });

    await page.waitForTimeout(120);
    await action();
    return statsPromise;
  }

  function assertFrameBudget(stats) {
    if (stats.frames < 45) {
      throw new Error(`canvas frame budget sample too short: ${JSON.stringify(stats)}`);
    }
    if (stats.p95Delta > 140 || stats.maxDelta > 600 || stats.longFramesOver100 > 8 || stats.longFramesOver200 > 2) {
      throw new Error(`canvas frame budget exceeded: ${JSON.stringify(stats)}`);
    }
  }

  const dragStats = await collectFrameStats('drag', 2400, async () => {
    await page.mouse.move(760, 430);
    await page.mouse.down();
    for (let i = 0; i < 18; i += 1) {
      await page.mouse.move(760 - (i * 12), 430 + ((i % 2) * 18), { steps: 3 });
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
  });
  assertFrameBudget(dragStats);

  await page.waitForTimeout(650);

  const zoomStats = await collectFrameStats('zoom', 2600, async () => {
    await page.mouse.move(720, 420);
    for (let i = 0; i < 24; i += 1) {
      await page.mouse.wheel(0, i % 2 === 0 ? -220 : 180);
      await page.waitForTimeout(35);
    }
  });
  assertFrameBudget(zoomStats);

  const finalState = await page.evaluate(() => ({
    active: document.documentElement.classList.contains('canvas-performance-active'),
    zooming: document.documentElement.classList.contains('canvas-performance-zooming'),
    dragging: document.documentElement.classList.contains('canvas-performance-dragging'),
    debug: window.__hjmCanvasPerformanceMode?.getDebugState?.()
  }));

  await page.waitForTimeout(950);
  const idleState = await page.evaluate(() => ({
    active: document.documentElement.classList.contains('canvas-performance-active'),
    zooming: document.documentElement.classList.contains('canvas-performance-zooming'),
    dragging: document.documentElement.classList.contains('canvas-performance-dragging')
  }));

  if (idleState.active || idleState.zooming || idleState.dragging) {
    throw new Error(`canvas performance classes did not clear after frame budget smoke: ${JSON.stringify({ finalState, idleState })}`);
  }

  const fatalConsoleErrors = consoleErrors.filter((text) => !text.includes('Local workflow auto save skipped'));
  if (fatalConsoleErrors.length > 0 || badResponses.length > 0) {
    throw new Error(`canvas frame budget smoke console or response errors: ${JSON.stringify({ fatalConsoleErrors, badResponses })}`);
  }

  return {
    ok: true,
    baseUrl,
    targetUrl,
    probeState,
    initialState,
    dragStats,
    zoomStats,
    finalState,
    idleState,
    consoleErrors: fatalConsoleErrors.slice(0, 8),
    badResponses: badResponses.slice(0, 8)
  };
}
