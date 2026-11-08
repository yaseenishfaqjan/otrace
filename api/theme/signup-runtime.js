/**
 * First-order popup.
 *
 * The discount code is not in this file. The server sends it after a real
 * signup. Closing the dialog suppresses it for 14 days. A completed signup
 * suppresses it from then on. Cart, order success, and checkout never get
 * this script, because the server omits the markup there.
 */
(function () {
  var host = document.getElementById('otrace-signup');
  if (!host || host.getAttribute('data-ready') === '1') return;
  host.setAttribute('data-ready', '1');

  var KEY = 'otrace-signup';
  var COOKIE = 'otrace_signup';
  var DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
  var SIGNED_DAYS = 3650;
  var DELAY_MS = 8000;
  var sheet = host.querySelector('.otrace-signup__sheet');
  var formView = host.querySelector('[data-signup-form]');
  var doneView = host.querySelector('[data-signup-done]');
  var form = host.querySelector('form');
  var errorEl = host.querySelector('[data-signup-error]');
  var codeEl = host.querySelector('[data-signup-code]');
  var copyBtn = host.querySelector('[data-signup-copy]');
  var emailInput = host.querySelector('#otrace-signup-email');
  var opened = false;
  var locked = false;
  var waiting = false;
  var lastFocus = null;

  function readState() {
    var raw = '';
    try { raw = window.localStorage.getItem(KEY) || ''; } catch (err) { raw = ''; }
    if (!raw) {
      var match = document.cookie.match(/(?:^|; )otrace_signup=([^;]*)/);
      if (match) {
        try { raw = decodeURIComponent(match[1]); } catch (err) { raw = ''; }
      }
    }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (err) { return null; }
  }

  function writeState(state, days) {
    var raw = JSON.stringify(state);
    try { window.localStorage.setItem(KEY, raw); } catch (err) { /* private mode still has the cookie */ }
    document.cookie = COOKIE + '=' + encodeURIComponent(raw)
      + '; Max-Age=' + String(Math.round(days * 24 * 60 * 60))
      + '; Path=/; SameSite=Lax';
  }

  function suppressed() {
    var state = readState();
    if (!state) return false;
    if (state.signed) return true;
    return typeof state.until === 'number' && Date.now() < state.until;
  }

  function lockPage() {
    if (locked) return;
    locked = true;
    if (typeof window.otraceLockPage === 'function') {
      window.otraceLockPage();
      return;
    }
    window.__otraceSignupScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    document.documentElement.classList.add('otrace-modal-lock');
    document.documentElement.setAttribute('scroll-lock', '');
    var body = document.body;
    body.style.position = 'fixed';
    body.style.top = (-window.__otraceSignupScrollY) + 'px';
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
  }

  function unlockPage() {
    if (!locked) return;
    locked = false;
    if (typeof window.otraceUnlockPage === 'function') {
      window.otraceUnlockPage();
      return;
    }
    document.documentElement.classList.remove('otrace-modal-lock');
    document.documentElement.removeAttribute('scroll-lock');
    var body = document.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    window.scrollTo(0, window.__otraceSignupScrollY || 0);
  }

  function focusable() {
    var nodes = sheet.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]');
    var list = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.tabIndex < 0) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      if (el.closest && el.closest('[hidden]')) continue;
      list.push(el);
    }
    return list;
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.hidden = !message;
    errorEl.textContent = message || '';
  }

  function closePopup(signed) {
    if (host.hidden) return;
    host.hidden = true;
    unlockPage();
    var state = readState();
    if (signed || (state && state.signed)) writeState({ signed: true }, SIGNED_DAYS);
    else writeState({ until: Date.now() + DISMISS_MS }, 14);
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function busy() {
    if (document.documentElement.classList.contains('otrace-modal-lock')) return true;
    return !!document.querySelector('dialog[open]');
  }

  function openPopup() {
    if (opened || suppressed() || host.hidden === false) return;
    if (busy()) {
      if (waiting) return;
      waiting = true;
      window.setTimeout(function () { waiting = false; openPopup(); }, 2000);
      return;
    }
    opened = true;
    lastFocus = document.activeElement;
    host.hidden = false;
    lockPage();
    if (emailInput) emailInput.focus();
  }

  function reveal(code) {
    if (codeEl) codeEl.textContent = code;
    if (formView) formView.hidden = true;
    if (doneView) doneView.hidden = false;
    sheet.setAttribute('aria-labelledby', 'otrace-signup-done-title');
    writeState({ signed: true }, SIGNED_DAYS);
    document.dispatchEvent(new CustomEvent('otrace:lead'));
    if (copyBtn) copyBtn.focus();
  }

  host.addEventListener('click', function (event) {
    if (event.target === host) closePopup(false);
  });
  host.querySelector('[data-signup-close]').addEventListener('click', function () {
    closePopup(false);
  });

  document.addEventListener('keydown', function (event) {
    if (host.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePopup(false);
      return;
    }
    if (event.key !== 'Tab') return;
    var items = focusable();
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var code = codeEl ? codeEl.textContent : '';
      var mark = function () { copyBtn.textContent = 'Copied'; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(mark, mark);
      } else {
        mark();
      }
    });
  }

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var email = emailInput ? emailInput.value : '';
      var hp = form.querySelector('[name="otrace_hp"]');
      var button = form.querySelector('[type="submit"]');
      showError('');
      if (button) button.disabled = true;
      fetch('/api/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          email: email,
          path: window.location.pathname,
          otrace_hp: hp ? hp.value : '',
          source: 'signup-popup',
          formId: 'signup-popup',
        }),
      }).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (json) {
          return { ok: res.ok, status: res.status, json: json };
        });
      }).then(function (result) {
        if (button) button.disabled = false;
        if (!result.ok || !result.json || !result.json.code) {
          showError((result.json && result.json.error) || 'Could not add you just now.');
          return;
        }
        reveal(result.json.code);
      }).catch(function () {
        if (button) button.disabled = false;
        showError('Could not add you just now.');
      });
    });
  }

  if (suppressed()) return;

  window.setTimeout(openPopup, DELAY_MS);

  window.addEventListener('scroll', function () {
    var full = document.documentElement.scrollHeight - window.innerHeight;
    if (full < 48) return;
    if ((window.scrollY || document.documentElement.scrollTop || 0) / full >= 0.5) openPopup();
  }, { passive: true });

  var desktop = window.matchMedia('(min-width: 768px)');
  document.documentElement.addEventListener('mouseout', function (event) {
    if (!desktop.matches) return;
    if (event.clientY > 8) return;
    if (event.relatedTarget) return;
    openPopup();
  });
})();
