// Zero-latency client-side MP table filter, keyboard-accessible column sorting, and URL parameter synchronization
(function() {
  'use strict';

  function normalizeText(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/ā/g, 'a').replace(/č/g, 'c').replace(/ē/g, 'e')
      .replace(/ģ/g, 'g').replace(/ī/g, 'i').replace(/ķ/g, 'k')
      .replace(/ļ/g, 'l').replace(/ņ/g, 'n').replace(/š/g, 's')
      .replace(/ū/g, 'u').replace(/ž/g, 'z')
      .trim();
  }

  function isLvSingular(n) {
    return n % 10 === 1 && n % 100 !== 11;
  }

  function selectHasValue(selectEl, value) {
    if (!selectEl || value === null || value === undefined) return false;
    for (var i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === value) return true;
    }
    return false;
  }

  function initMpFilter() {
    var dirRoot = document.getElementById('mp-directory-root');
    var isActiveTerm = !dirRoot || dirRoot.getAttribute('data-term-active') !== 'false';
    var searchInput = document.getElementById('mp-filter-search');
    var factionSelect = document.getElementById('mp-filter-faction');
    var activeToggle = document.getElementById('mp-filter-active');
    var resetBtn = document.getElementById('mp-filter-reset');
    var countEl = document.getElementById('mp-filter-count');
    var tbody = document.getElementById('mp-tbody');
    var rows = Array.prototype.slice.call(document.querySelectorAll('.mp-row'));
    var sortHeaders = document.querySelectorAll('th[data-sort]');

    if (!rows.length || !tbody) return;

    var currentSortKey = 'name';
    var currentSortAsc = true;

    function setActiveToggleUI(active) {
      if (!activeToggle) return;
      activeToggle.setAttribute('data-active', active ? 'true' : 'false');
      activeToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) {
        activeToggle.classList.add('bg-neutral-950', 'text-white', 'border-neutral-950');
        activeToggle.classList.remove('bg-white', 'text-neutral-700', 'border-neutral-300');
      } else {
        activeToggle.classList.remove('bg-neutral-950', 'text-white', 'border-neutral-950');
        activeToggle.classList.add('bg-white', 'text-neutral-700', 'border-neutral-300');
      }
    }

    function applyFilter() {
      var query = searchInput ? normalizeText(searchInput.value) : '';
      var faction = factionSelect ? factionSelect.value : 'ALL';
      var activeOnly = activeToggle ? activeToggle.getAttribute('data-active') === 'true' : false;

      var visible = 0;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var rowName = normalizeText(row.getAttribute('data-name') || '');
        var rowFaction = row.getAttribute('data-faction-id') || '';
        var rowActive = row.getAttribute('data-active') === 'true';

        var matchQuery = !query || rowName.indexOf(query) !== -1;
        var matchFaction = faction === 'ALL' || rowFaction === faction;
        var matchActive = !activeOnly || rowActive;

        if (matchQuery && matchFaction && matchActive) {
          row.classList.remove('hidden');
          visible++;
        } else {
          row.classList.add('hidden');
        }
      }

      if (countEl) {
        var isSingular = isLvSingular(visible);
        if (activeOnly && isActiveTerm) {
          countEl.textContent = visible + (isSingular ? ' aktīvs deputāts' : ' aktīvi deputāti');
        } else if (activeOnly && !isActiveTerm) {
          countEl.textContent = visible + ' noslēguma sastāvā';
        } else {
          countEl.textContent = visible + (isSingular ? ' deputāts' : ' deputāti');
        }
      }

      var emptyRow = document.getElementById('mp-empty-row');
      if (emptyRow) {
        if (visible === 0) {
          emptyRow.classList.remove('hidden');
        } else {
          emptyRow.classList.add('hidden');
        }
      }

      if (resetBtn) {
        var isDefault = (!query && faction === 'ALL' && activeOnly === true);
        if (isDefault) {
          resetBtn.classList.add('hidden');
        } else {
          resetBtn.classList.remove('hidden');
        }
      }

      // Keep default URL clean (/deputati/); emit ?active=0 only when showing all MPs
      var params = new URLSearchParams();
      if (query) params.set('q', searchInput.value);
      if (faction !== 'ALL') params.set('faction', faction);
      if (!activeOnly) params.set('active', '0');

      var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + (window.location.hash || '');
      window.history.replaceState(null, '', newUrl);
    }

    function sortTable(key, asc) {
      currentSortKey = key;
      currentSortAsc = asc;

      rows.sort(function(a, b) {
        var valA, valB;
        if (key === 'attendance' || key === 'cohesion') {
          valA = parseFloat(a.getAttribute('data-' + key) || '-2');
          valB = parseFloat(b.getAttribute('data-' + key) || '-2');
          return asc ? valA - valB : valB - valA;
        } else if (key === 'faction') {
          valA = (a.getAttribute('data-faction') || '').trim();
          valB = (b.getAttribute('data-faction') || '').trim();
          var cmp = valA.localeCompare(valB, 'lv');
          if (cmp !== 0) return asc ? cmp : -cmp;
          var nameA = (a.getAttribute('data-name') || '').trim();
          var nameB = (b.getAttribute('data-name') || '').trim();
          return nameA.localeCompare(nameB, 'lv');
        } else {
          valA = (a.getAttribute('data-name') || '').trim();
          valB = (b.getAttribute('data-name') || '').trim();
          var cmpName = valA.localeCompare(valB, 'lv');
          return asc ? cmpName : -cmpName;
        }
      });

      // Update aria-sort and neutral-palette sort indicators on headers
      for (var i = 0; i < sortHeaders.length; i++) {
        var th = sortHeaders[i];
        var thKey = th.getAttribute('data-sort');
        var icon = th.querySelector('.sort-icon');
        if (thKey === key) {
          th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
          if (icon) {
            icon.textContent = asc ? '↑' : '↓';
            icon.className = 'sort-icon text-neutral-950 font-mono text-[11px] font-bold';
          }
        } else {
          th.setAttribute('aria-sort', 'none');
          if (icon) {
            icon.textContent = '↕';
            icon.className = 'sort-icon text-neutral-500 font-mono text-[10px]';
          }
        }
      }

      // Re-append sorted rows
      var emptyRow = document.getElementById('mp-empty-row');
      var frag = document.createDocumentFragment();
      for (var j = 0; j < rows.length; j++) {
        frag.appendChild(rows[j]);
      }
      if (emptyRow) {
        tbody.insertBefore(frag, emptyRow);
      } else {
        tbody.appendChild(frag);
      }
    }

    // Set up keyboard-accessible column sort handlers
    for (var h = 0; h < sortHeaders.length; h++) {
      (function(header) {
        var trigger = header.querySelector('button') || header;
        trigger.addEventListener('click', function() {
          var key = header.getAttribute('data-sort');
          var asc = (currentSortKey === key) ? !currentSortAsc : (key === 'name' || key === 'faction');
          sortTable(key, asc);
        });
      })(sortHeaders[h]);
    }

    // Restore from URL parameters
    var urlParams = new URLSearchParams(window.location.search);
    if (searchInput && urlParams.get('q')) searchInput.value = urlParams.get('q');
    if (factionSelect && selectHasValue(factionSelect, urlParams.get('faction'))) factionSelect.value = urlParams.get('faction');
    if (activeToggle && urlParams.get('active') !== null) {
      var isActive = urlParams.get('active') !== '0';
      setActiveToggleUI(isActive);
    }

    if (searchInput) searchInput.addEventListener('input', applyFilter);
    if (factionSelect) factionSelect.addEventListener('change', applyFilter);

    if (activeToggle) {
      activeToggle.addEventListener('click', function() {
        var active = activeToggle.getAttribute('data-active') === 'true';
        setActiveToggleUI(!active);
        applyFilter();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        if (searchInput) searchInput.value = '';
        if (factionSelect) factionSelect.value = 'ALL';
        setActiveToggleUI(true);
        applyFilter();
      });
    }

    // Default initial sort by name ascending
    sortTable('name', true);
    applyFilter();
  }

  function initMpHistoryFilter() {
    var searchInput = document.getElementById('mp-history-search');
    var decisionSelect = document.getElementById('mp-history-decision');
    var emptyEl = document.getElementById('mp-history-empty');
    var countEl = document.getElementById('mp-history-count');
    var rows = document.querySelectorAll('.mp-history-row');
    if (!rows.length || (!searchInput && !decisionSelect)) return;

    var totalAll = countEl ? parseInt(countEl.getAttribute('data-total') || String(rows.length), 10) : rows.length;
    var renderedAll = countEl ? parseInt(countEl.getAttribute('data-rendered') || String(rows.length), 10) : rows.length;

    function applyHistoryFilter() {
      var q = searchInput ? normalizeText(searchInput.value) : '';
      var dec = decisionSelect ? decisionSelect.value : 'ALL';
      var isFiltered = Boolean(q) || dec !== 'ALL';
      var visible = 0;

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var title = normalizeText(row.getAttribute('data-title') || '');
        var rowDec = (row.getAttribute('data-decision') || '').toUpperCase();

        var matchQ = !q || title.indexOf(q) !== -1;
        var matchDec = (dec === 'ALL' || rowDec === dec || (dec === 'NEBALSO' && rowDec === 'NAV_REGISTRETS'));

        if (matchQ && matchDec) {
          row.classList.remove('hidden');
          visible++;
        } else {
          row.classList.add('hidden');
        }
      }

      if (countEl) {
        if (isFiltered) {
          var verb = isLvSingular(visible) ? 'Atrasts ' : 'Atrasti ';
          var noun = isLvSingular(visible) ? ' balsojums' : ' balsojumi';
          var scope = totalAll > renderedAll ? ' (no jaunākajiem ' + renderedAll + ')' : '';
          countEl.textContent = verb + visible + noun + scope;
        } else {
          var base = totalAll + (isLvSingular(totalAll) ? ' balsojums' : ' balsojumi');
          countEl.textContent = totalAll > renderedAll ? base + ' · jaunākie ' + renderedAll : base;
        }
      }

      if (emptyEl) {
        if (visible === 0) {
          emptyEl.classList.remove('hidden');
        } else {
          emptyEl.classList.add('hidden');
        }
      }
    }

    if (searchInput) searchInput.addEventListener('input', applyHistoryFilter);
    if (decisionSelect) decisionSelect.addEventListener('change', applyHistoryFilter);
  }

  function initAll() {
    initMpFilter();
    initMpHistoryFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
