(function () {
  'use strict';

  var NODE_SELECTOR = '.vue-flow .image-prompt-generate-node';
  var FIELD_SELECTOR = '.prompt-input';
  var REFERENCE_SELECTOR = '.reference-thumb img';
  var BUTTON_CLASS = 'hjm-prompt-enhance-button';
  var HOST_CLASS = 'hjm-prompt-enhance-host';
  var MAX_REFERENCE_IMAGES = 4;
  var installed = false;
  var observer = null;
  var scanTimer = null;
  var controllers = new Set();

  if (window.__hjmCanvasPromptEnhancerLoaderInstalled) return;
  window.__hjmCanvasPromptEnhancerLoaderInstalled = true;

  function isCanvasPage() {
    return /^\/canvas(?:\/|$)/.test(window.location.pathname || '');
  }

  function notify(type, message) {
    var messenger = window.$message;
    if (messenger && typeof messenger[type] === 'function') {
      messenger[type](message);
      return;
    }
    if (type === 'error') console.error('[canvas-prompt-enhancer]', message);
    else console.info('[canvas-prompt-enhancer]', message);
  }

  function authHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    try {
      var token = localStorage.getItem('auth_token');
      if (token) headers.Authorization = 'Bearer ' + token;
    } catch (_) {}
    return headers;
  }

  function readBlobAsDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(reader.error || new Error('参考图读取失败')); };
      reader.readAsDataURL(blob);
    });
  }

  async function referencePayload(img, index) {
    var src = String(img.currentSrc || img.getAttribute('src') || img.src || '').trim();
    if (!src) throw new Error('参考图 ' + (index + 1) + ' 地址为空');
    var fileName = 'reference-' + (index + 1) + '.png';
    if (/^data:image\//i.test(src)) return { dataUrl: src, fileName: fileName };
    if (/^blob:/i.test(src)) {
      var response = await fetch(src);
      if (!response.ok) throw new Error('参考图 ' + (index + 1) + ' 读取失败');
      var blob = await response.blob();
      if (!/^image\/(?:png|jpeg|webp)$/i.test(blob.type || '')) {
        throw new Error('参考图 ' + (index + 1) + ' 仅支持 PNG、JPEG 或 WebP');
      }
      return {
        dataUrl: await readBlobAsDataUrl(blob),
        fileName: fileName,
        mimeType: blob.type
      };
    }
    try {
      var url = new URL(src, window.location.href);
      if (url.origin === window.location.origin) {
        return { url: url.pathname + url.search, fileName: fileName };
      }
    } catch (_) {}
    return { url: src, fileName: fileName };
  }

  async function collectReferences(node) {
    var images = Array.from(node.querySelectorAll(REFERENCE_SELECTOR));
    if (images.length > MAX_REFERENCE_IMAGES) {
      throw new Error('AI 扩写一次最多读取 ' + MAX_REFERENCE_IMAGES + ' 张参考图');
    }
    return Promise.all(images.map(referencePayload));
  }

  function replaceFieldValue(field, value) {
    var descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (descriptor && descriptor.set) descriptor.set.call(field, value);
    else field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    field.focus({ preventScroll: true });
    field.setSelectionRange(value.length, value.length);
  }

  function setButtonLoading(button, loading) {
    button.disabled = loading;
    button.classList.toggle('is-loading', loading);
    button.setAttribute('aria-busy', loading ? 'true' : 'false');
    button.textContent = loading ? '正在扩写…' : '✦ AI 扩写';
  }

  async function runEnhancement(button, node, field) {
    var originalPrompt = String(field.value || '').trim();
    var referenceImages;
    try {
      referenceImages = await collectReferences(node);
    } catch (error) {
      notify('error', error.message || '参考图读取失败');
      return;
    }
    if (!originalPrompt && referenceImages.length === 0) {
      notify('warning', '请先输入提示词或连接参考图');
      return;
    }

    var controller = new AbortController();
    controllers.add(controller);
    setButtonLoading(button, true);
    button.title = 'GPT‑5.6 正在读取提示词和参考图';
    try {
      var response = await fetch('/api/canvas/enhance-prompt', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          currentPrompt: originalPrompt,
          referenceImages: referenceImages,
          source: 'canvas-image-prompt-node'
        }),
        signal: controller.signal
      });
      var data = await response.json().catch(function () { return {}; });
      if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || ('扩写请求失败: ' + response.status));
      }
      var enhancedPrompt = String(data.prompt || data.text || '').trim();
      if (!enhancedPrompt) throw new Error('GPT‑5.6 没有返回可用提示词');
      if (!field.isConnected || !node.isConnected) return;
      if (String(field.value || '').trim() !== originalPrompt) {
        notify('warning', '扩写期间提示词已被修改，为避免覆盖，本次结果未回填');
        return;
      }
      replaceFieldValue(field, enhancedPrompt);
      notify('success', data.mock ? '本地模式已生成扩写草稿' : 'AI 扩写完成，可继续编辑后再生图');
    } catch (error) {
      if (error && error.name === 'AbortError') return;
      notify('error', (error && error.message) || 'AI 扩写失败，原提示词未修改');
    } finally {
      controllers.delete(controller);
      if (button.isConnected) {
        setButtonLoading(button, false);
        button.title = '免费使用 GPT‑5.6 读取当前提示词和参考图并扩写；不会自动生图';
      }
    }
  }

  function enhanceNode(node) {
    if (!node || !node.querySelector) return;
    var field = node.querySelector(FIELD_SELECTOR);
    if (!field) return;
    var host = field.closest('.prompt-shell') || field.parentElement;
    if (!host || host.querySelector('.' + BUTTON_CLASS)) return;
    host.classList.add(HOST_CLASS);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = BUTTON_CLASS + ' nodrag nopan nowheel';
    button.textContent = '✦ AI 扩写';
    button.title = '免费使用 GPT‑5.6 读取当前提示词和参考图并扩写；不会自动生图';
    button.setAttribute('aria-label', '使用 GPT‑5.6 扩写提示词');
    button.setAttribute('aria-busy', 'false');
    button.addEventListener('pointerdown', function (event) {
      event.stopPropagation();
    });
    button.addEventListener('mousedown', function (event) {
      event.stopPropagation();
    });
    button.addEventListener('wheel', function (event) {
      event.stopPropagation();
    });
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (!button.disabled) runEnhancement(button, node, field);
    });
    host.appendChild(button);
  }

  function scan(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(NODE_SELECTOR)) enhanceNode(scope);
    if (scope.querySelectorAll) scope.querySelectorAll(NODE_SELECTOR).forEach(enhanceNode);
  }

  function scheduleScan(root) {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      scanTimer = null;
      scan(root || document);
    }, 60);
  }

  function isRelevantNode(node) {
    if (!node || node.nodeType !== 1 || !node.matches) return false;
    if (node.matches(NODE_SELECTOR) || node.matches(FIELD_SELECTOR)) return true;
    if (node.closest && node.closest(NODE_SELECTOR)) return true;
    return !!(node.querySelector && node.querySelector(NODE_SELECTOR));
  }

  function install() {
    if (installed || !isCanvasPage()) return;
    installed = true;
    scan(document);
    observer = new MutationObserver(function (mutations) {
      for (var index = 0; index < mutations.length; index += 1) {
        var addedNodes = mutations[index].addedNodes || [];
        for (var nodeIndex = 0; nodeIndex < addedNodes.length; nodeIndex += 1) {
          if (isRelevantNode(addedNodes[nodeIndex])) scheduleScan(addedNodes[nodeIndex]);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__hjmCanvasPromptEnhancer = {
      scan: scan,
      collectReferences: collectReferences,
      replaceFieldValue: replaceFieldValue
    };
  }

  function teardown() {
    if (!installed) return;
    installed = false;
    if (observer) observer.disconnect();
    observer = null;
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = null;
    controllers.forEach(function (controller) { controller.abort(); });
    controllers.clear();
    document.querySelectorAll('.' + BUTTON_CLASS).forEach(function (button) { button.remove(); });
    document.querySelectorAll('.' + HOST_CLASS).forEach(function (host) { host.classList.remove(HOST_CLASS); });
    delete window.__hjmCanvasPromptEnhancer;
  }

  function syncRoute() {
    if (isCanvasPage()) install();
    else teardown();
  }

  function scheduleRouteSync() {
    setTimeout(syncRoute, 0);
  }

  ['pushState', 'replaceState'].forEach(function (name) {
    var original = history[name];
    if (!original || original.__hjmCanvasPromptEnhancerWrapped) return;
    var wrapped = function () {
      var result = original.apply(this, arguments);
      scheduleRouteSync();
      return result;
    };
    wrapped.__hjmCanvasPromptEnhancerWrapped = true;
    history[name] = wrapped;
  });
  window.addEventListener('popstate', scheduleRouteSync);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncRoute, { once: true });
  } else {
    syncRoute();
  }
})();
