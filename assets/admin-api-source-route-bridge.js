(function() {
  var SOURCE_ROUTES = [
    '/admin/login',
    '/admin/dashboard',
    '/admin/users',
    '/admin/recycle-bin',
    '/admin/generate-tasks',
    '/admin/logs',
    '/admin/orders',
    '/admin/redeem-codes',
    '/admin/model-prices',
    '/admin/api-providers',
    '/admin/template-workflows',
    '/admin/settings'
  ];
  var SOURCE_ROUTE_BY_TEXT = {
    '控制台 Dashboard': '/admin/dashboard',
    '用户管理': '/admin/users',
    '回收站': '/admin/recycle-bin',
    '任务监控': '/admin/generate-tasks',
    '消费日志': '/admin/logs',
    '订单管理': '/admin/orders',
    '兑换码管理': '/admin/redeem-codes',
    'API 线路': '/admin/api-providers',
    'API 线路管理': '/admin/api-providers',
    '模型价格': '/admin/model-prices',
    '模板工作流': '/admin/template-workflows',
    '系统设置': '/admin/settings'
  };
  var OLD_APP_MARKER = '/assets/index-DglIsp_g.js';
  var clickedAt = 0;

  function isSourceRoute(pathname) {
    return SOURCE_ROUTES.indexOf(pathname) !== -1;
  }

  function isOldRootApp() {
    return Array.prototype.some.call(document.scripts || [], function(script) {
      return script.src && script.src.indexOf(OLD_APP_MARKER) !== -1;
    });
  }

  function hasSourceShell() {
    return !!document.querySelector('.admin-source-shell');
  }

  function openSourceRoute(route) {
    if (Date.now() - clickedAt < 500) {
      return;
    }
    clickedAt = Date.now();
    window.location.assign(route);
  }

  function routeToSourceIfNeeded() {
    if (isSourceRoute(window.location.pathname) && isOldRootApp() && !hasSourceShell()) {
      window.location.replace(window.location.pathname);
    }
  }

  document.addEventListener('click', function(event) {
    var target = event.target && event.target.closest
      ? event.target.closest('a,button,[role="button"],[data-route],[data-path]')
      : null;
    if (!target) {
      return;
    }

    var href = target.getAttribute('href') || target.getAttribute('data-route') || target.getAttribute('data-path') || '';
    var text = (target.textContent || '').replace(/\s+/g, ' ').trim();
    var route = isSourceRoute(href) ? href : SOURCE_ROUTE_BY_TEXT[text];
    if (route) {
      event.preventDefault();
      event.stopPropagation();
      openSourceRoute(route);
    }
  }, true);

  var lastPath = window.location.pathname;
  function watchRoute() {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      routeToSourceIfNeeded();
    } else if (isSourceRoute(lastPath)) {
      routeToSourceIfNeeded();
    }
  }

  routeToSourceIfNeeded();
  window.addEventListener('popstate', routeToSourceIfNeeded);
  window.setInterval(watchRoute, 250);
})();
