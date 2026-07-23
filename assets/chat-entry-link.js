(function installChatEntryLink() {
  if (window.__hjmChatEntryLink) {
    window.__hjmChatEntryLink.sync();
    return;
  }

  var observer = null;
  var observerTimer = null;
  var originalPushState = history.pushState;
  var originalReplaceState = history.replaceState;
  var chatRedirectKey = 'hjm-chat-login-redirect';

  function isHomeRoute() {
    return window.location.pathname === '/';
  }

  function normalizeChatRedirect(value) {
    if (typeof value !== 'string') return '';
    if (value === '/chat') return '/chat/';
    return value.indexOf('/chat/') === 0 ? value : '';
  }

  function captureChatRedirect() {
    if (window.location.pathname !== '/login' && window.location.pathname !== '/register') return;
    var redirect = normalizeChatRedirect(new URLSearchParams(window.location.search).get('redirect'));
    if (!redirect) return;
    try {
      window.sessionStorage.setItem(chatRedirectKey, redirect);
    } catch (_) {}
  }

  function followChatRedirect() {
    var redirect = '';
    var token = '';
    try {
      redirect = normalizeChatRedirect(window.sessionStorage.getItem(chatRedirectKey));
      token = window.localStorage.getItem('auth_token') || window.localStorage.getItem('admin_auth_token') || '';
    } catch (_) {
      return false;
    }
    if (!redirect || !token) return false;
    window.sessionStorage.removeItem(chatRedirectKey);
    window.location.replace(redirect);
    return true;
  }

  function loadChatAvailability() {
    return fetch('/api/chat/status', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' }
    }).then(function(response) {
      if (!response.ok) return { accessReady: false };
      return response.json();
    }).then(function(availability) {
      return availability && typeof availability === 'object'
        ? availability
        : { accessReady: false };
    }).catch(function() {
      return { accessReady: false };
    });
  }

  function stopObserver() {
    if (observer) observer.disconnect();
    observer = null;
    if (observerTimer) window.clearTimeout(observerTimer);
    observerTimer = null;
  }

  function removeEntry() {
    var entry = document.querySelector('[data-hjm-chat-entry="true"]');
    if (entry) entry.remove();
  }

  function addScopeAttribute(node, scopeName) {
    if (!node || !scopeName) return;
    node.setAttribute(scopeName, '');
    Array.prototype.forEach.call(node.querySelectorAll('*'), function(child) {
      child.setAttribute(scopeName, '');
    });
  }

  function insertEntry() {
    if (!isHomeRoute()) {
      removeEntry();
      stopObserver();
      return true;
    }
    if (document.querySelector('[data-hjm-chat-entry="true"]')) {
      stopObserver();
      return true;
    }
    var nav = document.querySelector('[aria-label="Home navigation"]');
    if (!nav) return false;
    var template = nav.querySelector('button[title="图库"]') || nav.querySelector('button.side-item');
    if (!template) return false;

    var entry = template.cloneNode(true);
    var scopeName = Array.prototype.find.call(template.attributes, function(attribute) {
      return attribute.name.indexOf('data-v-') === 0;
    });
    scopeName = scopeName ? scopeName.name : '';
    entry.setAttribute('data-hjm-chat-entry', 'true');
    entry.setAttribute('title', 'AI 对话');
    entry.setAttribute('aria-label', 'AI 对话');
    entry.classList.remove('active');

    var icon = entry.querySelector('i');
    if (icon) {
      icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path><path d="M8 9h8"></path><path d="M8 13h5"></path></svg>';
      addScopeAttribute(icon, scopeName);
    }
    var label = entry.querySelector('span');
    if (label) label.textContent = 'AI 对话';
    entry.addEventListener('click', function() {
      window.location.assign('/chat/');
    });

    var divider = nav.querySelector('.side-divider');
    nav.insertBefore(entry, divider || null);
    stopObserver();
    return true;
  }

  function watchHome() {
    stopObserver();
    if (insertEntry() || !isHomeRoute()) return;
    observer = new MutationObserver(function() {
      insertEntry();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    observerTimer = window.setTimeout(stopObserver, 5000);
  }

  function sync() {
    captureChatRedirect();
    loadChatAvailability().then(function(availability) {
      if (!availability.accessReady) {
        removeEntry();
        stopObserver();
        return;
      }
      if (followChatRedirect()) return;
      window.requestAnimationFrame(watchHome);
    });
  }

  history.pushState = function() {
    var result = originalPushState.apply(this, arguments);
    sync();
    return result;
  };
  history.replaceState = function() {
    var result = originalReplaceState.apply(this, arguments);
    sync();
    return result;
  };
  window.addEventListener('popstate', sync);

  window.__hjmChatEntryLink = {
    sync: sync,
    teardown: function() {
      stopObserver();
      removeEntry();
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      window.removeEventListener('popstate', sync);
      delete window.__hjmChatEntryLink;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sync, { once: true });
  } else {
    sync();
  }
})();
