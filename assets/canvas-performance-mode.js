(function () {
  var activeTimer = null;
  var activeUntil = 0;
  var ACTIVE_CLASS = 'canvas-performance-active';
  var ZOOM_CLASS = 'canvas-performance-zooming';
  var DRAG_CLASS = 'canvas-performance-dragging';
  var ACTIVE_MS = 380;
  var LONG_ACTIVE_MS = 700;
  var draggingPointerActive = false;
  var lastPointerMoveExtendAt = 0;
  var installed = false;
  var teardownFns = [];
  var debugState = {
    saveDeferCount: 0,
    lastSaveDeferReason: '',
    lastSaveDeferAt: 0,
    mode: ''
  };

  function isCanvasPage() {
    return /^\/canvas(\/|$)/.test(window.location.pathname || '');
  }

  function maybeInstall() {
    if (installed || !isCanvasPage()) return;
    installed = true;
    install();
  }

  function teardownPerformanceMode() {
    if (!installed) return;
    installed = false;
    teardownFns.forEach(function (teardown) {
      try {
        teardown();
      } catch (_) {}
    });
    teardownFns = [];
    draggingPointerActive = false;
    lastPointerMoveExtendAt = 0;
    activeUntil = 0;
    if (activeTimer) {
      clearTimeout(activeTimer);
      activeTimer = null;
    }
    document.documentElement.classList.remove(ACTIVE_CLASS);
    document.documentElement.classList.remove(ZOOM_CLASS);
    document.documentElement.classList.remove(DRAG_CLASS);
    if (document.body) document.body.classList.remove(ACTIVE_CLASS);
    if (document.body) document.body.classList.remove(ZOOM_CLASS);
    if (document.body) document.body.classList.remove(DRAG_CLASS);
    debugState.mode = '';
    delete window.__hjmCanvasPerformanceMode;
  }

  function syncCanvasRoute() {
    if (isCanvasPage()) {
      maybeInstall();
    } else {
      teardownPerformanceMode();
    }
  }

  function watchCanvasRoute() {
    function scheduleInstall() {
      setTimeout(syncCanvasRoute, 0);
    }
    ['pushState', 'replaceState'].forEach(function (name) {
      var original = history[name];
      if (!original || original.__hjmCanvasPerformanceWrapped) return;
      var wrapped = function () {
        var result = original.apply(this, arguments);
        scheduleInstall();
        return result;
      };
      wrapped.__hjmCanvasPerformanceWrapped = true;
      history[name] = wrapped;
    });
    window.addEventListener('popstate', scheduleInstall);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncCanvasRoute, { once: true });
    } else {
      syncCanvasRoute();
    }
  }

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

  function hasModeClass(mode) {
    if (mode === 'zooming') return document.documentElement.classList.contains(ZOOM_CLASS);
    if (mode === 'dragging') return document.documentElement.classList.contains(DRAG_CLASS);
    return true;
  }

  function extendActive(duration, mode) {
    var now = Date.now();
    activeUntil = Math.max(activeUntil, now + (duration || ACTIVE_MS));
    debugState.mode = mode || debugState.mode || 'active';
    if (!document.documentElement.classList.contains(ACTIVE_CLASS) || !hasModeClass(mode)) {
      setActive(duration, mode);
      return;
    }
    if (!activeTimer) {
      activeTimer = setTimeout(clearIfIdle, duration || ACTIVE_MS);
    }
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

    function addDocListener(type, handler, options) {
      document.addEventListener(type, handler, options);
      teardownFns.push(function () {
        document.removeEventListener(type, handler, options);
      });
    }

    addDocListener('wheel', function (event) {
      if (isCanvasTarget(event.target)) setActive(ACTIVE_MS, 'zooming');
    }, { capture: true, passive: true });

    addDocListener('pointerdown', function (event) {
      if (isCanvasTarget(event.target)) {
        draggingPointerActive = true;
        lastPointerMoveExtendAt = 0;
        setActive(LONG_ACTIVE_MS, 'dragging');
      }
    }, { capture: true, passive: true });

    addDocListener('pointermove', function (event) {
      if (!event.buttons || !draggingPointerActive) return;
      var now = Date.now();
      if (now - lastPointerMoveExtendAt < 80) return;
      lastPointerMoveExtendAt = now;
      extendActive(ACTIVE_MS, 'dragging');
    }, { capture: true, passive: true });

    addDocListener('pointerup', function (event) {
      if (draggingPointerActive || isCanvasTarget(event.target)) setActive(180, 'dragging');
      draggingPointerActive = false;
    }, { capture: true, passive: true });

    addDocListener('pointercancel', function () {
      draggingPointerActive = false;
      setActive(120, 'dragging');
    }, { capture: true, passive: true });

    addDocListener('touchmove', function (event) {
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
    teardownFns.push(function () {
      observer.disconnect();
    });
    window.__hjmCanvasPerformanceMode = {
      setActive: setActive,
      isActive: isActive,
      noteSaveDeferred: noteSaveDeferred,
      getDebugState: getDebugState,
      optimizeImages: optimizeImages
    };
  }

  watchCanvasRoute();
})();
