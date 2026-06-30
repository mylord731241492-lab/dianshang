(function () {
  var FLOW_VERSION = '20260630dialogcard4';
  var state = {
    busy: false,
    runs: {},
    lastError: ''
  };
  var CANVAS_CHAT_SCOPE_ATTR = 'data-v-b10121f4';

  function isCanvasPage() {
    return /^\/canvas(\/|$)/.test(window.location.pathname || '');
  }

  function getPanel() {
    return document.querySelector('.canvas-chat-panel');
  }

  function getMessageList(panel) {
    return panel && panel.querySelector('.message-list');
  }

  function getCanvasChatScopeAttr(panel) {
    var attrs = panel && panel.attributes ? Array.from(panel.attributes) : [];
    var scope = attrs.find(function (attr) { return /^data-v-/.test(attr.name); });
    return scope ? scope.name : CANVAS_CHAT_SCOPE_ATTR;
  }

  function applyCanvasChatScope(root, panel) {
    if (!root || root.nodeType !== 1) return root;
    var scopeAttr = getCanvasChatScopeAttr(panel || getPanel());
    root.setAttribute(scopeAttr, '');
    if (root.querySelectorAll) {
      Array.from(root.querySelectorAll('*')).forEach(function (node) {
        node.setAttribute(scopeAttr, '');
      });
    }
    return root;
  }

  function getInput(panel) {
    return panel && panel.querySelector('.composer-input');
  }

  function getActiveMode(panel) {
    var active = panel && panel.querySelector('.canvas-chat-tab.active');
    return (active && active.textContent ? active.textContent : '').replace(/\s+/g, '').trim();
  }

  function shouldHandle(panel) {
    return !!panel && getActiveMode(panel) === '对话';
  }

  function syncPromptFlowCardVisibility(panel) {
    if (!panel) return;
    var dialogActive = shouldHandle(panel);
    var visibleBridgeCount = 0;
    panel.classList.toggle('hjm-prompt-flow-dialog-active', dialogActive);
    Array.from(panel.querySelectorAll('.hjm-prompt-flow-card, .hjm-prompt-flow-user, .hjm-prompt-flow-agent')).forEach(function (card) {
      var mode = card.getAttribute('data-hjm-prompt-flow-mode') || 'chat';
      var visible = dialogActive && mode === 'chat';
      card.hidden = !visible;
      card.style.display = visible ? '' : 'none';
      if (visible) visibleBridgeCount += 1;
    });
    var emptyState = panel.querySelector('.message-list > .empty-state');
    if (emptyState) {
      var hideEmpty = dialogActive && visibleBridgeCount > 0;
      emptyState.hidden = hideEmpty;
      emptyState.style.display = hideEmpty ? 'none' : '';
    }
  }

  function getAuthHeaders() {
    var headers = { 'Content-Type': 'application/json' };
    try {
      var token = localStorage.getItem('auth_token');
      if (token) headers.Authorization = 'Bearer ' + token;
    } catch (_) {}
    return headers;
  }

  function nowText() {
    return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  function uuid(prefix) {
    return (prefix || 'flow') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function clampNumber(value, min, max, fallback) {
    var num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  function cleanupInjectedSettings(panel) {
    if (!panel) return;
    Array.from(panel.querySelectorAll('.hjm-dialog-agent-settings')).forEach(function (node) {
      node.remove();
    });
    Array.from(panel.querySelectorAll('.hjm-native-param-settings')).forEach(function (host) {
      Array.from(host.children).forEach(function (child) {
        host.parentNode.insertBefore(child, host);
      });
      host.remove();
    });
  }

  function controlValue(panel, title, fallback) {
    var row = panel && panel.querySelector('.config-row');
    var button = row && row.querySelector('.compact-control[title="' + title + '"]');
    var text = (button && button.textContent ? button.textContent : '').replace(/\s+/g, ' ').trim();
    return text || fallback;
  }

  function readDialogSettings(panel) {
    cleanupInjectedSettings(panel);
    var countText = controlValue(panel, '张数', '1张');
    var qualityText = controlValue(panel, '清晰度', '1K');
    var ratioText = controlValue(panel, '比例', '1:1');
    var countMatch = countText.match(/\d+/);
    var qualityMatch = qualityText.match(/[124]\s*K/i);
    var ratioMatch = ratioText.match(/\d+\s*:\s*\d+/);
    var imageCount = clampNumber(countMatch && countMatch[0], 1, 4, 1);
    var quality = String((qualityMatch && qualityMatch[0]) || '1K').replace(/\s+/g, '').toLowerCase();
    var ratio = String((ratioMatch && ratioMatch[0]) || '1:1').replace(/\s+/g, '');
    return {
      imageCount: imageCount,
      count: imageCount,
      n: imageCount,
      quality: quality,
      clarity: quality,
      ratio: ratio,
      aspectRatio: ratio
    };
  }

  function readAsDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(reader.error || new Error('图片读取失败')); };
      reader.readAsDataURL(blob);
    });
  }

  async function sourceToReference(src, index) {
    var value = String(src || '').trim();
    var result = {
      index: index + 1,
      fileName: 'reference-' + (index + 1) + '.png',
      preview: value,
      url: value,
      dataUrl: ''
    };
    if (!value || /^data:image\//i.test(value) || /^https?:\/\//i.test(value) || value.charAt(0) === '/') {
      if (/^data:image\//i.test(value)) result.dataUrl = value;
      return result;
    }
    if (/^blob:/i.test(value)) {
      var response = await fetch(value);
      var blob = await response.blob();
      result.dataUrl = await readAsDataUrl(blob);
      result.mimeType = blob.type || 'image/png';
      return result;
    }
    return result;
  }

  function visibleImagesFrom(scope) {
    if (!scope) return [];
    return Array.from(scope.querySelectorAll('img'))
      .map(function (img) {
        var rect = img.getBoundingClientRect();
        return {
          img: img,
          src: img.currentSrc || img.src || '',
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height
        };
      })
      .filter(function (item) {
        return item.src && item.width >= 24 && item.height >= 24;
      })
      .sort(function (a, b) {
        if (Math.abs(a.top - b.top) > 8) return a.top - b.top;
        return a.left - b.left;
      });
  }

  function findReferenceImageElements(panel) {
    var composerImages = visibleImagesFrom(panel && panel.querySelector('.composer'));
    if (composerImages.length) return composerImages;
    var userCards = Array.from(panel.querySelectorAll('.message-card.user')).reverse();
    for (var i = 0; i < userCards.length; i += 1) {
      var images = visibleImagesFrom(userCards[i]);
      if (images.length) return images;
    }
    return [];
  }

  async function collectReferences(panel) {
    var imageItems = findReferenceImageElements(panel).slice(0, 8);
    var references = [];
    for (var i = 0; i < imageItems.length; i += 1) {
      references.push(await sourceToReference(imageItems[i].src, i));
    }
    return references;
  }

  function makeUserCard(panel, requirement, references) {
    var images = references.map(function (ref) {
      return '<figure><img src="' + escapeHtml(ref.preview || ref.dataUrl || ref.url) + '" alt=""></figure>';
    }).join('');
    var card = document.createElement('article');
    card.className = 'message-card user hjm-prompt-flow-card hjm-prompt-flow-user';
    card.dataset.hjmPromptFlowMode = 'chat';
    card.innerHTML = [
      '<div class="message-meta hjm-prompt-flow-head"><span>你</span><time>' + nowText() + '</time></div>',
      '<p class="message-text">' + escapeHtml(requirement) + '</p>',
      references.length ? '<div class="image-grid hjm-prompt-flow-images">' + images + '</div>' : ''
    ].join('');
    return applyCanvasChatScope(card, panel);
  }

  function makeAgentCard(panel, flowId, requirement, references, settings) {
    var card = document.createElement('article');
    card.className = 'message-card assistant hjm-prompt-flow-card hjm-prompt-flow-agent is-loading';
    card.dataset.flowId = flowId;
    card.dataset.hjmPromptFlowMode = 'chat';
    card.innerHTML = [
      '<div class="message-meta hjm-prompt-flow-head"><span>生成结果</span><time>' + nowText() + '</time></div>',
      '<p class="message-text hjm-prompt-flow-note">椒图AI 正在分析参考图和需求，并自动生成图片。</p>',
      '<div class="message-text hjm-prompt-flow-summary" hidden></div>',
      '<div class="image-grid hjm-prompt-flow-result-grid"></div>',
      '<div class="message-text hjm-prompt-flow-status">正在分析图片和需求...</div>',
      '<div class="hjm-prompt-flow-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="12">',
      '<span class="hjm-prompt-flow-progress-bar" style="width:12%"></span>',
      '</div>',
      '<div class="cost-line hjm-prompt-flow-cost" hidden></div>',
      '<div class="hjm-prompt-flow-actions">',
      '<button type="button" data-hjm-prompt-flow-action="copy-prompt" disabled>复制提示词</button>',
      '<button type="button" data-hjm-prompt-flow-action="regen" disabled>重新生成</button>',
      '<button type="button" data-hjm-prompt-flow-action="cancel">取消</button>',
      '</div>'
    ].join('');
    state.runs[flowId] = { flowId: flowId, requirement: requirement, references: references, settings: settings, card: card, images: [], finalPrompt: '' };
    return applyCanvasChatScope(card, panel);
  }

  function normalizeImages(data) {
    var list = Array.isArray(data && data.resultImages) ? data.resultImages
      : Array.isArray(data && data.images) ? data.images
        : Array.isArray(data && data.results) ? data.results
          : [];
    return list.map(function (item, index) {
      var raw = item && typeof item === 'object' ? item : { url: item };
      var url = raw.url || raw.imageUrl || raw.image_url || raw.preview || '';
      if (!url) return null;
      return Object.assign({}, raw, {
        id: raw.id || (data.taskId || data.id || 'dialog_agent') + '_' + index,
        url: url,
        imageUrl: raw.imageUrl || url,
        preview: raw.preview || url
      });
    }).filter(Boolean);
  }

  function resultFigure(image, index) {
    return [
      '<figure data-image-index="' + index + '">',
      '<img src="' + escapeHtml(image.preview || image.url) + '" alt="">',
      '<figcaption>',
      '<button type="button" data-hjm-prompt-flow-action="download" data-image-index="' + index + '">下载</button>',
      '<button type="button" data-hjm-prompt-flow-action="copy-link" data-image-index="' + index + '">复制链接</button>',
      '<button type="button" data-hjm-prompt-flow-action="add-canvas" data-image-index="' + index + '">添加到画布</button>',
      '<button type="button" data-hjm-prompt-flow-action="again" data-image-index="' + index + '">再次编辑</button>',
      '</figcaption>',
      '</figure>'
    ].join('');
  }

  function updateAgent(flowId, patch) {
    var run = state.runs[flowId];
    if (!run || !run.card) return;
    Object.assign(run, patch || {});
    var card = run.card;
    var summary = card.querySelector('.hjm-prompt-flow-summary');
    var grid = card.querySelector('.hjm-prompt-flow-result-grid');
    var status = card.querySelector('.hjm-prompt-flow-status');
    var progress = card.querySelector('.hjm-prompt-flow-progress');
    var progressBar = card.querySelector('.hjm-prompt-flow-progress-bar');
    var cost = card.querySelector('.hjm-prompt-flow-cost');
    var buttons = card.querySelectorAll('[data-hjm-prompt-flow-action]');
    if (summary && patch && patch.analysisSummary !== undefined) {
      summary.textContent = patch.analysisSummary || '';
      summary.hidden = !patch.analysisSummary;
    }
    if (grid && patch && patch.images) {
      grid.innerHTML = run.images.map(resultFigure).join('');
      applyCanvasChatScope(grid, getPanel());
    }
    if (status && patch && patch.status) status.textContent = patch.status;
    if (progress && patch && patch.loading !== undefined) {
      progress.hidden = !patch.loading;
      progress.style.display = patch.loading ? '' : 'none';
    }
    if (progress && progressBar && patch && patch.progress !== undefined) {
      var nextProgress = clampNumber(patch.progress, 0, 100, 12);
      progress.setAttribute('aria-valuenow', String(nextProgress));
      progressBar.style.width = nextProgress + '%';
    }
    if (cost && patch && patch.totalCost !== undefined) {
      cost.textContent = '消耗 ' + patch.totalCost + ' 算力';
      cost.hidden = !patch.totalCost;
    }
    if (patch && patch.loading !== undefined) {
      card.classList.toggle('is-loading', !!patch.loading);
      card.classList.toggle('is-failed', !!patch.failed);
      card.classList.toggle('failed', !!patch.failed);
      card.classList.toggle('success', !patch.loading && !patch.failed && run.images.length > 0);
      buttons.forEach(function (button) {
        var action = button.getAttribute('data-hjm-prompt-flow-action');
        var needsResult = ['copy-prompt', 'regen', 'download', 'copy-link', 'add-canvas', 'again'].indexOf(action) >= 0;
        button.disabled = !!patch.loading || (needsResult && !run.images.length && action !== 'regen' && action !== 'copy-prompt') || (action === 'copy-prompt' && !run.finalPrompt);
      });
    }
  }

  async function postJson(url, body) {
    var response = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body || {})
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || data.success === false) {
      var error = new Error(data.message || data.error || ('请求失败: ' + response.status));
      error.data = data;
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function emitAddToCanvas(image, run) {
    var url = image.url || image.imageUrl || image.preview;
    if (!url) return;
    window.dispatchEvent(new CustomEvent('canvas:add-generated-image-to-canvas', {
      detail: {
        id: image.id,
        url: url,
        imageUrl: url,
        preview: image.preview || url,
        originalUrl: image.originalUrl || url,
        title: '对话生成图片',
        label: '对话生成图片',
        source: 'canvas-chat-dialog-agent',
        sourceTaskId: image.sourceTaskId || run.taskId || '',
        prompt: run.finalPrompt || '',
        finalPrompt: run.finalPrompt || '',
        analysisSummary: run.analysisSummary || '',
        meta: {
          operation: 'canvas-dialog-agent',
          prompt: run.finalPrompt || '',
          finalPrompt: run.finalPrompt || '',
          analysisSummary: run.analysisSummary || '',
          taskId: run.taskId || '',
          source: 'canvas-chat-dialog-agent'
        }
      }
    }));
  }

  async function runDialogAgent(flowId) {
    var run = state.runs[flowId];
    if (!run) return;
    updateAgent(flowId, { loading: true, failed: false, status: '正在分析图片和需求...', progress: 18, images: [], analysisSummary: '', totalCost: 0 });
    var generationTimer = window.setTimeout(function () {
      var pending = state.runs[flowId];
      if (pending && pending.card && pending.card.classList.contains('is-loading')) {
        updateAgent(flowId, { loading: true, failed: false, status: '正在生成图片...', progress: 68 });
      }
    }, 900);
    try {
      var data = await postJson('/api/canvas/dialog-agent-generate', {
        requirement: run.requirement,
        referenceImages: run.references,
        imageCount: run.settings && run.settings.imageCount || 1,
        count: run.settings && run.settings.imageCount || 1,
        n: run.settings && run.settings.imageCount || 1,
        quality: run.settings && run.settings.quality || '1k',
        clarity: run.settings && run.settings.quality || '1k',
        ratio: run.settings && run.settings.ratio || '1:1',
        aspectRatio: run.settings && run.settings.ratio || '1:1',
        source: 'canvas-chat-dialog-agent'
      });
      var images = normalizeImages(data);
      updateAgent(flowId, {
        loading: false,
        status: images.length ? '生成完成，结果已放入画布。' : '生成完成，但没有解析到图片。',
        progress: 100,
        analysisSummary: data.analysisSummary || '',
        finalPrompt: data.finalPrompt || data.prompt || '',
        totalCost: data.totalCost || data.costPoints || data.cost || 0,
        taskId: data.taskId || data.id || '',
        images: images
      });
      images.forEach(function (image) { emitAddToCanvas(image, state.runs[flowId]); });
    } catch (error) {
      var errorData = error && error.data || {};
      updateAgent(flowId, {
        loading: false,
        failed: true,
        status: error.message || '对话 Agent 生成失败，请稍后重试。',
        progress: 100,
        analysisSummary: errorData.analysisSummary || '',
        finalPrompt: errorData.finalPrompt || errorData.prompt || '',
        totalCost: 0
      });
    } finally {
      window.clearTimeout(generationTimer);
    }
  }

  async function handleSubmit(event) {
    var panel = getPanel();
    if (!shouldHandle(panel) || state.busy) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    state.busy = true;
    var input = getInput(panel);
    var requirement = input ? input.value.trim() : '';
    var references = await collectReferences(panel).catch(function (error) {
      state.lastError = error.message || String(error);
      return [];
    });
    var settings = readDialogSettings(panel);
    if (!requirement && !references.length) {
      state.busy = false;
      return;
    }

    try {
      var list = getMessageList(panel);
      if (!list) return;
      var flowId = uuid('dialog_agent');
      list.appendChild(makeUserCard(panel, requirement, references));
      var agentCard = makeAgentCard(panel, flowId, requirement, references, settings);
      list.appendChild(agentCard);
      syncPromptFlowCardVisibility(panel);
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      scrollToBottom(list);
      await runDialogAgent(flowId);
      scrollToBottom(list);
    } finally {
      state.busy = false;
    }
  }

  function scrollToBottom(list) {
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }

  function imageForAction(card, actionTarget) {
    var flowId = card && card.dataset.flowId;
    var run = flowId && state.runs[flowId];
    var index = Number(actionTarget.getAttribute('data-image-index') || 0);
    return { run: run, image: run && run.images ? run.images[index] : null, flowId: flowId };
  }

  function handleAction(event, actionTarget) {
    var card = actionTarget.closest('.hjm-prompt-flow-agent');
    var flowId = card && card.dataset.flowId;
    var action = actionTarget.getAttribute('data-hjm-prompt-flow-action');
    var resolved = imageForAction(card, actionTarget);
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    if (action === 'regen') runDialogAgent(flowId);
    if (action === 'cancel' && card) {
      delete state.runs[flowId];
      card.remove();
    }
    if (action === 'copy-prompt' && resolved.run && resolved.run.finalPrompt && navigator.clipboard) {
      navigator.clipboard.writeText(resolved.run.finalPrompt).catch(function () {});
    }
    if (action === 'download' && resolved.image) {
      var link = document.createElement('a');
      link.href = resolved.image.url || resolved.image.preview;
      link.download = 'canvas-dialog-agent-' + Date.now() + '.png';
      link.click();
    }
    if (action === 'copy-link' && resolved.image && navigator.clipboard) {
      navigator.clipboard.writeText(resolved.image.url || resolved.image.preview).catch(function () {});
    }
    if (action === 'add-canvas' && resolved.image && resolved.run) emitAddToCanvas(resolved.image, resolved.run);
    if (action === 'again' && resolved.image) {
      var input = getInput(getPanel());
      if (input) {
        input.value = '基于这张图继续优化：';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
      }
    }
  }

  function handleClick(event) {
    setTimeout(function () {
      updateHints(document);
      syncPromptFlowCardVisibility(getPanel());
    }, 0);
    var actionTarget = event.target && event.target.closest && event.target.closest('[data-hjm-prompt-flow-action]');
    if (actionTarget) {
      handleAction(event, actionTarget);
      return;
    }

    var send = event.target && event.target.closest && event.target.closest('.canvas-chat-panel .canvas-chat-send-btn.send-button');
    if (!send) return;
    var panel = getPanel();
    if (!shouldHandle(panel)) return;
    handleSubmit(event);
  }

  function handleKeydown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    var input = event.target && event.target.closest && event.target.closest('.canvas-chat-panel .composer-input');
    if (!input) return;
    var panel = getPanel();
    if (!shouldHandle(panel)) return;
    handleSubmit(event);
  }

  function panelFromRoot(root) {
    if (!root || root.nodeType !== 1) return getPanel();
    if (root.matches && root.matches('.canvas-chat-panel')) return root;
    if (root.matches && root.matches('.composer')) return root.closest('.canvas-chat-panel');
    return root.querySelector ? root.querySelector('.canvas-chat-panel') : getPanel();
  }

  function updateHints(root) {
    var panel = panelFromRoot(root);
    if (!panel) return;
    syncPromptFlowCardVisibility(panel);
    cleanupInjectedSettings(panel);
    var existing = panel.querySelector('.hjm-prompt-flow-hint');
    if (!shouldHandle(panel)) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    var composer = panel.querySelector('.composer');
    if (!composer) return;
    var hint = document.createElement('div');
    hint.className = 'hjm-prompt-flow-hint';
    hint.textContent = '对话模式会先分析参考图和需求，再自动生成图片并放入画布。';
    composer.insertBefore(hint, composer.firstChild);
  }

  function install() {
    if (!isCanvasPage()) return;
    window.__hjmCanvasChatPromptFlow = {
      version: FLOW_VERSION,
      getPanel: getPanel,
      getActiveMode: function () { return getActiveMode(getPanel()); },
      shouldHandle: function () { return shouldHandle(getPanel()); },
      collectReferences: function () { return collectReferences(getPanel()); },
      readDialogSettings: function () { return readDialogSettings(getPanel()); },
      state: state
    };
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeydown, true);
    updateHints(document);
    syncPromptFlowCardVisibility(getPanel());
    setTimeout(function () { updateHints(document); syncPromptFlowCardVisibility(getPanel()); }, 300);
    setTimeout(function () { updateHints(document); syncPromptFlowCardVisibility(getPanel()); }, 1200);
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        if (mutations[i].type === 'attributes') {
          updateHints(mutations[i].target);
          syncPromptFlowCardVisibility(getPanel());
        }
        var nodes = mutations[i].addedNodes || [];
        for (var j = 0; j < nodes.length; j += 1) {
          if (nodes[j] && nodes[j].nodeType === 1) {
            updateHints(nodes[j]);
            syncPromptFlowCardVisibility(panelFromRoot(nodes[j]));
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
