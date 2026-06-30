(function () {
  var FLOW_VERSION = '20260630prompt2';
  var state = {
    busy: false,
    drafts: {},
    lastError: ''
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

  function uuid(prefix) {
    return (prefix || 'flow') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
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

  function makeUserCard(requirement, references) {
    var images = references.map(function (ref) {
      return '<figure><img src="' + escapeHtml(ref.preview || ref.dataUrl || ref.url) + '" alt=""><figcaption>图' + ref.index + '</figcaption></figure>';
    }).join('');
    var card = document.createElement('article');
    card.className = 'message-card user hjm-prompt-flow-user';
    card.innerHTML = [
      '<div class="hjm-prompt-flow-head"><span>你</span><time>' + nowText() + '</time></div>',
      '<p>' + escapeHtml(requirement) + '</p>',
      references.length ? '<div class="hjm-prompt-flow-images">' + images + '</div>' : ''
    ].join('');
    return card;
  }

  function makeDraftCard(flowId, requirement, references) {
    var card = document.createElement('article');
    card.className = 'message-card assistant hjm-prompt-flow-draft is-loading';
    card.dataset.flowId = flowId;
    card.innerHTML = [
      '<div class="hjm-prompt-flow-head"><span>提示词草稿</span><time>' + nowText() + '</time></div>',
      '<div class="hjm-prompt-flow-note">按图片顺序生成提示词，确认后才会调用图片模型。</div>',
      '<textarea class="hjm-prompt-flow-textarea" spellcheck="false" placeholder="正在生成可编辑提示词..."></textarea>',
      '<div class="hjm-prompt-flow-status">正在生成提示词...</div>',
      '<div class="hjm-prompt-flow-actions">',
      '<button type="button" data-hjm-prompt-flow-action="confirm" disabled>确认生图</button>',
      '<button type="button" data-hjm-prompt-flow-action="regen" disabled>重新生成提示词</button>',
      '<button type="button" data-hjm-prompt-flow-action="cancel">取消</button>',
      '</div>'
    ].join('');
    state.drafts[flowId] = { flowId: flowId, requirement: requirement, references: references, card: card };
    return card;
  }

  function updateDraft(flowId, patch) {
    var draft = state.drafts[flowId];
    if (!draft || !draft.card) return;
    Object.assign(draft, patch || {});
    var card = draft.card;
    var textarea = card.querySelector('.hjm-prompt-flow-textarea');
    var status = card.querySelector('.hjm-prompt-flow-status');
    var buttons = card.querySelectorAll('[data-hjm-prompt-flow-action]');
    if (patch && patch.prompt !== undefined && textarea) textarea.value = patch.prompt || '';
    if (status && patch && patch.status) status.textContent = patch.status;
    if (patch && patch.loading !== undefined) {
      card.classList.toggle('is-loading', !!patch.loading);
      buttons.forEach(function (button) {
        var action = button.getAttribute('data-hjm-prompt-flow-action');
        button.disabled = !!patch.loading || (action !== 'cancel' && !(textarea && textarea.value.trim()));
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

  async function generatePrompt(flowId) {
    var draft = state.drafts[flowId];
    if (!draft) return;
    updateDraft(flowId, { loading: true, status: '正在生成提示词...' });
    try {
      var data = await postJson('/api/canvas/generate-prompt', {
        requirement: draft.requirement,
        imageCount: draft.references.length,
        source: 'canvas-chat-prompt-flow'
      });
      var status = data.fallback && data.providerError
        ? '文本模型暂不可用，已生成基础提示词，可直接编辑后确认。'
        : '提示词已生成，可编辑后确认生图。';
      updateDraft(flowId, { prompt: data.prompt || data.draftPrompt || '', loading: false, status: status, provider: data.provider });
    } catch (error) {
      var fallback = [
        draft.references.length ? '参考图顺序：' + draft.references.map(function (ref) { return '图' + ref.index; }).join('、') + '。' : '无参考图。',
        '用户需求：' + draft.requirement,
        '请生成一张高质量电商产品图，商品主体清晰，保持参考图中的产品包装、品牌文字、颜色和结构，按用户要求调整背景、构图、光影和风格，画面真实自然，避免乱码、水印、畸形产品和虚构促销信息。'
      ].join('\n');
      updateDraft(flowId, { prompt: fallback, loading: false, status: error.message || '提示词生成失败，已给出基础草稿。' });
    }
  }

  function normalizeGeneratedImages(data) {
    var images = data.resultImages || data.images || data.results || [];
    return (Array.isArray(images) ? images : []).map(function (item) {
      var raw = item && typeof item === 'object' ? item : { url: item };
      return raw.url || raw.imageUrl || raw.preview || raw.originalUrl || '';
    }).filter(Boolean);
  }

  async function confirmGenerate(flowId) {
    var draft = state.drafts[flowId];
    if (!draft || !draft.card) return;
    var textarea = draft.card.querySelector('.hjm-prompt-flow-textarea');
    var prompt = textarea ? textarea.value.trim() : '';
    if (!prompt) {
      updateDraft(flowId, { loading: false, status: '请先填写提示词。' });
      return;
    }
    updateDraft(flowId, { loading: true, status: '正在调用 GPT Image 2 生图...' });
    try {
      var data = await postJson('/api/generate/tasks', {
        prompt: prompt,
        selectedPrompt: prompt,
        model: 'gpt-image-2',
        modelKey: 'gpt-image-2',
        imageModel: 'gpt-image-2',
        imageModelKey: 'gpt-image-2',
        routeId: 'pub_route_openai_gpt_image_2',
        lineId: 'pub_route_openai_gpt_image_2',
        routeKey: 'route_openai_gpt_image_2',
        lineKey: 'route_openai_gpt_image_2',
        size: '1:1',
        ratio: '1:1',
        quality: 'auto',
        clarity: '1k',
        imageCount: 1,
        n: 1,
        referenceImages: draft.references.map(function (ref) {
          return {
            dataUrl: ref.dataUrl || '',
            url: ref.dataUrl || ref.url || '',
            fileName: ref.fileName,
            mimeType: ref.mimeType || ''
          };
        }),
        source: 'canvas-chat-prompt-flow'
      });
      var imageUrls = normalizeGeneratedImages(data);
      renderGenerated(flowId, imageUrls, data);
    } catch (error) {
      updateDraft(flowId, { loading: false, status: error.message || '确认生图失败' });
    }
  }

  function renderGenerated(flowId, imageUrls, data) {
    var draft = state.drafts[flowId];
    if (!draft || !draft.card) return;
    var html = imageUrls.map(function (url, index) {
      return '<figure><img src="' + escapeHtml(url) + '" alt=""><figcaption>结果 ' + (index + 1) + '</figcaption></figure>';
    }).join('');
    draft.card.classList.remove('is-loading');
    draft.card.classList.add('is-generated');
    var status = draft.card.querySelector('.hjm-prompt-flow-status');
    if (status) {
      status.textContent = imageUrls.length
        ? '图片生成完成，已返回 ' + imageUrls.length + ' 张结果。'
        : '图片生成完成，但未读取到结果图。';
    }
    var actions = draft.card.querySelector('.hjm-prompt-flow-actions');
    if (actions) {
      actions.innerHTML = '<button type="button" data-hjm-prompt-flow-action="copy">复制提示词</button>';
    }
    if (html && !draft.card.querySelector('.hjm-prompt-flow-results')) {
      var results = document.createElement('div');
      results.className = 'hjm-prompt-flow-results';
      results.innerHTML = html;
      var statusNode = draft.card.querySelector('.hjm-prompt-flow-status');
      draft.card.insertBefore(results, statusNode || actions);
    }
    draft.result = data;
    scrollToBottom(getMessageList(getPanel()));
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
    if (!requirement && !references.length) {
      state.busy = false;
      return;
    }

    try {
      var list = getMessageList(panel);
      if (!list) return;
      var flowId = uuid('prompt_flow');
      list.appendChild(makeUserCard(requirement, references));
      var draftCard = makeDraftCard(flowId, requirement, references);
      list.appendChild(draftCard);
      if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      scrollToBottom(list);
      await generatePrompt(flowId);
      scrollToBottom(list);
    } finally {
      state.busy = false;
    }
  }

  function scrollToBottom(list) {
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }

  function handleClick(event) {
    var actionTarget = event.target && event.target.closest && event.target.closest('[data-hjm-prompt-flow-action]');
    if (actionTarget) {
      var card = actionTarget.closest('.hjm-prompt-flow-draft');
      var flowId = card && card.dataset.flowId;
      var action = actionTarget.getAttribute('data-hjm-prompt-flow-action');
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (action === 'confirm') confirmGenerate(flowId);
      if (action === 'regen') generatePrompt(flowId);
      if (action === 'cancel' && card) {
        delete state.drafts[flowId];
        card.remove();
      }
      if (action === 'copy') {
        var textarea = card && card.querySelector('.hjm-prompt-flow-textarea');
        var text = textarea ? textarea.value : '';
        if (text && navigator.clipboard) navigator.clipboard.writeText(text).catch(function () {});
      }
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
    if (!panel || panel.querySelector('.hjm-prompt-flow-hint')) return;
    var composer = panel.querySelector('.composer');
    if (!composer) return;
    var hint = document.createElement('div');
    hint.className = 'hjm-prompt-flow-hint';
    hint.textContent = '对话模式：先生成可编辑提示词，确认后调用 GPT Image 2 生图。';
    composer.insertBefore(hint, composer.firstChild);
  }

  function install() {
    if (!isCanvasPage()) return;
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
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.__hjmCanvasChatPromptFlow = {
      version: FLOW_VERSION,
      getPanel: getPanel,
      getActiveMode: function () { return getActiveMode(getPanel()); },
      shouldHandle: function () { return shouldHandle(getPanel()); },
      collectReferences: function () { return collectReferences(getPanel()); },
      state: state
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
