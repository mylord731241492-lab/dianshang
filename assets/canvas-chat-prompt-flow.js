(function () {
  var FLOW_VERSION = '20260630dialogagent5';
  var state = {
    busy: false,
    runs: {},
    lastError: ''
  };
  var DIALOG_COUNT_OPTIONS = [
    { value: '1', label: '1张' },
    { value: '2', label: '2张' },
    { value: '4', label: '4张' }
  ];
  var DIALOG_QUALITY_OPTIONS = [
    { value: '1k', label: '1K' },
    { value: '2k', label: '2K' },
    { value: '4k', label: '4K' }
  ];
  var DIALOG_RATIO_OPTIONS = [
    { value: '1:1', label: '1:1' },
    { value: '2:3', label: '2:3' },
    { value: '3:2', label: '3:2' },
    { value: '3:4', label: '3:4' },
    { value: '4:3', label: '4:3' },
    { value: '4:5', label: '4:5' },
    { value: '5:4', label: '5:4' },
    { value: '9:16', label: '9:16' },
    { value: '16:9', label: '16:9' },
    { value: '1:2', label: '1:2' },
    { value: '2:1', label: '2:1' },
    { value: '9:21', label: '9:21' },
    { value: '21:9', label: '21:9' }
  ];

  function isCanvasPage() {
    return /^\/canvas(\/|$)/.test(window.location.pathname || '');
  }

  function getPanel() {
    return document.querySelector('.canvas-chat-panel');
  }

  function getMessageList(panel) {
    return panel && panel.querySelector('.message-list');
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

  function optionLabel(options, value, fallback) {
    var match = options.find(function (item) { return item.value === value; });
    return match ? match.label : fallback;
  }

  function ratioShapeStyle(value, options) {
    var parts = String(value || '1:1').split(':');
    var w = Math.max(1, Number(parts[0]) || 1);
    var h = Math.max(1, Number(parts[1]) || 1);
    var max = Number(options && options.max) || 24;
    var min = Number(options && options.min) || 8;
    var width = max;
    var height = max;
    if (w >= h) {
      height = Math.max(min, Math.round(max * (h / w)));
    } else {
      width = Math.max(min, Math.round(max * (w / h)));
    }
    var color = options && options.active ? '#ff8a1f' : '#94a3b8';
    return [
      'display:inline-block',
      'width:' + width + 'px',
      'height:' + height + 'px',
      'border:1.5px solid ' + color,
      'background:rgba(255,255,255,0.35)',
      'box-sizing:border-box'
    ].join(';');
  }

  function uuid(prefix) {
    return (prefix || 'flow') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function clampNumber(value, min, max, fallback) {
    var num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  function closeDialogMenu(root) {
    if (!root) return;
    var menu = root.querySelector('.hjm-dialog-agent-menu');
    root.classList.remove('is-menu-open');
    root.removeAttribute('data-open-param');
    Array.from(root.querySelectorAll('[data-hjm-dialog-param]')).forEach(function (button) {
      button.setAttribute('aria-expanded', 'false');
    });
    if (menu) {
      menu.hidden = true;
      menu.innerHTML = '';
      menu.removeAttribute('data-param');
      menu.className = 'hjm-dialog-agent-menu';
      menu.removeAttribute('style');
    }
  }

  function closeAllDialogMenus(exceptRoot) {
    Array.from(document.querySelectorAll('.hjm-dialog-agent-settings')).forEach(function (root) {
      if (root !== exceptRoot) closeDialogMenu(root);
    });
  }

  function refreshDialogSettings(root) {
    if (!root) return;
    var count = String(root.dataset.imageCount || '1');
    var quality = String(root.dataset.quality || '1k').toLowerCase();
    var ratio = String(root.dataset.ratio || '1:1');
    var countLabel = root.querySelector('[data-hjm-dialog-label="imageCount"]');
    var qualityLabel = root.querySelector('[data-hjm-dialog-label="quality"]');
    var ratioLabel = root.querySelector('[data-hjm-dialog-label="ratio"]');
    var ratioIcon = root.querySelector('[data-hjm-dialog-ratio-icon]');
    if (countLabel) countLabel.textContent = optionLabel(DIALOG_COUNT_OPTIONS, count, count + '张');
    if (qualityLabel) qualityLabel.textContent = optionLabel(DIALOG_QUALITY_OPTIONS, quality, quality.toUpperCase());
    if (ratioLabel) ratioLabel.textContent = ratio;
    if (ratioIcon) ratioIcon.setAttribute('style', ratioShapeStyle(ratio, { max: 16, min: 6, active: true }));
    Array.from(root.querySelectorAll('[data-hjm-dialog-param]')).forEach(function (button) {
      var active = root.dataset.openParam === button.getAttribute('data-hjm-dialog-param');
      button.classList.toggle('active', active);
      button.setAttribute('aria-expanded', active ? 'true' : 'false');
    });
  }

  function renderDialogMenu(root, param) {
    var menu = root && root.querySelector('.hjm-dialog-agent-menu');
    if (!menu) return;
    var options = param === 'imageCount'
      ? DIALOG_COUNT_OPTIONS
      : param === 'quality'
        ? DIALOG_QUALITY_OPTIONS
        : DIALOG_RATIO_OPTIONS;
    var current = param === 'imageCount'
      ? String(root.dataset.imageCount || '1')
      : param === 'quality'
        ? String(root.dataset.quality || '1k').toLowerCase()
        : String(root.dataset.ratio || '1:1');
    var isRatio = param === 'ratio';
    menu.className = 'hjm-dialog-agent-menu ' + (isRatio ? 'canvas-ratio-popover hjm-dialog-ratio-menu' : 'hjm-dialog-simple-menu');
    menu.dataset.param = param;
    menu.hidden = false;
    if (isRatio) {
      menu.style.left = '0px';
      menu.style.bottom = 'calc(100% + 8px)';
      menu.innerHTML = options.map(function (option) {
        var active = current === option.value;
        return [
          '<button type="button" class="canvas-ratio-option hjm-dialog-ratio-option',
          active ? ' active' : '',
          '" data-hjm-dialog-option="' + escapeHtml(param) + '" data-value="' + escapeHtml(option.value) + '">',
          '<span class="canvas-ratio-rect-wrap"><span style="' + ratioShapeStyle(option.value, { max: 24, min: 8, active: active }) + '"></span></span>',
          '<span>' + escapeHtml(option.label) + '</span>',
          '</button>'
        ].join('');
      }).join('');
      return;
    }
    var button = root.querySelector('[data-hjm-dialog-param="' + param + '"]');
    menu.style.left = (button && button.offsetLeft ? button.offsetLeft : 0) + 'px';
    menu.style.bottom = 'calc(100% + 8px)';
    menu.innerHTML = options.map(function (option) {
      var active = current === option.value;
      return [
        '<button type="button" class="hjm-dialog-simple-option',
        active ? ' active' : '',
        '" data-hjm-dialog-option="' + escapeHtml(param) + '" data-value="' + escapeHtml(option.value) + '">',
        escapeHtml(option.label),
        '</button>'
      ].join('');
    }).join('');
  }

  function toggleDialogMenu(root, param) {
    if (!root || !param) return;
    if (root.dataset.openParam === param) {
      closeDialogMenu(root);
      return;
    }
    closeAllDialogMenus(root);
    root.dataset.openParam = param;
    root.classList.add('is-menu-open');
    renderDialogMenu(root, param);
    refreshDialogSettings(root);
  }

  function setDialogSetting(root, param, value) {
    if (!root || !param) return;
    if (param === 'imageCount') root.dataset.imageCount = String(clampNumber(value, 1, 4, 1));
    if (param === 'quality') root.dataset.quality = String(value || '1k').toLowerCase();
    if (param === 'ratio') root.dataset.ratio = String(value || '1:1');
    closeDialogMenu(root);
    refreshDialogSettings(root);
  }

  function ensureDialogSettings(panel) {
    var mode = getActiveMode(panel);
    var existing = panel && panel.querySelector('.hjm-dialog-agent-settings');
    if (!panel || (mode !== '对话' && mode !== '视频')) {
      if (existing) existing.remove();
      return;
    }
    var row = panel.querySelector('.config-row.text-mode');
    if (!row) return;
    if (existing && existing.querySelector('[data-hjm-dialog-param]')) {
      refreshDialogSettings(existing);
      return;
    }
    if (existing) existing.remove();
    var host = document.createElement('div');
    host.className = 'hjm-dialog-agent-settings';
    host.dataset.imageCount = '1';
    host.dataset.quality = '1k';
    host.dataset.ratio = '1:1';
    host.innerHTML = [
      '<button type="button" class="canvas-chat-control compact-control hjm-dialog-agent-param" title="张数" aria-expanded="false" data-hjm-dialog-param="imageCount">',
      '<span class="control-text" data-hjm-dialog-label="imageCount">1张</span><span class="control-chevron">⌄</span>',
      '</button>',
      '<button type="button" class="canvas-chat-control compact-control hjm-dialog-agent-param" title="清晰度" aria-expanded="false" data-hjm-dialog-param="quality">',
      '<span class="control-text" data-hjm-dialog-label="quality">1K</span><span class="control-chevron">⌄</span>',
      '</button>',
      '<button type="button" class="canvas-chat-control compact-control ratio-control hjm-dialog-agent-param" title="比例" aria-expanded="false" data-hjm-dialog-param="ratio">',
      '<span class="ratio-control-icon" data-hjm-dialog-ratio-icon></span><span class="control-text" data-hjm-dialog-label="ratio">1:1</span><span class="control-chevron">⌄</span>',
      '</button>',
      '<div class="hjm-dialog-agent-menu" hidden></div>'
    ].join('');
    refreshDialogSettings(host);
    var send = row.querySelector('.canvas-chat-send-btn.send-button');
    row.insertBefore(host, send || null);
  }

  function ensureNativeParamSettings(panel) {
    if (!panel) return;
    var row = panel.querySelector('.config-row:not(.text-mode)');
    if (!row) return;
    var controls = Array.from(row.querySelectorAll('.compact-control'));
    var host = row.querySelector('.hjm-native-param-settings');
    if (!controls.length) {
      if (host) host.remove();
      return;
    }
    if (!host) {
      host = document.createElement('div');
      host.className = 'hjm-native-param-settings';
      row.insertBefore(host, controls[0]);
    }
    controls.forEach(function (control) {
      if (control.parentElement !== host) host.appendChild(control);
    });
  }

  function readDialogSettings(panel) {
    ensureDialogSettings(panel);
    var root = panel && panel.querySelector('.hjm-dialog-agent-settings');
    var imageCount = clampNumber(root && root.dataset.imageCount, 1, 4, 1);
    var quality = String((root && root.dataset.quality) || '1k').toLowerCase();
    var ratio = String((root && root.dataset.ratio) || '1:1');
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

  function settingsLabel(settings) {
    var count = clampNumber(settings && settings.imageCount, 1, 4, 1);
    var quality = String((settings && (settings.quality || settings.clarity)) || '1k').toUpperCase();
    var ratio = String((settings && (settings.ratio || settings.aspectRatio)) || '1:1');
    return count + '张 · ' + quality + ' · ' + ratio;
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

  function makeUserCard(requirement, references, settings) {
    var images = references.map(function (ref) {
      return '<figure><img src="' + escapeHtml(ref.preview || ref.dataUrl || ref.url) + '" alt=""><figcaption>图' + ref.index + '</figcaption></figure>';
    }).join('');
    var card = document.createElement('article');
    card.className = 'message-card user hjm-prompt-flow-user';
    card.innerHTML = [
      '<div class="hjm-prompt-flow-head"><span>你</span><time>' + nowText() + '</time></div>',
      '<p>' + escapeHtml(requirement) + '</p>',
      references.length ? '<div class="hjm-prompt-flow-images">' + images + '</div>' : '',
      '<div class="hjm-prompt-flow-settings-line">' + escapeHtml(settingsLabel(settings)) + '</div>'
    ].join('');
    return card;
  }

  function makeAgentCard(flowId, requirement, references, settings) {
    var card = document.createElement('article');
    card.className = 'message-card assistant hjm-prompt-flow-agent is-loading';
    card.dataset.flowId = flowId;
    card.innerHTML = [
      '<div class="hjm-prompt-flow-head"><span>生成结果</span><time>' + nowText() + '</time></div>',
      '<div class="hjm-prompt-flow-note">椒图AI 正在分析参考图和需求，并自动生成图片。</div>',
      '<div class="hjm-prompt-flow-summary" hidden></div>',
      '<div class="hjm-prompt-flow-result-grid"></div>',
      '<div class="hjm-prompt-flow-status">正在分析图片和需求...</div>',
      '<div class="hjm-prompt-flow-cost" hidden></div>',
      '<div class="hjm-prompt-flow-actions">',
      '<button type="button" data-hjm-prompt-flow-action="copy-prompt" disabled>复制提示词</button>',
      '<button type="button" data-hjm-prompt-flow-action="regen" disabled>重新生成</button>',
      '<button type="button" data-hjm-prompt-flow-action="cancel">取消</button>',
      '</div>'
    ].join('');
    state.runs[flowId] = { flowId: flowId, requirement: requirement, references: references, settings: settings, card: card, images: [], finalPrompt: '' };
    return card;
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
    var cost = card.querySelector('.hjm-prompt-flow-cost');
    var buttons = card.querySelectorAll('[data-hjm-prompt-flow-action]');
    if (summary && patch && patch.analysisSummary !== undefined) {
      summary.textContent = patch.analysisSummary || '';
      summary.hidden = !patch.analysisSummary;
    }
    if (grid && patch && patch.images) {
      grid.innerHTML = run.images.map(resultFigure).join('');
    }
    if (status && patch && patch.status) status.textContent = patch.status;
    if (cost && patch && patch.totalCost !== undefined) {
      cost.textContent = '消耗 ' + patch.totalCost + ' 算力';
      cost.hidden = !patch.totalCost;
    }
    if (patch && patch.loading !== undefined) {
      card.classList.toggle('is-loading', !!patch.loading);
      card.classList.toggle('is-failed', !!patch.failed);
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
      throw new Error(data.message || data.error || ('请求失败: ' + response.status));
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
    updateAgent(flowId, { loading: true, failed: false, status: '正在分析图片和需求...', images: [], analysisSummary: '', totalCost: 0 });
    var generationTimer = window.setTimeout(function () {
      var pending = state.runs[flowId];
      if (pending && pending.card && pending.card.classList.contains('is-loading')) {
        updateAgent(flowId, { loading: true, failed: false, status: '正在生成图片...' });
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
        analysisSummary: data.analysisSummary || '',
        finalPrompt: data.finalPrompt || data.prompt || '',
        totalCost: data.totalCost || data.costPoints || data.cost || 0,
        taskId: data.taskId || data.id || '',
        images: images
      });
      images.forEach(function (image) { emitAddToCanvas(image, state.runs[flowId]); });
    } catch (error) {
      updateAgent(flowId, { loading: false, failed: true, status: error.message || '对话 Agent 生成失败，请稍后重试。' });
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
      list.appendChild(makeUserCard(requirement, references, settings));
      var agentCard = makeAgentCard(flowId, requirement, references, settings);
      list.appendChild(agentCard);
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
    setTimeout(function () { updateHints(document); }, 0);
    var dialogOption = event.target && event.target.closest && event.target.closest('[data-hjm-dialog-option]');
    if (dialogOption) {
      event.preventDefault();
      event.stopPropagation();
      setDialogSetting(
        dialogOption.closest('.hjm-dialog-agent-settings'),
        dialogOption.getAttribute('data-hjm-dialog-option'),
        dialogOption.getAttribute('data-value')
      );
      return;
    }
    var dialogParam = event.target && event.target.closest && event.target.closest('[data-hjm-dialog-param]');
    if (dialogParam) {
      event.preventDefault();
      event.stopPropagation();
      toggleDialogMenu(
        dialogParam.closest('.hjm-dialog-agent-settings'),
        dialogParam.getAttribute('data-hjm-dialog-param')
      );
      return;
    }
    if (!(event.target && event.target.closest && event.target.closest('.hjm-dialog-agent-settings'))) {
      closeAllDialogMenus();
    }
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
    ensureDialogSettings(panel);
    ensureNativeParamSettings(panel);
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
    setTimeout(function () { updateHints(document); }, 300);
    setTimeout(function () { updateHints(document); }, 1200);
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var nodes = mutations[i].addedNodes || [];
        for (var j = 0; j < nodes.length; j += 1) {
          if (nodes[j] && nodes[j].nodeType === 1) updateHints(nodes[j]);
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
