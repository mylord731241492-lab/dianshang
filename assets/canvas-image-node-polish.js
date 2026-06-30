(function () {
  var SELECTOR = '.vue-flow__node-image .image-node img';
  var scanTimer = null;

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

  function markAll(root) {
    var scope = root && root.querySelectorAll ? root : document;
    if (scope.matches && scope.matches(SELECTOR)) markImage(scope);
    if (scope.querySelectorAll) scope.querySelectorAll(SELECTOR).forEach(markImage);
  }

  function scheduleMarkAll(root) {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(function () {
      scanTimer = null;
      markAll(root || document);
    }, 80);
  }

  function install() {
    markAll(document);
    document.addEventListener('load', function (event) {
      if (event.target && event.target.matches && event.target.matches(SELECTOR)) {
        markImage(event.target);
      }
    }, true);

    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var nodes = mutations[i].addedNodes || [];
        for (var j = 0; j < nodes.length; j += 1) {
          if (nodes[j] && nodes[j].nodeType === 1) scheduleMarkAll(nodes[j]);
        }
        if (mutations[i].type === 'attributes' && mutations[i].target) {
          var target = mutations[i].target;
          var scope = target.closest && target.closest('.vue-flow__node-image');
          scheduleMarkAll(scope || target);
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    window.__hjmCanvasImageNodePolish = {
      classify: classify,
      markAll: markAll,
      markImage: markImage
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
