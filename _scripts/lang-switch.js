---
permalink: /assets/js/lang-switch.js
---
(function () {
  'use strict';

  var STORAGE_KEY = 'preferred-lang';
  var PT_PAGES    = ['/', '/publications/', '/cv/', '/repositories/'];

  /* ── 1. Determine current page language ── */
  var path = window.location.pathname;
  if (path !== '/' && !path.endsWith('/')) path += '/';

  var isPt        = path === '/pt/' || path.startsWith('/pt/');
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

  /* ── 3. Apply saved language preference to navbar ── */
  function applyLang(lang) {
    /* Update active state on switcher buttons */
    var btnEn = document.getElementById('ls-en');
    var btnPt = document.getElementById('ls-pt');
    if (btnEn) {
      btnEn.classList.toggle('ls-active', lang === 'en');
    }
    if (btnPt) {
      btnPt.classList.toggle('ls-active', lang === 'pt');
      btnPt.classList.toggle('ls-disabled', btnPt.tagName !== 'A');
    }

    /* Update nav link labels and hrefs */
    var links = document.querySelectorAll('[data-en-title]');
    links.forEach(function (link) {
      var title = lang === 'pt'
        ? (link.getAttribute('data-pt-title') || link.getAttribute('data-en-title'))
        : link.getAttribute('data-en-title');
      var href = lang === 'pt'
        ? (link.getAttribute('data-pt-href') || link.getAttribute('data-en-href'))
        : link.getAttribute('data-en-href');

      /* Preserve any <span class="sr-only"> child */
      var srOnly = link.querySelector('.sr-only');
      link.childNodes.forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE) node.remove();
      });
      link.insertAdjacentText('afterbegin', title);
      if (srOnly) link.appendChild(srOnly);

      if (href) link.setAttribute('href', href);
    });
  }

  /* ── 4. Wire up switcher buttons ── */
  function initSwitcher() {
    var effectiveLang = saved || currentLang;
    applyLang(effectiveLang);

    var btnEn = document.getElementById('ls-en');
    var btnPt = document.getElementById('ls-pt');

    if (btnEn) {
      btnEn.addEventListener('click', function () {
        try { localStorage.setItem(STORAGE_KEY, 'en'); } catch (e) {}
      });
    }
    if (btnPt) {
      btnPt.addEventListener('click', function () {
        try { localStorage.setItem(STORAGE_KEY, 'pt'); } catch (e) {}
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSwitcher);
  } else {
    initSwitcher();
  }
})();
