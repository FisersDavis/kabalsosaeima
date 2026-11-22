// Zero-latency client-side MP table filter, column sorting and URL parameter synchronization
(function() {
  function normalizeText(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/ā/g, 'a').replace(/č/g, 'c').replace(/ē/g, 'e')
      .replace(/ģ/g, 'g').replace(/ī/g, 'i').replace(/ķ/g, 'k')
      .replace(/ļ/g, 'l').replace(/ņ/g, 'n').replace(/š/g, 's')
      .replace(/ū/g, 'u').replace(/ž/g, 'z')
      .trim();
  }

  function initMpFilter() {
    var dirRoot = document.getElementById('mp-directory-root');
    var isActiveTerm = !dirRoot || dirRoot.getAttribute('data-term-active') !== 'false';
    var searchInput = document.getElementById('mp-filter-search');
    var factionSelect = document.getElementById('mp-filter-faction');
    var activeToggle = document.getElementById('mp-filter-active');
    var resetBtn = document.getElementById('mp-filter-reset');
    var countEl = document.getElementById('mp-filter-count');
    var emptyState = document.getElementById('mp-empty-state');
    var tbody = document.getElementById('mp-tbody');
    var rows = Array.prototype.slice.call(document.querySelectorAll('.mp-row'));
    var sortHeaders = document.querySelectorAll('th[data-sort]');

    if (!rows.length || !tbody) return;

    var currentSortKey = 'name';
    var currentSortAsc = true;

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
        var isSingular = (visible % 10 === 1 && visible % 100 !== 11);
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

      if (emptyState) {
        if (visible === 0) {
          emptyState.classList.remove('hidden');
        } else {
          emptyState.classList.add('hidden');
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

      // Sync URL query params without reloading
      var params = new URLSearchParams();
      if (query) params.set('q', searchInput.value);
      if (faction !== 'ALL') params.set('faction', faction);
      if (activeOnly) params.set('active', '1');

      var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
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
          // Tie-break by name
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

      // Update sort indicators on headers
      for (var i = 0; i < sortHeaders.length; i++) {
        var th = sortHeaders[i];
        var thKey = th.getAttribute('data-sort');
        var icon = th.querySelector('.sort-icon');
        if (icon) {
          if (thKey === key) {
            icon.textContent = asc ? '↑' : '↓';
            icon.className = 'sort-icon text-slate-900 font-mono text-[11px] font-bold';
          } else {
            icon.textContent = '↕';
            icon.className = 'sort-icon text-slate-400 group-hover:text-slate-700 font-mono text-[10px]';
          }
        }
      }

      // Re-append sorted rows
      for (var j = 0; j < rows.length; j++) {
        tbody.appendChild(rows[j]);
      }
    }

    // Set up column sort handlers
    for (var h = 0; h < sortHeaders.length; h++) {
      (function(header) {
        header.addEventListener('click', function() {
          var key = header.getAttribute('data-sort');
          var asc = (currentSortKey === key) ? !currentSortAsc : (key === 'name' || key === 'faction');
          sortTable(key, asc);
        });
      })(sortHeaders[h]);
    }

    // Restore from URL parameters
    var urlParams = new URLSearchParams(window.location.search);
    if (searchInput && urlParams.get('q')) searchInput.value = urlParams.get('q');
    if (factionSelect && urlParams.get('faction')) factionSelect.value = urlParams.get('faction');
    if (activeToggle && urlParams.get('active') !== null) {
      var isActive = urlParams.get('active') === '1';
      activeToggle.setAttribute('data-active', isActive ? 'true' : 'false');
      if (isActive) {
        activeToggle.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
        activeToggle.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
      } else {
        activeToggle.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
        activeToggle.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
      }
    }

    if (searchInput) searchInput.addEventListener('input', applyFilter);
    if (factionSelect) factionSelect.addEventListener('change', applyFilter);

    if (activeToggle) {
      activeToggle.addEventListener('click', function() {
        var active = activeToggle.getAttribute('data-active') === 'true';
        activeToggle.setAttribute('data-active', active ? 'false' : 'true');
        if (!active) {
          activeToggle.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
          activeToggle.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
        } else {
          activeToggle.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
          activeToggle.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
        }
        applyFilter();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        if (searchInput) searchInput.value = '';
        if (factionSelect) factionSelect.value = 'ALL';
        if (activeToggle) {
          activeToggle.setAttribute('data-active', 'true');
          activeToggle.classList.add('bg-slate-900', 'text-white', 'border-slate-900');
          activeToggle.classList.remove('bg-white', 'text-slate-700', 'border-slate-200');
        }
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
    var rows = document.querySelectorAll('.mp-history-row');
    if (!rows.length || (!searchInput && !decisionSelect)) return;

    function applyHistoryFilter() {
      var q = searchInput ? normalizeText(searchInput.value) : '';
      var dec = decisionSelect ? decisionSelect.value : 'ALL';
      var visible = 0;

      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var title = normalizeText(row.getAttribute('data-title') || '');
        var rowDec = (row.getAttribute('data-decision') || '').toUpperCase();

        var matchQ = !q || title.indexOf(q) !== -1;
        var matchDec = (dec === 'ALL' || rowDec === dec);

        if (matchQ && matchDec) {
          row.classList.remove('hidden');
          visible++;
        } else {
          row.classList.add('hidden');
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
