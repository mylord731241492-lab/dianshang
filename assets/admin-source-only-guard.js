(function () {
  var ADMIN_PREFIX = '/admin';

  function isAdminPath(pathname) {
    return pathname === ADMIN_PREFIX || pathname.indexOf(ADMIN_PREFIX + '/') === 0;
  }

  function parseUrl(value) {
    try {
      return new URL(value, window.location.href);
    } catch (error) {
      return null;
    }
  }

  function openSourceAdmin(value, replace) {
    var url = parseUrl(value || window.location.href);
    if (!url || !isAdminPath(url.pathname)) {
      return false;
    }
    var target = url.pathname + url.search + url.hash;
    if (replace) {
      window.location.replace(target);
    } else {
      window.location.assign(target);
    }
    return true;
  }

  if (isAdminPath(window.location.pathname)) {
    openSourceAdmin(window.location.href, true);
    return;
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!target) {
      return;
    }
    var href = target.getAttribute('href');
    var url = parseUrl(href);
    if (!url || url.origin !== window.location.origin || !isAdminPath(url.pathname)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    openSourceAdmin(url.href, false);
  }, true);

  ['pushState', 'replaceState'].forEach(function (method) {
    var original = history[method];
    history[method] = function (state, title, url) {
      if (url && openSourceAdmin(url, method === 'replaceState')) {
        return;
      }
      return original.apply(this, arguments);
    };
  });

  window.addEventListener('popstate', function () {
    if (isAdminPath(window.location.pathname)) {
      openSourceAdmin(window.location.href, true);
    }
  });
})();
