---
permalink: /assets/js/lang-switch.js
---
(function () {
  'use strict';

  var STORAGE_KEY = 'preferred-lang';
  var PT_PAGES    = ['/', '/publications/', '/cv/'];

  /* ── 1. Determine current page language ── */
  var path = window.location.pathname;
  if (path !== '/' && !path.endsWith('/')) path += '/';

  var isPt       = path === '/pt/' || path.startsWith('/pt/');
  var currentLang = isPt ? 'pt' : 'en';

  /* ── 2. Auto-redirect if user has a saved preference ── */
  var saved;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}

  if (saved && saved !== currentLang) {
    if (saved === 'pt' && !isPt) {
      var hasPt = PT_PAGES.indexOf(path) !== -1;
      if (hasPt) {
        location.replace('/pt' + (path === '/' ? '/' : path));
        return;
      }
    } else if (saved === 'en' && isPt) {
      location.replace(path.replace(/^\/pt/, '') || '/');
      return;
    }
  }

  /* ── 3. Build the floating switcher after DOM is ready ── */
  function buildSwitcher() {
    /* Hide the old text-only toggle in the navbar */
    var old = document.getElementById('lang-toggle');
    if (old && old.parentElement) old.parentElement.style.display = 'none';

    /* Compute target URLs */
    var enPath = isPt ? (path.replace(/^\/pt/, '') || '/') : path;
    var ptPath = isPt ? path : ('/pt' + (path === '/' ? '/' : path));
    var hasPtPage = isPt || PT_PAGES.indexOf(path) !== -1;

    /* Create element */
    var el = document.createElement('div');
    el.id = 'lang-switcher';
    el.setAttribute('role', 'navigation');
    el.setAttribute('aria-label', 'Language switcher');

    var enActive = currentLang === 'en' ? ' ls-active' : '';
    var ptActive = currentLang === 'pt' ? ' ls-active' : '';

    var html =
      '<a id="ls-en" class="ls-btn' + enActive + '" href="' + enPath + '" ' +
        'title="English" aria-label="Switch to English">' +
        '<span class="ls-flag">🇬🇧</span> EN' +
      '</a>';

    if (hasPtPage) {
      html +=
        '<a id="ls-pt" class="ls-btn' + ptActive + '" href="' + ptPath + '" ' +
          'title="Português (Brasil)" aria-label="Mudar para Português">' +
          '<span class="ls-flag">🇧🇷</span> PT' +
        '</a>';
    }

    el.innerHTML = html;
    document.body.appendChild(el);

    /* Save preference on click */
    var btnEn = document.getElementById('ls-en');
    var btnPt = document.getElementById('ls-pt');
    if (btnEn) btnEn.addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, 'en'); } catch (e) {}
    });
    if (btnPt) btnPt.addEventListener('click', function () {
      try { localStorage.setItem(STORAGE_KEY, 'pt'); } catch (e) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildSwitcher);
  } else {
    buildSwitcher();
  }
})();
