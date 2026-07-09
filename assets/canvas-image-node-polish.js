(function () {
  var SELECTOR = '.vue-flow__node-image .image-node img';
  var TITLE_RENAME_SELECTOR = '.vue-flow__node [title="双击编辑名称"], .vue-flow__node [data-hjm-node-title-lock="true"]';
  var PANEL_SELECTOR = '.image-edit-overlay';
  var PANEL_WINDOW_ATTR = 'data-hjm-panel-window';
  var PANEL_RESIZE_HANDLE_CLASS = 'hjm-overlay-resize-handle';
  var scanTimer = null;
  var pendingDragRoot = null;
  var installed = false;
  var teardownFns = [];

  function isCanvasPage() {
    return /^\/canvas(\/|$)/.test(window.location.pathname || '');
  }

  function maybeInstall() {
    if (installed || !isCanvasPage()) return;
    installed = true;
    install();
  }

  function teardownImageNodePolish() {
    if (!installed) return;
    installed = false;
    teardownFns.forEach(function (teardown) {
      try {
        teardown();
      } catch (_) {}
    });
    teardownFns = [];
    if (scanTimer) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }
    pendingDragRoot = null;
    document.documentElement.classList.remove('hjm-image-tool-window-dragging');
    document.documentElement.classList.remove('hjm-image-tool-window-resizing');
    delete window.__hjmCanvasImageNodePolish;
  }

  function syncCanvasRoute() {
    if (isCanvasPage()) {
      maybeInstall();
    } else {
      teardownImageNodePolish();
    }
  }

  function watchCanvasRoute() {
    function scheduleInstall() {
      setTimeout(syncCanvasRoute, 0);
    }
    ['pushState', 'replaceState'].forEach(function (name) {
      var original = history[name];
      if (!original || original.__hjmCanvasPolishWrapped) return;
      var wrapped = function () {
        var result = original.apply(this, arguments);
        scheduleInstall();
        return result;
      };
      wrapped.__hjmCanvasPolishWrapped = true;
      history[name] = wrapped;
    });
    window.addEventListener('popstate', scheduleInstall);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', syncCanvasRoute, { once: true });
    } else {
      syncCanvasRoute();
    }
  }

  function isElement(node) {
    return !!(node && node.nodeType === 1);
  }

  function matchesAny(node, selector) {
    return !!(isElement(node) && node.matches && node.matches(selector));
  }

  function containsAny(node, selector) {
    return !!(isElement(node) && node.querySelector && node.querySelector(selector));
  }

  function isRelevantPolishRoot(node) {
    if (!isElement(node)) return false;
    if (matchesAny(node, SELECTOR) || matchesAny(node, TITLE_RENAME_SELECTOR) || matchesAny(node, PANEL_SELECTOR)) return true;
    if (node.closest && node.closest('.vue-flow__node-image, ' + PANEL_SELECTOR)) return true;
    return containsAny(node, SELECTOR) || containsAny(node, TITLE_RENAME_SELECTOR) || containsAny(node, PANEL_SELECTOR);
  }

  function isCanvasDragging() {
    return document.documentElement.classList.contains('canvas-performance-dragging');
  }

  function classify(width, height) {
    if (!width || !height) return 'unknown';
    var ratio = width / height;
    var tallness = height / width;
    if (tallness >= 3.2) return 'long';
    if (ratio >= 1.25) return 'landscape';
    if (ratio <= 0.8) return 'portrait';
    return 'square';
  }

  function inferSource(node) {
    var text = (node && node.textContent ? node.textContent : '').replace(/\s+/g, ' ');
    if (/文生图|图像生成结果|对话生成图片|生成结果/.test(text)) return 'generated';
    if (/http|remote-url|原图可用/.test(text)) return 'remote';
    return 'uploaded';
  }

  function markImage(img) {
    if (!img) return;
    var card = img.closest('.image-node');
    var node = img.closest('.vue-flow__node-image');
    var wrapper = img.closest('.image-node-wrapper');
    if (!card || !node) return;

    if (card.classList.contains('image-node-loading')) {
      node.classList.remove('image-node-has-image');
      wrapper && wrapper.classList.remove('image-node-has-image');
      card.classList.remove('image-node-has-image');
      return;
    }

    var width = img.naturalWidth || Number(img.getAttribute('width')) || img.clientWidth || 0;
    var height = img.naturalHeight || Number(img.getAttribute('height')) || img.clientHeight || 0;
    var orientation = classify(width, height);
    var source = inferSource(node);

    [node, wrapper, card].forEach(function (target) {
      if (!target) return;
      target.setAttribute('data-image-orientation', orientation);
      target.setAttribute('data-image-source', source);
      if (width) target.setAttribute('data-image-natural-width', String(width));
      if (height) target.setAttribute('data-image-natural-height', String(height));
    });
    node.classList.add('image-node-has-image');
    wrapper && wrapper.classList.add('image-node-has-image');
    card.classList.add('image-node-has-image');
    node.classList.toggle('image-node-is-selected', card.classList.contains('image-node-selected') || node.classList.contains('selected'));
  }

  function lockNodeTitleRename(title) {
    if (!title || !title.setAttribute) return;
    var text = (title.textContent || '').replace(/\s+/g, ' ').trim();
    title.classList.add('hjm-node-title-static');
    title.setAttribute('data-hjm-node-title-lock', 'true');
    title.removeAttribute('title');
    if (text && !title.getAttribute('aria-label')) {
      title.setAttribute('aria-label', text);
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function stopPanelEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
  }

  function panelScale(panel) {
    var rect = panel.getBoundingClientRect();
    return {
      x: rect.width && panel.offsetWidth ? rect.width / panel.offsetWidth : 1,
      y: rect.height && panel.offsetHeight ? rect.height / panel.offsetHeight : 1
    };
  }

  function panelOffset(panel) {
    return {
      x: Number(panel.__hjmPanelX || 0) || 0,
      y: Number(panel.__hjmPanelY || 0) || 0
    };
  }

  function setPanelOffset(panel, x, y) {
    panel.__hjmPanelX = x;
    panel.__hjmPanelY = y;
    panel.style.setProperty('--hjm-panel-x', x + 'px');
    panel.style.setProperty('--hjm-panel-y', y + 'px');
  }

  function attachDocumentPointerTrack(move, done) {
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', done, true);
    document.addEventListener('pointercancel', done, true);
  }

  function detachDocumentPointerTrack(move, done) {
    document.removeEventListener('pointermove', move, true);
    document.removeEventListener('pointerup', done, true);
    document.removeEventListener('pointercancel', done, true);
  }

  function startPanelDrag(event, panel) {
    var start = panelOffset(panel);
    var rect = panel.getBoundingClientRect();
    var scale = panelScale(panel);
    var startX = event.clientX;
    var startY = event.clientY;
    var minX = start.x + (16 - rect.left) / scale.x;
    var maxX = start.x + (window.innerWidth - 80 - rect.left) / scale.x;
    var minY = start.y + (16 - rect.top) / scale.y;
    var maxY = start.y + (window.innerHeight - 80 - rect.top) / scale.y;
    if (maxX < minX) maxX = minX;
    if (maxY < minY) maxY = minY;

    function move(moveEvent) {
      stopPanelEvent(moveEvent);
      var nextX = start.x + (moveEvent.clientX - startX) / scale.x;
      var nextY = start.y + (moveEvent.clientY - startY) / scale.y;
      setPanelOffset(panel, clamp(nextX, minX, maxX), clamp(nextY, minY, maxY));
    }

    function done(doneEvent) {
      stopPanelEvent(doneEvent);
      detachDocumentPointerTrack(move, done);
      document.documentElement.classList.remove('hjm-image-tool-window-dragging');
    }

    document.documentElement.classList.add('hjm-image-tool-window-dragging');
    attachDocumentPointerTrack(move, done);
  }

  function startPanelResize(event, panel) {
    var scale = panelScale(panel);
    var startX = event.clientX;
    var startY = event.clientY;
    var startWidth = panel.offsetWidth || panel.getBoundingClientRect().width || 300;
    var startHeight = panel.offsetHeight || panel.getBoundingClientRect().height || 360;
    var maxWidth = Math.max(300, Math.min(760, (window.innerWidth - 32) / scale.x));
    var maxHeight = Math.max(240, Math.min(820, (window.innerHeight - 32) / scale.y));

    function move(moveEvent) {
      stopPanelEvent(moveEvent);
      var nextWidth = clamp(startWidth + (moveEvent.clientX - startX) / scale.x, 260, maxWidth);
      var nextHeight = clamp(startHeight + (moveEvent.clientY - startY) / scale.y, 220, maxHeight);
      panel.style.setProperty('width', Math.round(nextWidth) + 'px', 'important');
      panel.style.setProperty('height', Math.round(nextHeight) + 'px', 'important');
      panel.style.setProperty('max-height', 'none', 'important');
    }

    function done(doneEvent) {
      stopPanelEvent(doneEvent);
      detachDocumentPointerTrack(move, done);
      document.documentElement.classList.remove('hjm-image-tool-window-resizing');
    }

    document.documentElement.classList.add('hjm-image-tool-window-resizing');
    attachDocumentPointerTrack(move, done);
  }

  function enhanceImageToolPanel(panel) {
    if (!panel || !panel.setAttribute || panel.getAttribute(PANEL_WINDOW_ATTR) === 'true') return;
    panel.setAttribute(PANEL_WINDOW_ATTR, 'true');
    panel.classList.add('hjm-image-tool-window');
    panel.style.setProperty('--hjm-panel-x', '0px');
    panel.style.setProperty('--hjm-panel-y', '0px');
    if (!panel.querySelector('.' + PANEL_RESIZE_HANDLE_CLASS)) {
      var handle = document.createElement('span');
      handle.className = PANEL_RESIZE_HANDLE_CLASS;
      handle.setAttribute('aria-hidden', 'true');
      panel.appendChild(handle);
    }
  }

  function enhanceImageToolPanels(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(PANEL_SELECTOR)) enhanceImageToolPanel(scope);
    if (scope.querySelectorAll) scope.querySelectorAll(PANEL_SELECTOR).forEach(enhanceImageToolPanel);
  }

  function handlePanelPointerDown(event) {
    if (event.button !== 0) return;
    var target = event.target;
    if (!target || !target.closest) return;
    var resizeHandle = target.closest('.' + PANEL_RESIZE_HANDLE_CLASS);
    if (resizeHandle) {
      var resizePanel = resizeHandle.closest(PANEL_SELECTOR + '[' + PANEL_WINDOW_ATTR + '="true"]');
      if (!resizePanel) return;
      stopPanelEvent(event);
      startPanelResize(event, resizePanel);
      return;
    }
    var header = target.closest('.overlay-header');
    if (!header) return;
    if (target.closest('button, input, textarea, select, [contenteditable="true"], [role="button"]')) return;
    var panel = header.closest(PANEL_SELECTOR + '[' + PANEL_WINDOW_ATTR + '="true"]');
    if (!panel) return;
    stopPanelEvent(event);
    startPanelDrag(event, panel);
  }

  function markNodeTitles(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(TITLE_RENAME_SELECTOR)) lockNodeTitleRename(scope);
    if (scope.querySelectorAll) scope.querySelectorAll(TITLE_RENAME_SELECTOR).forEach(lockNodeTitleRename);
  }

  function markAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    markNodeTitles(scope);
    enhanceImageToolPanels(scope);
    if (scope.matches && scope.matches(SELECTOR)) markImage(scope);
    if (scope.querySelectorAll) scope.querySelectorAll(SELECTOR).forEach(markImage);
  }

  function scheduleMarkAll(root) {
    if (isCanvasDragging()) {
      pendingDragRoot = root || document;
      return;
    }
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      scanTimer = null;
      markAll(root || document);
    }, 80);
  }

  function flushPendingDragMark() {
    if (!pendingDragRoot) return;
    var root = pendingDragRoot;
    pendingDragRoot = null;
    scheduleMarkAll(root);
  }

  function install() {
    markAll(document);

    function addDocListener(type, handler, options) {
      document.addEventListener(type, handler, options);
      teardownFns.push(function () {
        document.removeEventListener(type, handler, options);
      });
    }

    addDocListener('load', function (event) {
      if (event.target && event.target.matches && event.target.matches(SELECTOR)) {
        markImage(event.target);
      }
    }, true);
    addDocListener('dblclick', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      if (target.closest('button, input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
      var header = target.closest('.relative.flex.h-12, .node-header');
      if (!header || !header.closest('.vue-flow__node')) return;
      if (!header.querySelector('[data-hjm-node-title-lock="true"], .hjm-node-title-static')) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }, true);
    addDocListener('pointerdown', handlePanelPointerDown, true);
    addDocListener('pointerup', function () {
      setTimeout(flushPendingDragMark, 120);
    }, true);
    addDocListener('pointercancel', function () {
      setTimeout(flushPendingDragMark, 120);
    }, true);

    var observer = new MutationObserver(function (mutations) {
      var dragging = isCanvasDragging();
      for (var i = 0; i < mutations.length; i += 1) {
        if (dragging && mutations[i].type === 'attributes') {
          var dragTarget = mutations[i].target;
          if (dragTarget && dragTarget.closest) {
            pendingDragRoot = dragTarget.closest('.vue-flow__node-image') || pendingDragRoot;
          }
          continue;
        }
        var nodes = mutations[i].addedNodes || [];
        for (var j = 0; j < nodes.length; j += 1) {
          if (isRelevantPolishRoot(nodes[j])) scheduleMarkAll(nodes[j]);
        }
        if (mutations[i].type === 'attributes' && mutations[i].target) {
          var target = mutations[i].target;
          if (!isRelevantPolishRoot(target)) continue;
          var scope = target.closest && target.closest('.vue-flow__node-image');
          scheduleMarkAll(scope || target);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'title'] });
    teardownFns.push(function () {
      observer.disconnect();
    });

    window.__hjmCanvasImageNodePolish = {
      classify: classify,
      markAll: markAll,
      markImage: markImage,
      markNodeTitles: markNodeTitles,
      enhanceImageToolPanels: enhanceImageToolPanels
    };
  }

  watchCanvasRoute();
})();
