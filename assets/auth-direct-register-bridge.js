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

  function message(text) {
    var now = Date.now();
    if (text === lastMessageText && now - lastMessageAt < 1800) {
      return;
    }
    lastMessageText = text;
    lastMessageAt = now;
    if (window.$message && typeof window.$message.warning === 'function') {
      if (activeMessage && typeof activeMessage.destroy === 'function') {
        activeMessage.destroy();
      }
      activeMessage = window.$message.warning(text, { duration: 2200 });
      return;
    }
    window.alert(text);
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
