(function() {
  var hiddenAttr = 'data-hjm-direct-register-hidden';
  var lastMessageText = '';
  var lastMessageAt = 0;
  var activeMessage = null;

  function visibleText(root) {
    return (root && root.textContent ? root.textContent : '').replace(/\s+/g, '');
  }

  function nearestField(input) {
    return input.closest('label') ||
      input.closest('.n-form-item') ||
      input.closest('.form-item') ||
      input.parentElement;
  }

  function isRegisterCodeInput(input) {
    if (!isCodeLikeInput(input)) return false;
    var form = input.closest('form') || input.closest('.n-modal, .modal, .auth-card, .login-card, section, main');
    if (!form) return false;
    var text = visibleText(form);
    var hasEmail = !!form.querySelector('input[autocomplete="email"], input[type="email"], input[placeholder*="邮箱"]');
    var hasUsername = !!form.querySelector('input[autocomplete="username"], input[placeholder*="用户名"], input[name*="username"]');
    var isReset = text.indexOf('找回') !== -1 || text.indexOf('重置') !== -1 || text.indexOf('新密码') !== -1;
    return !isReset && hasEmail && (hasUsername || text.indexOf('注册') !== -1);
  }

  function isCodeLikeInput(input) {
    if (!input || input.tagName !== 'INPUT') return false;
    var type = String(input.getAttribute('type') || '').toLowerCase();
    var autocomplete = String(input.getAttribute('autocomplete') || '').toLowerCase();
    if (type === 'email' || autocomplete === 'email') return false;
    return autocomplete === 'one-time-code' ||
      input.getAttribute('inputmode') === 'numeric' ||
      input.getAttribute('maxlength') === '6';
  }

  function findCodeInput(root) {
    if (!root) return null;
    var inputs = root.querySelectorAll('input');
    return Array.prototype.find.call(inputs, isCodeLikeInput) || null;
  }

  function hideRegisterCodeField(input) {
    if (!input || input.getAttribute(hiddenAttr) === '1' || !isRegisterCodeInput(input)) return;
    input.required = false;
    input.value = '';
    input.disabled = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.setAttribute(hiddenAttr, '1');

    var field = nearestField(input);
    if (field) {
      field.style.display = 'none';
      field.setAttribute(hiddenAttr, '1');
    }
    addDirectRegisterHint(input.closest('form') || input.closest('.n-modal, .modal, .auth-card, .login-card, section, main'));
  }

  function normalizeRegisterEmailField(form) {
    if (!form) return;
    var email = form.querySelector('input[autocomplete="email"], input[type="email"], input[placeholder*="邮箱"]');
    if (!email) return;
    email.setAttribute('placeholder', '请输入邮箱（用于找回密码）');
    email.setAttribute('autocomplete', 'email');
    email.required = true;
  }

  function addDirectRegisterHint(form) {
    if (!form || form.querySelector('[data-hjm-direct-register-hint="1"]')) return;
    var submit = Array.prototype.find.call(form.querySelectorAll('button'), function(button) {
      return visibleText(button).indexOf('注册') !== -1 || /register/i.test(visibleText(button));
    });
    var hint = document.createElement('div');
    hint.setAttribute('data-hjm-direct-register-hint', '1');
    hint.style.cssText = 'margin-top:8px;border:1px solid #bbf7d0;background:#f0fdf4;color:#15803d;border-radius:14px;padding:9px 12px;font-size:12px;font-weight:700;line-height:1.5;';
    hint.textContent = '当前内网注册不需要验证码；邮箱仍是必填，用于找回密码和识别账号。';
    if (submit && submit.parentElement) {
      submit.parentElement.insertBefore(hint, submit);
    } else {
      form.appendChild(hint);
    }
  }

  function notify(level, text) {
    var now = Date.now();
    if (text === lastMessageText && now - lastMessageAt < 1800) {
      return;
    }
    lastMessageText = text;
    lastMessageAt = now;
    if (window.$message && typeof window.$message[level] === 'function') {
      if (activeMessage && typeof activeMessage.destroy === 'function') {
        activeMessage.destroy();
      }
      activeMessage = window.$message[level](text, { duration: 2200 });
      return;
    }
    window.alert(text);
  }

  function message(text) {
    notify('warning', text);
  }

  function resetPasswordInputs(form) {
    var passwords = form.querySelectorAll('input[autocomplete="new-password"]');
    if (passwords.length < 2) {
      passwords = form.querySelectorAll('input[type="password"]');
    }
    return passwords;
  }

  function isDirectResetForm(form) {
    if (!form) return false;
    var username = form.querySelector('input[autocomplete="username"], input[placeholder*="用户名"], input[name*="username"]');
    return !!username && resetPasswordInputs(form).length >= 2;
  }

  function hideDirectResetField(input) {
    if (!input || input.getAttribute('data-hjm-direct-reset-hidden') === '1') return;
    input.required = false;
    input.value = '';
    input.disabled = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.setAttribute('data-hjm-direct-reset-hidden', '1');
    var field = nearestField(input);
    if (field) {
      field.style.display = 'none';
      field.setAttribute('data-hjm-direct-reset-hidden', '1');
    }
  }

  function addDirectResetHint(form) {
    if (form.querySelector('[data-hjm-direct-reset-hint="1"]')) return;
    var submit = form.querySelector('button[type="submit"]');
    var hint = document.createElement('div');
    hint.setAttribute('data-hjm-direct-reset-hint', '1');
    hint.style.cssText = 'margin-top:8px;border:1px solid #fed7aa;background:#fff7ed;color:#c2410c;border-radius:14px;padding:9px 12px;font-size:12px;font-weight:700;line-height:1.5;';
    hint.textContent = '当前内网支持普通用户凭用户名直接重置；管理员账号不支持此入口。';
    if (submit && submit.parentElement) {
      submit.parentElement.insertBefore(hint, submit);
    } else {
      form.appendChild(hint);
    }
  }

  function updateDirectResetCopy(form, username) {
    username.required = true;
    username.setAttribute('placeholder', '请输入用户名');
    username.setAttribute('autocomplete', 'username');
    var usernameField = nearestField(username);
    var usernameLabel = usernameField && usernameField.querySelector('span');
    if (usernameLabel) usernameLabel.textContent = '用户名 (USERNAME)';

    var container = form.parentElement;
    while (container && container !== document.body && !container.querySelector('h2')) {
      container = container.parentElement;
    }
    var title = container && container.querySelector('h2');
    var subtitle = title && title.parentElement ? title.parentElement.querySelector('p') : null;
    if (subtitle) subtitle.textContent = '输入用户名，直接设置新密码';
  }

  function installDirectReset(form) {
    if (!isDirectResetForm(form) || form.getAttribute('data-hjm-direct-reset-form') === '1') return;
    form.setAttribute('data-hjm-direct-reset-form', '1');
    var username = form.querySelector('input[autocomplete="username"], input[placeholder*="用户名"], input[name*="username"]');
    var email = form.querySelector('input[autocomplete="email"], input[type="email"], input[placeholder*="邮箱"]');
    var code = findCodeInput(form);
    updateDirectResetCopy(form, username);
    hideDirectResetField(email);
    hideDirectResetField(code);
    addDirectResetHint(form);

    form.addEventListener('submit', async function(event) {
      if (!isDirectResetForm(form)) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      if (form.getAttribute('data-hjm-direct-reset-busy') === '1') return;

      var passwords = resetPasswordInputs(form);
      var account = String(username.value || '').trim();
      var newPassword = passwords[0] ? passwords[0].value : '';
      var confirmPassword = passwords[1] ? passwords[1].value : '';
      if (!account) {
        message('请输入用户名');
        username.focus();
        return;
      }
      if (newPassword.length < 6) {
        message('新密码至少需要 6 位');
        if (passwords[0]) passwords[0].focus();
        return;
      }
      if (newPassword !== confirmPassword) {
        message('两次输入的新密码不一致');
        if (passwords[1]) passwords[1].focus();
        return;
      }

      var submit = form.querySelector('button[type="submit"]');
      var wasDisabled = submit ? submit.disabled : false;
      form.setAttribute('data-hjm-direct-reset-busy', '1');
      if (submit) submit.disabled = true;
      try {
        var response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: account, newPassword: newPassword })
        });
        var result = {};
        try {
          result = await response.json();
        } catch (_) {}
        if (!response.ok) {
          throw new Error(result.message || '重置密码失败');
        }
        notify('success', result.message || '密码已重置，请使用新密码登录');
        var backButton = Array.prototype.find.call(form.querySelectorAll('button'), function(button) {
          return /返回登录|back\s*to\s*login/i.test(visibleText(button));
        });
        if (backButton) {
          backButton.click();
        } else {
          window.location.href = '/login';
        }
      } catch (error) {
        notify('error', error && error.message ? error.message : '重置密码失败');
      } finally {
        form.removeAttribute('data-hjm-direct-reset-busy');
        if (submit && submit.isConnected) submit.disabled = wasDisabled;
      }
    }, true);
  }

  function installRegisterSubmitGuard(form) {
    if (!form || form.getAttribute('data-hjm-direct-register-submit-guard') === '1') return;
    if (!isRegisterCodeInput(findCodeInput(form))) return;
    form.setAttribute('data-hjm-direct-register-submit-guard', '1');
    normalizeRegisterEmailField(form);
    form.addEventListener('submit', function(event) {
      var username = form.querySelector('input[autocomplete="username"], input[placeholder*="用户名"], input[name*="username"]');
      var email = form.querySelector('input[autocomplete="email"], input[type="email"], input[placeholder*="邮箱"]');
      var password = form.querySelector('input[type="password"]');
      var missingUsername = !username || !username.value.trim();
      var missingEmail = !email || !email.value.trim();
      var missingPassword = !password || !password.value;
      var missing = missingUsername || missingEmail || missingPassword;
      if (!missing) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') {
        event.stopImmediatePropagation();
      }
      message(missingEmail ? '请填写邮箱；当前注册不需要验证码，但邮箱用于找回密码。' : '请填写用户名和密码');
      (missingUsername ? username : missingEmail ? email : password).focus();
    }, true);
  }

  function scan() {
    var inputs = document.querySelectorAll('input');
    Array.prototype.forEach.call(inputs, hideRegisterCodeField);
    Array.prototype.forEach.call(document.querySelectorAll('form'), function(form) {
      normalizeRegisterEmailField(form);
      installRegisterSubmitGuard(form);
      installDirectReset(form);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan, { once: true });
  } else {
    scan();
  }

  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
