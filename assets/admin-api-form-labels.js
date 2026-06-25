(function () {
  var fields = [
    { label: '后端真实名称', hint: '内部识别名，例如 6789 / new-api-main。', required: true },
    { label: '前端展示名称', hint: '给用户和后台表格看的名称。', required: true },
    { label: '线路标识 code', hint: '唯一标识，建议英文、数字、短横线。', required: true },
    { label: '渠道类型', hint: '图片渠道、文字渠道或视频渠道。' },
    { label: '接口格式', hint: 'New-API 通常选 OpenAI 兼容。' },
    { label: 'Base URL', hint: '填写 New-API 地址，例如 https://xxx.com/v1。', required: true, wide: true },
    { label: 'API Key', hint: '编辑时留空表示不修改；不要把真实 key 提交到 Git。', wide: true },
    { label: '聊天接口', hint: 'OpenAI 兼容默认 /v1/chat/completions。' },
    { label: '生图接口', hint: 'OpenAI 兼容默认 /v1/images/generations。' },
    { label: '视频接口', hint: '没有视频模型可以先保持默认。' },
    { label: '默认聊天模型', hint: '先填一个文本模型用于测试连接。' },
    { label: '默认生图模型', hint: '后续测试模板生图时再填写。' },
    { label: '默认视频模型', hint: '没有视频模型可以留空。' },
    { label: '优先级', hint: '数字越大越靠前。' },
    { label: '线路倍率', hint: '成本倍率，内测先保持 1。' },
    { label: '状态', hint: '启用后才会参与线路选择。' },
    { label: '默认线路', hint: '勾选后作为当前分组默认线路。' },
    { label: '备注', hint: '记录用途、来源或负责人。', wide: true }
  ];

  function textOf(node) {
    return (node && node.textContent || '').trim();
  }

  function isApiProviderDialog(card) {
    var title = textOf(card.querySelector('.n-card-header__main'));
    return title.indexOf('API 线路') !== -1;
  }

  function findFormGrid(card) {
    var grids = Array.prototype.slice.call(card.querySelectorAll('.n-card-content > div, .n-card-content div'));
    return grids.find(function (grid) {
      if (!grid.className || String(grid.className).indexOf('grid') === -1) return false;
      return !!grid.querySelector('input[placeholder="Base URL"]') &&
        !!grid.querySelector('input[placeholder*="API Key"]');
    });
  }

  function makeLabel(field) {
    var label = document.createElement('div');
    label.className = 'admin-api-field-label';
    label.textContent = field.label + (field.required ? ' *' : '');
    return label;
  }

  function makeHint(field) {
    var hint = document.createElement('div');
    hint.className = 'admin-api-field-hint';
    hint.textContent = field.hint || '';
    return hint;
  }

  function enhanceGrid(grid) {
    if (!grid || grid.dataset.apiLabelsEnhanced === 'true') return;
    var controls = Array.prototype.slice.call(grid.children).filter(function (child) {
      return child && child.querySelector && child.querySelector('input, textarea, select') ||
        child && /^(INPUT|TEXTAREA|SELECT)$/.test(child.tagName || '');
    });
    if (controls.length < 8) return;

    controls.forEach(function (child, index) {
      if (child.classList && child.classList.contains('admin-api-field-wrap')) return;
      var field = fields[index] || { label: '字段 ' + (index + 1), hint: '' };
      var wrap = document.createElement('div');
      wrap.className = 'admin-api-field-wrap' + (field.wide ? ' admin-api-field-wide' : '');
      child.parentNode.insertBefore(wrap, child);
      wrap.appendChild(makeLabel(field));
      wrap.appendChild(child);
      if (field.hint) wrap.appendChild(makeHint(field));
    });
    grid.dataset.apiLabelsEnhanced = 'true';
  }

  function enhanceDialogs() {
    Array.prototype.slice.call(document.querySelectorAll('.n-card')).forEach(function (card) {
      if (!isApiProviderDialog(card)) return;
      enhanceGrid(findFormGrid(card));
    });
  }

  var observer = new MutationObserver(function () {
    enhanceDialogs();
  });

  function start() {
    enhanceDialogs();
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
