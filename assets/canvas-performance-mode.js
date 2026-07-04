(function () {
  var activeTimer = null;
  var activeUntil = 0;
  var ACTIVE_CLASS = 'canvas-performance-active';
  var ZOOM_CLASS = 'canvas-performance-zooming';
  var DRAG_CLASS = 'canvas-performance-dragging';
  var ACTIVE_MS = 380;
  var LONG_ACTIVE_MS = 700;
  var debugState = {
    saveDeferCount: 0,
    lastSaveDeferReason: '',
    lastSaveDeferAt: 0,
    mode: ''
  };

  function isCanvasTarget(target) {
    if (!target || !target.closest) return false;
    return !!target.closest('.canvas-flow, .vue-flow, .canvas-chat-panel, .image-quick-create-menu, [class*="vue-flow__node"]');
  }

  function setActive(duration, mode) {
    var now = Date.now();
    activeUntil = Math.max(activeUntil, now + (duration || ACTIVE_MS));
    debugState.mode = mode || 'active';
    document.documentElement.classList.add(ACTIVE_CLASS);
    if (document.body) document.body.classList.add(ACTIVE_CLASS);
    if (mode === 'zooming') {
      document.documentElement.classList.add(ZOOM_CLASS);
      if (document.body) document.body.classList.add(ZOOM_CLASS);
    }
    if (mode === 'dragging') {
      document.documentElement.classList.add(DRAG_CLASS);
      if (document.body) document.body.classList.add(DRAG_CLASS);
    }
    if (activeTimer) clearTimeout(activeTimer);
    activeTimer = setTimeout(clearIfIdle, duration || ACTIVE_MS);
  }

  function isActive() {
    return Date.now() < activeUntil || document.documentElement.classList.contains(ACTIVE_CLASS);
  }

  function noteSaveDeferred(reason) {
    debugState.saveDeferCount += 1;
    debugState.lastSaveDeferReason = reason || 'unknown';
    debugState.lastSaveDeferAt = Date.now();
  }

  function getDebugState() {
    return {
      active: isActive(),
      activeUntil: activeUntil,
      mode: debugState.mode,
      saveDeferCount: debugState.saveDeferCount,
      lastSaveDeferReason: debugState.lastSaveDeferReason,
      lastSaveDeferAt: debugState.lastSaveDeferAt
    };
  }

  function clearIfIdle() {
    var delay = activeUntil - Date.now();
    if (delay > 0) {
      activeTimer = setTimeout(clearIfIdle, delay);
      return;
    }
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.documentElement.classList.remove(ZOOM_CLASS);
    document.documentElement.classList.remove(DRAG_CLASS);
    if (document.body) document.body.classList.remove(ACTIVE_CLASS);
    if (document.body) document.body.classList.remove(ZOOM_CLASS);
    if (document.body) document.body.classList.remove(DRAG_CLASS);
    debugState.mode = '';
    activeTimer = null;
  }

  function isCanvasNodeImage(img) {
    return !!(img && img.closest && img.closest('.vue-flow__node'));
  }

  function optimizeImage(img) {
    if (!img || img.__hjmCanvasPerfImage) return;
    img.__hjmCanvasPerfImage = true;
    try {
      if (isCanvasNodeImage(img)) {
        if (img.loading !== 'eager') img.loading = 'eager';
      } else if (img.loading !== 'lazy') {
        img.loading = 'lazy';
      }
      img.decoding = 'async';
      if (!img.currentSrc && !img.getAttribute('src')) {
        img.referrerPolicy = img.referrerPolicy || 'no-referrer';
      }
    } catch (_) {}
  }

  function optimizeImages(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.tagName === 'IMG') optimizeImage(scope);
    scope.querySelectorAll && scope.querySelectorAll('.vue-flow__node img, .canvas-chat-panel img, .image-grid img, .canvas-chat-image-preview img').forEach(optimizeImage);
  }

  function install() {
    optimizeImages(document);

    document.addEventListener('wheel', function (event) {
      if (isCanvasTarget(event.target)) setActive(ACTIVE_MS, 'zooming');
    }, { capture: true, passive: true });

    document.addEventListener('pointerdown', function (event) {
      if (isCanvasTarget(event.target)) setActive(LONG_ACTIVE_MS, 'dragging');
    }, { capture: true, passive: true });

    document.addEventListener('pointermove', function (event) {
      if (event.buttons && isCanvasTarget(event.target)) setActive(ACTIVE_MS, 'dragging');
    }, { capture: true, passive: true });

    document.addEventListener('pointerup', function (event) {
      if (isCanvasTarget(event.target)) setActive(180, 'dragging');
    }, { capture: true, passive: true });

    document.addEventListener('touchmove', function (event) {
      if (event.target && isCanvasTarget(event.target)) setActive(ACTIVE_MS, 'dragging');
    }, { capture: true, passive: true });

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var nodes = mutations[i].addedNodes || [];
        for (var j = 0; j < nodes.length; j += 1) {
          var node = nodes[j];
          if (node && node.nodeType === 1) optimizeImages(node);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__hjmCanvasPerformanceMode = {
      setActive: setActive,
      isActive: isActive,
      noteSaveDeferred: noteSaveDeferred,
      getDebugState: getDebugState,
      optimizeImages: optimizeImages
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
