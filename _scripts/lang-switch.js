---
permalink: /assets/js/lang-switch.js
---
(function () {
  'use strict';

  var ptPages = ['/', '/publications/', '/cv/'];

  var toggle = document.getElementById('lang-toggle');
  if (!toggle) return;

  var path = window.location.pathname;
  // normalize trailing slash
  if (path !== '/' && !path.endsWith('/')) path = path + '/';

  var isPt = path === '/pt/' || path.startsWith('/pt/');

  if (isPt) {
    toggle.textContent = 'EN';
    var enPath = path.replace(/^\/pt/, '') || '/';
    toggle.href = enPath;
  } else {
    var hasPt = ptPages.indexOf(path) !== -1;
    if (hasPt) {
      toggle.textContent = 'PT';
      toggle.href = '/pt' + (path === '/' ? '/' : path);
    } else {
      var li = toggle.parentElement;
      if (li) li.style.display = 'none';
    }
  }
})();
