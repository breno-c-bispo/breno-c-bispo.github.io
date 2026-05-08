---
layout: page
permalink: /pt/publications/
title: publicações
lang: pt-BR
description: publicações em ordem cronológica reversa
nav: false
---

<p>
  Para a lista completa, acesse meu perfil no
  <a href="https://scholar.google.com/citations?user=phr4dW8AAAAJ&hl=pt" target="_blank" style="color:#4285F4; font-weight:600;">Google Scholar</a>.
  Use os filtros abaixo para navegar por categoria, tipo ou ano.
</p>

<!-- Filter UI -->
<div class="pub-filters mb-4">

  <div class="filter-row mb-2">
    <span class="filter-label">Categoria</span>
    <div class="btn-group flex-wrap" role="group" aria-label="Filtrar por categoria">
      <button class="btn btn-sm filter-btn active" data-filter="category" data-value="paper">Artigos</button>
      <button class="btn btn-sm filter-btn" data-filter="category" data-value="talk">Palestras</button>
      <button class="btn btn-sm filter-btn" data-filter="category" data-value="poster">Pôsteres</button>
    </div>
  </div>

  <div class="filter-row mb-2" id="type-filter-group">
    <span class="filter-label">Tipo</span>
    <div class="btn-group flex-wrap" role="group" aria-label="Filtrar por tipo">
      <button class="btn btn-sm filter-btn active" data-filter="type" data-value="all">Todos</button>
      <button class="btn btn-sm filter-btn" data-filter="type" data-value="under-review">Em Revisão</button>
      <button class="btn btn-sm filter-btn" data-filter="type" data-value="journal">Periódico</button>
      <button class="btn btn-sm filter-btn" data-filter="type" data-value="conference">Conferência</button>
    </div>
  </div>

  <div class="filter-row">
    <span class="filter-label">Ano</span>
    <div class="btn-group flex-wrap" role="group" aria-label="Filtrar por ano">
      <button class="btn btn-sm filter-btn active" data-filter="year" data-value="all">Todos</button>
      <button class="btn btn-sm filter-btn" data-filter="year" data-value="2026">2026</button>
      <button class="btn btn-sm filter-btn" data-filter="year" data-value="2025">2025</button>
      <button class="btn btn-sm filter-btn" data-filter="year" data-value="2024">2024</button>
      <button class="btn btn-sm filter-btn" data-filter="year" data-value="2023">2023</button>
      <button class="btn btn-sm filter-btn" data-filter="year" data-value="2022">2022</button>
    </div>
  </div>

</div>

<!-- Bib text search -->
{% include bib_search.liquid %}

<!-- Publications list (rendered by jekyll-scholar) -->
<div class="publications">
{% bibliography %}
</div>

<script>
(function () {
  'use strict';

  var activeCategory = 'paper';
  var activeType     = 'all';
  var activeYear     = 'all';

  function getPubCategory(row) {
    var pt = (row.getAttribute('data-pubtype') || '').toLowerCase().trim();
    if (pt === 'talk')   return 'talk';
    if (pt === 'poster') return 'poster';
    return 'paper';
  }

  function getPubType(row) {
    var pt = (row.getAttribute('data-pubtype') || '').toLowerCase().trim();
    var et = (row.getAttribute('data-entrytype') || '').toLowerCase().trim();
    if (pt === 'under-review')                               return 'under-review';
    if (et === 'article')                                    return 'journal';
    if (et === 'inproceedings' || et === 'incollection')     return 'conference';
    return 'other';
  }

  function applyFilters() {
    var entries = document.querySelectorAll('.publications ol.bibliography li');
    entries.forEach(function (li) {
      var row = li.querySelector('.bib-entry');
      if (!row) { li.style.display = ''; return; }

      var cat  = getPubCategory(row);
      var type = getPubType(row);
      var year = (row.getAttribute('data-year') || '').trim();

      var catOk  = activeCategory === 'all' || cat  === activeCategory;
      var typeOk = activeType     === 'all' || cat  !== 'paper' || type === activeType;
      var yearOk = activeYear     === 'all' || year === activeYear;

      li.style.display = (catOk && typeOk && yearOk) ? '' : 'none';
    });

    document.querySelectorAll('.publications h2').forEach(function (h2) {
      var ol = h2.nextElementSibling;
      if (!ol || ol.tagName !== 'OL') return;
      var hasVisible = Array.prototype.some.call(
        ol.querySelectorAll('li'),
        function (li) { return li.style.display !== 'none'; }
      );
      h2.style.display = hasVisible ? '' : 'none';
      ol.style.display = hasVisible ? '' : 'none';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var typeGroup = document.getElementById('type-filter-group');

    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var filterType = this.getAttribute('data-filter');
        var value      = this.getAttribute('data-value');

        var group = this.closest('.btn-group');
        group.querySelectorAll('.filter-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        this.classList.add('active');

        if (filterType === 'category') {
          activeCategory = value;
          if (typeGroup) {
            typeGroup.style.display =
              (value === 'all' || value === 'paper') ? '' : 'none';
          }
        } else if (filterType === 'type') {
          activeType = value;
        } else if (filterType === 'year') {
          activeYear = value;
        }

        applyFilters();
      });
    });

    applyFilters();
  });
})();
</script>
