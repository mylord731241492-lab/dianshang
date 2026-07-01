(function () {
  var FLOW_VERSION = '20260701suite15';
  var state = {
    busy: false,
    runs: {},
    lastError: '',
    suite: {
      config: null,
      configPromise: null,
      selectedSkillId: '',
      productImage: null,
      referenceImages: [],
      status: '',
      renderKey: ''
    }
  };
  var CANVAS_CHAT_SCOPE_ATTR = 'data-v-b10121f4';
  var SUITE_MAX_REFERENCE_IMAGES = 4;
  var DEFAULT_SUITE_CONFIG = {
    enabled: true,
    defaultSkillId: 'gloria',
    defaults: {
      brandName: '',
      platform: '拼多多',
      country: '中国',
      language: '中文',
      ratio: '1:1',
      quality: '1k',
      imageCount: 1,
      textModelKey: 'gpt-5.5',
      imageModelKey: 'gpt-image-2'
    },
    sectionMode: 'dynamic',
    sections: [],
    skills: [
      { id: 'gloria', name: 'Gloria', description: '大厂王牌视觉设计师' },
      { id: 'paload', name: 'Paload', description: '多年资深高级美工' },
      { id: 'lumi', name: 'Lumi', description: '资深电商设计师' },
      { id: 'kira', name: 'Kira', description: '设计行业老油条' },
      { id: 'rayyu', name: 'RayYu', description: '国字号视觉资深导师' }
    ]
  };

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

  function isSuiteMode(panel) {
    var mode = getActiveMode(panel);
    return !!panel && (mode === '视频' || mode === '电商套图Agent');
  }

  function enabledSuiteSections(config) {
    var source = config && Array.isArray(config.sections) ? config.sections : DEFAULT_SUITE_CONFIG.sections;
    return source.filter(function (section) { return section && section.enabled !== false; }).slice(0, 5);
  }

  function suiteSkills(config) {
    var source = config && Array.isArray(config.skills) ? config.skills : DEFAULT_SUITE_CONFIG.skills;
    return source.filter(function (skill) { return skill && skill.enabled !== false; });
  }

  function suiteConfig() {
    return state.suite.config || DEFAULT_SUITE_CONFIG;
  }

  function syncPromptFlowCardVisibility(panel) {
    if (!panel) return;
    var dialogActive = shouldHandle(panel);
    var suiteActive = isSuiteMode(panel);
    var visibleBridgeCount = 0;
    panel.classList.toggle('hjm-prompt-flow-dialog-active', dialogActive);
    panel.classList.toggle('hjm-prompt-flow-suite-active', suiteActive);
    Array.from(panel.querySelectorAll('.hjm-prompt-flow-card, .hjm-prompt-flow-user, .hjm-prompt-flow-agent')).forEach(function (card) {
      var mode = card.getAttribute('data-hjm-prompt-flow-mode') || 'chat';
      var visible = (dialogActive && mode === 'chat') || (suiteActive && mode === 'suite');
      card.hidden = !visible;
      card.style.display = visible ? '' : 'none';
      if (visible) visibleBridgeCount += 1;
    });
    var emptyState = panel.querySelector('.message-list > .empty-state');
    if (emptyState) {
      var hideEmpty = (dialogActive || suiteActive) && visibleBridgeCount > 0;
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

  async function ensureSuiteConfig(panel) {
    if (state.suite.config) return state.suite.config;
    if (state.suite.configPromise) return state.suite.configPromise;
    state.suite.configPromise = fetch('/api/canvas/ecommerce-suite/config')
      .then(function (response) { return response.json(); })
      .then(function (data) {
        if (!data || data.success === false) return DEFAULT_SUITE_CONFIG;
        var next = Object.assign({}, DEFAULT_SUITE_CONFIG, data, {
          defaults: Object.assign({}, DEFAULT_SUITE_CONFIG.defaults, data.defaults || {}),
          sectionMode: data.sectionMode || 'dynamic',
          sections: Array.isArray(data.sections) ? data.sections : [],
          skills: Array.isArray(data.skills) && data.skills.length ? data.skills : DEFAULT_SUITE_CONFIG.skills
        });
        state.suite.config = next;
        if (!state.suite.selectedSkillId) state.suite.selectedSkillId = next.defaultSkillId || (suiteSkills(next)[0] && suiteSkills(next)[0].id) || 'gloria';
        renderSuiteComposer(panel || getPanel(), true);
        return next;
      })
      .catch(function () {
        state.suite.config = DEFAULT_SUITE_CONFIG;
        if (!state.suite.selectedSkillId) state.suite.selectedSkillId = DEFAULT_SUITE_CONFIG.defaultSkillId;
        renderSuiteComposer(panel || getPanel(), true);
        return DEFAULT_SUITE_CONFIG;
      })
      .finally(function () {
        state.suite.configPromise = null;
      });
    return state.suite.configPromise;
  }

  function suiteImagePreview(image) {
    return image && (image.preview || image.dataUrl || image.url || '');
  }

  function suiteImageToPayload(image, fallbackName) {
    if (!image) return null;
    return {
      dataUrl: image.dataUrl || '',
      url: image.url || '',
      preview: suiteImagePreview(image),
      fileName: image.fileName || fallbackName || 'image.png',
      mimeType: image.mimeType || 'image/png'
    };
  }

  function suiteStatus(text) {
    state.suite.status = String(text || '');
    renderSuiteComposer(getPanel(), true);
  }

  function suiteUploadButton(type, image, options) {
    options = options || {};
    var preview = suiteImagePreview(image);
    var isProduct = type === 'product';
    var title = options.label || (isProduct ? '产品图' : '参考图');
    var indexAttr = options.index !== undefined ? ' data-hjm-suite-index="' + options.index + '"' : '';
    var remove = preview
      ? '<span class="hjm-suite-remove" data-hjm-suite-remove="' + type + '"' + indexAttr + ' title="删除">×</span>'
      : '';
    var thumb = preview
      ? '<img src="' + escapeHtml(preview) + '" alt="">'
      : '<span class="hjm-suite-plus">+</span>';
    return [
      '<button type="button" class="mini-button hjm-suite-upload' + (preview ? ' has-image' : '') + '" data-hjm-suite-upload="' + type + '">',
      thumb,
      '<span class="hjm-suite-upload-label">' + title + '</span>',
      remove,
      '</button>'
    ].join('');
  }

  function suiteReferenceButtons() {
    var references = state.suite.referenceImages.slice(0, SUITE_MAX_REFERENCE_IMAGES);
    var buttons = references.map(function (image, index) {
      return suiteUploadButton('reference', image, { index: index, label: '参考图' + (index + 1) });
    });
    if (references.length < SUITE_MAX_REFERENCE_IMAGES) {
      buttons.push(suiteUploadButton('reference', null, { label: references.length ? '参考图' + (references.length + 1) : '参考图' }));
    }
    return '<div class="hjm-suite-reference-list">' + buttons.join('') + '</div>';
  }

  function renderSuiteComposer(panel, force) {
    if (!panel || !isSuiteMode(panel)) return;
    var composer = panel.querySelector('.composer');
    if (!composer) return;
    var config = suiteConfig();
    var skills = suiteSkills(config);
    if (!state.suite.selectedSkillId) state.suite.selectedSkillId = config.defaultSkillId || (skills[0] && skills[0].id) || 'gloria';
    var productPreview = suiteImagePreview(state.suite.productImage);
    var referenceKey = state.suite.referenceImages.map(function (image) { return suiteImagePreview(image); }).join('|');
    var renderKey = [
      FLOW_VERSION,
      productPreview,
      referenceKey,
      state.suite.referenceImages.length,
      state.suite.selectedSkillId,
      state.suite.status,
      skills.map(function (skill) { return skill.id + ':' + skill.name; }).join('|')
    ].join('::');
    var host = composer.querySelector('.hjm-suite-composer');
    if (!host) {
      host = document.createElement('div');
      host.className = 'hjm-suite-composer';
      composer.insertBefore(host, composer.firstChild);
    }
    if (!force && host.dataset.renderKey === renderKey) return;
    host.dataset.renderKey = renderKey;
    var skillOptions = skills.map(function (skill) {
      var selected = skill.id === state.suite.selectedSkillId ? ' selected' : '';
      var label = skill.name + (skill.description ? ' · ' + skill.description : '');
      return '<option value="' + escapeHtml(skill.id) + '"' + selected + '>' + escapeHtml(label) + '</option>';
    }).join('');
    host.innerHTML = [
      '<div class="hjm-suite-assets">',
      suiteUploadButton('product', state.suite.productImage, { label: '产品图' }),
      '<span class="hjm-suite-asset-plus" aria-hidden="true">+</span>',
      suiteReferenceButtons(),
      '</div>',
      '<div class="hjm-suite-skill-row">',
      '<label class="hjm-suite-skill-select"><select data-hjm-suite-skill>' + skillOptions + '</select></label>',
      '</div>',
      state.suite.status ? '<div class="hjm-suite-status">' + escapeHtml(state.suite.status) + '</div>' : '',
      '<input type="file" accept="image/*" data-hjm-suite-file="product" hidden>',
      '<input type="file" accept="image/*" data-hjm-suite-file="reference" multiple hidden>'
    ].join('');
    applyCanvasChatScope(host, panel);
  }

  function removeSuiteComposer(panel) {
    if (!panel) return;
    Array.from(panel.querySelectorAll('.hjm-suite-composer')).forEach(function (node) { node.remove(); });
  }

  async function suiteImageFromFile(file, index, role) {
    var dataUrl = await readAsDataUrl(file);
    return {
      index: index + 1,
      role: role || 'reference',
      fileName: file.name || ((role || 'reference') + '-' + (index + 1) + '.png'),
      mimeType: file.type || 'image/png',
      preview: dataUrl,
      dataUrl: dataUrl,
      url: ''
    };
  }

  async function readSuiteFiles(input) {
    var panel = getPanel();
    if (!input || !input.matches || !input.matches('[data-hjm-suite-file]')) return;
    var type = input.getAttribute('data-hjm-suite-file');
    var files = Array.from(input.files || []).filter(function (file) {
      return /^image\//i.test(file.type || '') || /\.(png|jpe?g|webp|gif)$/i.test(file.name || '');
    });
    if (!files.length) {
      suiteStatus('请选择图片文件');
      return;
    }
    suiteStatus('正在读取图片...');
    try {
      var nextStatus = '';
      if (type === 'product') {
        state.suite.productImage = await suiteImageFromFile(files[0], 0, 'product');
      } else {
        var beforeCount = state.suite.referenceImages.length;
        var existing = state.suite.referenceImages.slice(0, SUITE_MAX_REFERENCE_IMAGES);
        for (var i = 0; i < files.length && existing.length < SUITE_MAX_REFERENCE_IMAGES; i += 1) {
          existing.push(await suiteImageFromFile(files[i], existing.length, 'reference'));
        }
        state.suite.referenceImages = existing.slice(0, SUITE_MAX_REFERENCE_IMAGES);
        if (beforeCount + files.length > SUITE_MAX_REFERENCE_IMAGES) nextStatus = '参考图最多 4 张';
      }
      suiteStatus(nextStatus);
    } catch (error) {
      suiteStatus(error.message || '图片读取失败');
    } finally {
      input.value = '';
    }
  }

  function readSuiteSettings(panel) {
    var settings = readDialogSettings(panel);
    var config = suiteConfig();
    var defaults = config.defaults || DEFAULT_SUITE_CONFIG.defaults;
    return Object.assign({}, settings, {
      imageCount: 1,
      count: 1,
      n: 1,
      brandName: defaults.brandName || '',
      platform: defaults.platform || '拼多多',
      country: defaults.country || '中国',
      language: defaults.language || '中文',
      skillId: state.suite.selectedSkillId || config.defaultSkillId || 'gloria',
      textModelKey: defaults.textModelKey || 'gpt-5.5',
      imageModelKey: defaults.imageModelKey || 'gpt-image-2'
    });
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

  function makeSuiteUserCard(panel, requirement, productImage, referenceImages) {
    var images = [productImage].concat(referenceImages || []).filter(Boolean).map(function (ref, index) {
      var label = index === 0 ? '产品图' : '参考图' + index;
      return '<figure><img src="' + escapeHtml(suiteImagePreview(ref)) + '" alt=""><figcaption>' + label + '</figcaption></figure>';
    }).join('');
    var card = document.createElement('article');
    card.className = 'message-card user hjm-prompt-flow-card hjm-prompt-flow-user hjm-suite-user';
    card.dataset.hjmPromptFlowMode = 'suite';
    card.innerHTML = [
      '<div class="message-meta hjm-prompt-flow-head"><span>你</span><time>' + nowText() + '</time></div>',
      '<p class="message-text">' + escapeHtml(requirement || '请根据产品图和参考图生成电商套图') + '</p>',
      images ? '<div class="image-grid hjm-prompt-flow-images hjm-suite-input-images">' + images + '</div>' : ''
    ].join('');
    return applyCanvasChatScope(card, panel);
  }

  function makeSuiteAgentCard(panel, flowId, requirement, productImage, referenceImages, settings) {
    var card = document.createElement('article');
    card.className = 'message-card assistant hjm-prompt-flow-card hjm-prompt-flow-agent hjm-suite-agent is-loading';
    card.dataset.flowId = flowId;
    card.dataset.hjmPromptFlowMode = 'suite';
    card.innerHTML = [
      '<div class="message-meta hjm-prompt-flow-head"><span>橙图AI</span><time>' + nowText() + '</time></div>',
      '<p class="message-text hjm-prompt-flow-note">正在根据产品图、参考图和设计师 skill 生成板块提示词。</p>',
      '<div class="message-text hjm-prompt-flow-summary" hidden></div>',
      '<div class="hjm-suite-plan-list" hidden></div>',
      '<div class="image-grid hjm-prompt-flow-result-grid"></div>',
      '<div class="message-text hjm-prompt-flow-status">正在生成板块提示词...</div>',
      '<div class="hjm-prompt-flow-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="16">',
      '<span class="hjm-prompt-flow-progress-bar" style="width:16%"></span>',
      '</div>',
      '<div class="cost-line hjm-prompt-flow-cost" hidden></div>'
    ].join('');
    state.runs[flowId] = {
      mode: 'suite',
      flowId: flowId,
      requirement: requirement,
      productImage: productImage,
      referenceImages: referenceImages || [],
      settings: settings,
      card: card,
      images: [],
      promptPlans: [],
      finalPrompt: ''
    };
    return applyCanvasChatScope(card, panel);
  }

  function suitePlanCard(plan, index) {
    var checked = plan.selected !== false ? ' checked' : '';
    var sectionName = plan.sectionName || plan.title || ('板块 ' + (index + 1));
    return [
      '<label class="hjm-suite-plan" data-suite-plan-index="' + index + '">',
      '<input type="checkbox" data-suite-plan-check' + checked + '>',
      '<span class="hjm-suite-plan-check" aria-hidden="true"></span>',
      '<span class="hjm-suite-plan-name">' + escapeHtml(sectionName) + '</span>',
      '</label>'
    ].join('');
  }

  function renderSuitePlans(flowId, data) {
    var run = state.runs[flowId];
    if (!run || !run.card) return;
    var plans = Array.isArray(data && data.promptPlans) ? data.promptPlans : [];
    run.promptPlans = plans.map(function (plan, index) {
      return Object.assign({}, plan, { selected: plan.selected !== false && index === 0 });
    });
    run.analysisSummary = '';
    run.finalPrompt = run.promptPlans.map(function (plan) { return (plan.sectionName || plan.title || '') + '\n' + (plan.prompt || ''); }).join('\n\n');
    var list = run.card.querySelector('.hjm-suite-plan-list');
    if (list) {
      list.hidden = false;
      list.innerHTML = [
        run.promptPlans.map(suitePlanCard).join(''),
        '<div class="hjm-prompt-flow-actions hjm-suite-actions">',
        '<button type="button" data-hjm-prompt-flow-action="suite-generate">生成图片</button>',
        '</div>'
      ].join('');
      applyCanvasChatScope(list, getPanel());
    }
    updateAgent(flowId, {
      loading: false,
      failed: false,
      status: '板块已生成，选择板块后点击生成图片。',
      progress: 100,
      analysisSummary: '',
      totalCost: data && data.analysisCost || 0,
      images: []
    });
  }

  function readSuitePlansFromCard(card) {
    return Array.from(card.querySelectorAll('.hjm-suite-plan')).map(function (node, index) {
      var run = state.runs[card.dataset.flowId] || {};
      var original = run.promptPlans && run.promptPlans[index] || {};
      return {
        id: original.id || ('suite_' + index),
        sectionKey: original.sectionKey || '',
        sectionName: original.sectionName || '',
        title: original.title || original.sectionName || '',
        prompt: original.prompt || '',
        negativePrompt: original.negativePrompt || '',
        analysisSummary: original.analysisSummary || '',
        selected: !!(node.querySelector('[data-suite-plan-check]') || {}).checked
      };
    });
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
    var status = image && image.status || (image && image.failed ? 'failed' : image && image.loading ? 'loading' : 'success');
    var title = image && (image.sectionName || image.title) || ('板块 ' + (index + 1));
    if (status === 'loading') {
      return [
        '<figure class="hjm-suite-result-card is-loading" data-image-index="' + index + '">',
        '<div class="hjm-suite-result-state">',
        '<strong>' + escapeHtml(title) + '</strong>',
        '<span>生成中...</span>',
        '</div>',
        '</figure>'
      ].join('');
    }
    if (status === 'failed') {
      return [
        '<figure class="hjm-suite-result-card is-failed" data-image-index="' + index + '" title="' + escapeHtml(image.errorRaw || image.errorMessage || '生成失败') + '">',
        '<div class="hjm-suite-result-state">',
        '<strong>' + escapeHtml(title) + '</strong>',
        '<span>' + escapeHtml(image.errorMessage || image.message || '生成失败') + '</span>',
        image.errorRequestId ? '<small class="hjm-suite-error-id">request id: ' + escapeHtml(image.errorRequestId) + '</small>' : '',
        '<button type="button" data-hjm-prompt-flow-action="retry-suite-plan" data-image-index="' + index + '">重新生成</button>',
        '</div>',
        '</figure>'
      ].join('');
    }
    return [
      '<figure class="hjm-suite-result-card is-success" data-image-index="' + index + '">',
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
    var hasSuccessfulImage = (run.images || []).some(function (image) {
      return image && !image.failed && !image.loading && (image.url || image.imageUrl || image.preview);
    });
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
      card.classList.toggle('success', !patch.loading && !patch.failed && hasSuccessfulImage);
      buttons.forEach(function (button) {
        var action = button.getAttribute('data-hjm-prompt-flow-action');
        var needsResult = ['copy-prompt', 'regen', 'download', 'copy-link', 'add-canvas', 'again'].indexOf(action) >= 0;
        button.disabled = !!patch.loading || (needsResult && !hasSuccessfulImage && action !== 'regen' && action !== 'copy-prompt') || (action === 'copy-prompt' && !run.finalPrompt);
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
    var suiteMode = run && run.mode === 'suite';
    var title = suiteMode ? (image.sectionName || image.title || '套图生成图片') : '对话生成图片';
    var source = suiteMode ? 'canvas-ecommerce-suite-agent' : 'canvas-chat-dialog-agent';
    var operation = suiteMode ? 'canvas-ecommerce-suite-agent' : 'canvas-dialog-agent';
    var imagePrompt = image.prompt || (run && run.finalPrompt) || '';
    var imageTaskId = image.sourceTaskId || image.taskId || (run && run.taskId) || '';
    window.dispatchEvent(new CustomEvent('canvas:add-generated-image-to-canvas', {
      detail: {
        id: image.id,
        url: url,
        imageUrl: url,
        preview: image.preview || url,
        originalUrl: image.originalUrl || url,
        title: title,
        label: title,
        source: source,
        sourceTaskId: imageTaskId,
        prompt: imagePrompt,
        finalPrompt: imagePrompt,
        analysisSummary: run.analysisSummary || '',
        meta: {
          operation: operation,
          sectionKey: image.sectionKey || '',
          sectionName: image.sectionName || '',
          prompt: imagePrompt,
          finalPrompt: imagePrompt,
          analysisSummary: run.analysisSummary || '',
          taskId: imageTaskId,
          source: source
        }
      }
    }));
  }

  function suitePlanTitle(plan, index) {
    return plan && (plan.sectionName || plan.title) || ('板块 ' + (index + 1));
  }

  function suiteTaskItem(plan, index, status, message) {
    var errorInfo = status === 'failed' ? suiteErrorInfo(message, '生成失败') : { message: message || '', raw: message || '', requestId: '' };
    return {
      id: (plan && (plan.sectionKey || plan.id) || 'suite') + '_' + index + '_' + status,
      status: status,
      loading: status === 'loading',
      failed: status === 'failed',
      sectionKey: plan && plan.sectionKey || '',
      sectionName: suitePlanTitle(plan, index),
      title: suitePlanTitle(plan, index),
      prompt: plan && plan.prompt || '',
      negativePrompt: plan && plan.negativePrompt || '',
      errorMessage: errorInfo.message || '',
      errorRaw: errorInfo.raw || '',
      errorRequestId: errorInfo.requestId || '',
      plan: plan,
      planIndex: index
    };
  }

  function suiteErrorInfo(error, fallback) {
    var raw = '';
    if (typeof error === 'string') {
      raw = error;
    } else if (error && error.data) {
      raw = error.data.message || error.data.error || error.message || '';
    } else if (error && error.message) {
      raw = error.message;
    }
    raw = String(raw || fallback || '生图失败').replace(/\s+/g, ' ').trim();
    var requestMatch = raw.match(/request\s*id\s*:\s*([^)]+)\)?/i);
    var requestId = requestMatch && requestMatch[1] ? requestMatch[1].trim() : '';
    var message = raw.replace(/\(?\s*request\s*id\s*:\s*[^)]+\)?/ig, '').trim();
    if (/upstream error:\s*do request failed/i.test(raw)) {
      message = '上游图生图请求失败';
    } else if (/Provider\s*图生图超时|image edit timeout|timeout|超时/i.test(raw)) {
      message = 'Provider 图生图超时';
    } else if (/insufficient|算力不足/i.test(raw)) {
      message = raw;
    } else if (message.length > 44) {
      message = message.slice(0, 42) + '...';
    }
    return {
      message: message || fallback || '生图失败',
      raw: raw,
      requestId: requestId
    };
  }

  function suiteBaseGeneratePayload(run) {
    return {
      requirement: run.requirement,
      productImages: [suiteImageToPayload(run.productImage, 'product.png')].filter(Boolean),
      referenceImages: (run.referenceImages || []).map(function (image, index) { return suiteImageToPayload(image, 'reference-' + (index + 1) + '.png'); }).filter(Boolean),
      skillId: run.settings && run.settings.skillId || state.suite.selectedSkillId || 'gloria',
      ratio: run.settings && run.settings.ratio || '1:1',
      aspectRatio: run.settings && run.settings.ratio || '1:1',
      quality: run.settings && run.settings.quality || '1k',
      clarity: run.settings && run.settings.quality || '1k',
      imageCount: 1,
      count: 1,
      n: 1,
      textModel: run.settings && run.settings.textModelKey || 'gpt-5.5',
      textModelKey: run.settings && run.settings.textModelKey || 'gpt-5.5',
      imageModel: run.settings && run.settings.imageModelKey || 'gpt-image-2',
      imageModelKey: run.settings && run.settings.imageModelKey || 'gpt-image-2',
      brandName: run.settings && run.settings.brandName || '',
      platform: run.settings && run.settings.platform || '拼多多',
      country: run.settings && run.settings.country || '中国',
      language: run.settings && run.settings.language || '中文',
      source: 'canvas-ecommerce-suite-agent'
    };
  }

  function suiteSuccessImage(data, plan, index) {
    var image = normalizeImages(data)[0];
    if (!image) return null;
    var taskId = data && (data.taskId || data.id) || '';
    return Object.assign({}, image, {
      status: 'success',
      failed: false,
      loading: false,
      sectionKey: plan.sectionKey || '',
      sectionName: suitePlanTitle(plan, index),
      title: plan.title || suitePlanTitle(plan, index),
      prompt: plan.prompt || '',
      negativePrompt: plan.negativePrompt || '',
      sourceTaskId: taskId,
      taskId: taskId,
      plan: plan,
      planIndex: index,
      autoAdded: false
    });
  }

  function autoAddSuiteImage(image, run) {
    if (!image || image.autoAdded || image.failed || image.loading || !(image.url || image.imageUrl || image.preview)) return;
    emitAddToCanvas(image, run);
    image.autoAdded = true;
    image.canvasAdded = true;
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

  async function runSuitePromptAgent(flowId) {
    var run = state.runs[flowId];
    if (!run) return;
    updateAgent(flowId, { loading: true, failed: false, status: '正在生成板块提示词...', progress: 24, images: [], analysisSummary: '', totalCost: 0 });
    try {
      var data = await postJson('/api/canvas/ecommerce-suite/prompts', {
        requirement: run.requirement,
        productImages: [suiteImageToPayload(run.productImage, 'product.png')].filter(Boolean),
        referenceImages: (run.referenceImages || []).map(function (image, index) { return suiteImageToPayload(image, 'reference-' + (index + 1) + '.png'); }).filter(Boolean),
        skillId: run.settings && run.settings.skillId || state.suite.selectedSkillId || 'gloria',
        ratio: run.settings && run.settings.ratio || '1:1',
        aspectRatio: run.settings && run.settings.ratio || '1:1',
        quality: run.settings && run.settings.quality || '1k',
        clarity: run.settings && run.settings.quality || '1k',
        imageCount: 1,
        count: 1,
        n: 1,
        textModel: run.settings && run.settings.textModelKey || 'gpt-5.5',
        textModelKey: run.settings && run.settings.textModelKey || 'gpt-5.5',
        imageModel: run.settings && run.settings.imageModelKey || 'gpt-image-2',
        imageModelKey: run.settings && run.settings.imageModelKey || 'gpt-image-2',
        brandName: run.settings && run.settings.brandName || '',
        platform: run.settings && run.settings.platform || '拼多多',
        country: run.settings && run.settings.country || '中国',
        language: run.settings && run.settings.language || '中文',
        source: 'canvas-ecommerce-suite-agent'
      });
      renderSuitePlans(flowId, data);
    } catch (error) {
      var errorData = error && error.data || {};
      updateAgent(flowId, {
        loading: false,
        failed: true,
        status: error.message || '板块提示词生成失败，请稍后重试。',
        progress: 100,
        analysisSummary: errorData.analysisSummary || '',
        finalPrompt: errorData.prompt || '',
        totalCost: 0
      });
    }
  }

  async function runSuiteImageGeneration(flowId) {
    var run = state.runs[flowId];
    if (!run || !run.card) return;
    var plans = readSuitePlansFromCard(run.card).filter(function (plan) { return plan.selected && plan.prompt; });
    if (!plans.length) {
      updateAgent(flowId, { loading: false, failed: true, status: '请至少勾选一个板块模板。', progress: 100 });
      return;
    }
    run.promptPlans = plans;
    run.finalPrompt = plans.map(function (plan) { return (plan.sectionName || plan.title || '') + '\n' + plan.prompt; }).join('\n\n');
    run.images = plans.map(function (plan, index) { return suiteTaskItem(plan, index, 'loading'); });
    updateAgent(flowId, {
      loading: true,
      failed: false,
      status: '已同时发出 ' + plans.length + ' 个独立生图任务...',
      progress: 62,
      images: run.images.slice(),
      analysisSummary: '',
      totalCost: 0
    });
    var basePayload = suiteBaseGeneratePayload(run);
    var completed = 0;
    var failures = [];
    var totalCost = 0;
    var taskIds = [];
    var taskPromises = plans.map(function (plan, index) {
      return postJson('/api/canvas/ecommerce-suite/generate', Object.assign({}, basePayload, {
        promptPlans: [plan],
        sectionKeys: plan.sectionKey ? [plan.sectionKey] : [],
        sourceTaskIndex: index + 1,
        sourceTaskTotal: plans.length
      }))
        .then(function (data) {
          var image = suiteSuccessImage(data, plan, index);
          if (!image) {
            run.images[index] = suiteTaskItem(plan, index, 'failed', '生成完成，但没有解析到图片');
            failures.push({ plan: plan, message: '生成完成，但没有解析到图片' });
            return;
          }
          run.images[index] = image;
          totalCost += Number(data.totalCost || data.imageCost || data.cost || 0) || 0;
          if (image.sourceTaskId) taskIds.push(image.sourceTaskId);
          autoAddSuiteImage(image, run);
        })
        .catch(function (error) {
          run.images[index] = suiteTaskItem(plan, index, 'failed', error.message || '生图失败');
          failures.push({
            plan: plan,
            message: error.message || '生图失败'
          });
        })
        .finally(function () {
          completed += 1;
          updateAgent(flowId, {
            loading: true,
            failed: false,
            status: '已完成 ' + completed + '/' + plans.length + ' 个生图任务' + (failures.length ? '，失败 ' + failures.length + ' 个。' : '。'),
            progress: 62 + Math.round((completed / plans.length) * 34),
            images: run.images.slice(),
            totalCost: totalCost
          });
        });
    });
    await Promise.all(taskPromises);
    var successCount = run.images.filter(function (image) { return image && image.status === 'success'; }).length;
    var failedNames = failures.map(function (item) {
      return item.plan.sectionName || item.plan.title || '未命名板块';
    }).join('、');
    updateAgent(flowId, {
      loading: false,
      failed: failures.length > 0 && !successCount,
      status: successCount
        ? ('已生成 ' + successCount + ' 张图片' + (failures.length ? '，失败板块：' + failedNames : '。'))
        : (failures[0] && failures[0].message || '套图图片生成失败，请稍后重试。'),
      progress: 100,
      analysisSummary: successCount ? '已按独立任务生成 ' + successCount + ' 张图片，并自动添加到画布。' : '',
      finalPrompt: run.finalPrompt,
      totalCost: totalCost,
      taskId: taskIds.join(','),
      images: run.images.slice()
    });
  }

  async function retrySuitePlanGeneration(flowId, index) {
    var run = state.runs[flowId];
    if (!run || !run.card) return;
    var current = run.images && run.images[index] || {};
    var plan = current.plan || run.promptPlans && run.promptPlans[index];
    if (!plan || !plan.prompt) {
      updateAgent(flowId, { loading: false, failed: true, status: '没有找到可重新生成的板块提示词。', progress: 100 });
      return;
    }
    run.images[index] = suiteTaskItem(plan, index, 'loading');
    updateAgent(flowId, {
      loading: true,
      failed: false,
      status: '正在重新生成：' + suitePlanTitle(plan, index),
      progress: 68,
      images: run.images.slice()
    });
    try {
      var data = await postJson('/api/canvas/ecommerce-suite/generate', Object.assign({}, suiteBaseGeneratePayload(run), {
        promptPlans: [plan],
        sectionKeys: plan.sectionKey ? [plan.sectionKey] : [],
        sourceTaskIndex: index + 1,
        sourceTaskTotal: (run.promptPlans || []).length || 1
      }));
      var image = suiteSuccessImage(data, plan, index);
      if (!image) throw new Error('生成完成，但没有解析到图片');
      run.images[index] = image;
      var cost = (Number(run.totalCost || 0) || 0) + (Number(data.totalCost || data.imageCost || data.cost || 0) || 0);
      autoAddSuiteImage(image, run);
      updateAgent(flowId, {
        loading: false,
        failed: false,
        status: suitePlanTitle(plan, index) + ' 重新生成成功。',
        progress: 100,
        analysisSummary: '已重新生成并自动添加到画布。',
        totalCost: cost,
        taskId: [run.taskId, image.sourceTaskId].filter(Boolean).join(','),
        images: run.images.slice()
      });
    } catch (error) {
      run.images[index] = suiteTaskItem(plan, index, 'failed', error.message || '生图失败');
      updateAgent(flowId, {
        loading: false,
        failed: true,
        status: error.message || '单个板块重新生成失败。',
        progress: 100,
        images: run.images.slice()
      });
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

  async function handleSuiteSubmit(event) {
    var panel = getPanel();
    if (!isSuiteMode(panel) || state.busy) return;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    if (!state.suite.productImage) {
      suiteStatus('请先上传产品图');
      return;
    }
    state.busy = true;
    var input = getInput(panel);
    var requirement = input ? input.value.trim() : '';
    var settings = readSuiteSettings(panel);
    try {
      var list = getMessageList(panel);
      if (!list) return;
      var flowId = uuid('suite_agent');
      var productImage = state.suite.productImage;
      var referenceImages = state.suite.referenceImages.slice(0, SUITE_MAX_REFERENCE_IMAGES);
      list.appendChild(makeSuiteUserCard(panel, requirement, productImage, referenceImages));
      var agentCard = makeSuiteAgentCard(panel, flowId, requirement, productImage, referenceImages, settings);
      list.appendChild(agentCard);
      syncPromptFlowCardVisibility(panel);
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      scrollToBottom(list);
      await runSuitePromptAgent(flowId);
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
    if (resolved.run && resolved.run.mode === 'suite') {
      if (action === 'suite-generate') runSuiteImageGeneration(flowId);
      if (action === 'retry-suite-plan') retrySuitePlanGeneration(flowId, Number(actionTarget.getAttribute('data-image-index') || 0));
      if (action === 'regen') runSuitePromptAgent(flowId);
      if (action === 'copy-prompt' && resolved.run.finalPrompt && navigator.clipboard) {
        navigator.clipboard.writeText(resolved.run.finalPrompt).catch(function () {});
      }
      if (action === 'download' && resolved.image) {
        var suiteLink = document.createElement('a');
        suiteLink.href = resolved.image.url || resolved.image.preview;
        suiteLink.download = 'canvas-ecommerce-suite-' + Date.now() + '.png';
        suiteLink.click();
      }
      if (action === 'copy-link' && resolved.image && navigator.clipboard) {
        navigator.clipboard.writeText(resolved.image.url || resolved.image.preview).catch(function () {});
      }
      if (action === 'add-canvas' && resolved.image && resolved.run) emitAddToCanvas(resolved.image, resolved.run);
      if (action === 'again' && resolved.image) {
        state.suite.referenceImages = [Object.assign({}, resolved.image, { role: 'reference' })].concat(state.suite.referenceImages || []).slice(0, SUITE_MAX_REFERENCE_IMAGES);
        suiteStatus('已把结果加入参考图');
      }
      return;
    }
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
    var suiteRemove = event.target && event.target.closest && event.target.closest('[data-hjm-suite-remove]');
    if (suiteRemove) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      var removeType = suiteRemove.getAttribute('data-hjm-suite-remove');
      if (removeType === 'product') state.suite.productImage = null;
      if (removeType === 'reference') {
        var removeIndex = Number(suiteRemove.getAttribute('data-hjm-suite-index'));
        if (Number.isFinite(removeIndex)) {
          state.suite.referenceImages = state.suite.referenceImages.filter(function (_, index) { return index !== removeIndex; });
        } else {
          state.suite.referenceImages = [];
        }
      }
      suiteStatus('');
      return;
    }
    var suiteUpload = event.target && event.target.closest && event.target.closest('[data-hjm-suite-upload]');
    if (suiteUpload) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      var uploadType = suiteUpload.getAttribute('data-hjm-suite-upload');
      var panelForUpload = getPanel();
      var input = panelForUpload && panelForUpload.querySelector('[data-hjm-suite-file="' + uploadType + '"]');
      if (input) input.click();
      return;
    }
    var actionTarget = event.target && event.target.closest && event.target.closest('[data-hjm-prompt-flow-action]');
    if (actionTarget) {
      handleAction(event, actionTarget);
      return;
    }

    var send = event.target && event.target.closest && event.target.closest('.canvas-chat-panel .canvas-chat-send-btn.send-button');
    if (!send) return;
    var panel = getPanel();
    if (shouldHandle(panel)) {
      handleSubmit(event);
      return;
    }
    if (isSuiteMode(panel)) {
      handleSuiteSubmit(event);
    }
  }

  function handleKeydown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    var input = event.target && event.target.closest && event.target.closest('.canvas-chat-panel .composer-input');
    if (!input) return;
    var panel = getPanel();
    if (shouldHandle(panel)) {
      handleSubmit(event);
      return;
    }
    if (isSuiteMode(panel)) {
      handleSuiteSubmit(event);
    }
  }

  function handleChange(event) {
    var target = event.target;
    if (!target || !target.matches) return;
    if (target.matches('[data-hjm-suite-file]')) {
      readSuiteFiles(target);
      return;
    }
    if (target.matches('[data-hjm-suite-skill]')) {
      state.suite.selectedSkillId = target.value || '';
      suiteStatus('');
    }
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
    if (isSuiteMode(panel)) {
      if (existing) existing.remove();
      ensureSuiteConfig(panel);
      renderSuiteComposer(panel);
      return;
    }
    removeSuiteComposer(panel);
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
      isSuiteMode: function () { return isSuiteMode(getPanel()); },
      collectReferences: function () { return collectReferences(getPanel()); },
      readDialogSettings: function () { return readDialogSettings(getPanel()); },
      readSuiteSettings: function () { return readSuiteSettings(getPanel()); },
      state: state
    };
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeydown, true);
    document.addEventListener('change', handleChange, true);
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
