// hemicycle-tooltip.js - Fast vanilla JS floating tooltip, rollcall table hydration, interactive filters, search & column sorting for Saeima vote pages
(function () {
  'use strict';

  var DECISION_LABELS = {
    PAR: 'PAR',
    PRET: 'PRET',
    ATTURAS: 'ATTURAS',
    NEBALSO: 'NEBALSOJA',
    NAV_REGISTRETS: 'NAV REĢISTRĒTS'
  };

  var DECISION_COLORS = {
    PAR: '#059669',
    PRET: '#e11d48',
    ATTURAS: '#d97706',
    NEBALSO: '#94a3b8',
    NAV_REGISTRETS: '#94a3b8'
  };

  function normalizeText(str) {
    if (!str) return '';
    return str.toLowerCase()
      .replace(/ā/g, 'a').replace(/č/g, 'c').replace(/ē/g, 'e')
      .replace(/ģ/g, 'g').replace(/ī/g, 'i').replace(/ķ/g, 'k')
      .replace(/ļ/g, 'l').replace(/ņ/g, 'n').replace(/š/g, 's')
      .replace(/ū/g, 'u').replace(/ž/g, 'z')
      .trim();
  }

  function avatarInitials(name) {
    var parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      var a = Array.from(parts[0])[0] || '';
      var b = Array.from(parts[parts.length - 1])[0] || '';
      return (a + b).toUpperCase();
    }
    if (parts.length === 1) {
      return (Array.from(parts[0])[0] || '').toUpperCase();
    }
    return '';
  }

  function parseFactionsMap(container) {
    if (!container) return {};
    var raw = container.getAttribute('data-factions');
    if (!raw) return {};
    try {
      return JSON.parse(raw) || {};
    } catch (_) {
      return {};
    }
  }

  function extractSeatInfo(seatEl, factionsMap) {
    var fid = seatEl.getAttribute('data-f') || 'ind';
    var fMeta = factionsMap[fid];
    var fShort = seatEl.getAttribute('data-faction') || (fMeta ? fMeta[0] : fid);
    var fName = fMeta ? fMeta[1] : 'Pie frakcijām nepiederošs';
    var fColor = seatEl.getAttribute('data-faction-color') || (fMeta ? fMeta[2] : '#64748B');
    var fTextColor = seatEl.getAttribute('data-faction-text-color') || (fMeta ? fMeta[3] : '#FFFFFF');

    var decision = (seatEl.getAttribute('data-d') || seatEl.getAttribute('data-decision') || 'NEBALSO').toUpperCase();
    var decLabel = seatEl.getAttribute('data-decision-label') || DECISION_LABELS[decision] || 'NAV REĢISTRĒTS';
    var decColor = seatEl.getAttribute('data-decision-color') || DECISION_COLORS[decision] || '#94a3b8';

    var name = seatEl.getAttribute('data-name') || '';
    if (!name) {
      var titleEl = seatEl.querySelector('title');
      var titleText = titleEl ? (titleEl.textContent || '') : '';
      var idx = titleText.lastIndexOf(' (');
      name = idx > 0 ? titleText.slice(0, idx) : titleText;
    }

    return {
      el: seatEl,
      href: seatEl.getAttribute('href') || '#',
      name: name,
      nameNorm: normalizeText(name),
      factionId: fid,
      factionShort: fShort,
      factionShortUpper: fShort.toUpperCase(),
      factionName: fName,
      factionColor: fColor,
      factionTextColor: fTextColor,
      decision: decision,
      decisionLabel: decLabel,
      decisionColor: decColor,
      devLine: seatEl.getAttribute('data-dev') || ''
    };
  }

  function buildDeputyRow(info) {
    var tr = document.createElement('tr');
    tr.className = 'deputy-row rc-row';
    tr.setAttribute('data-deputy-row', '');
    tr.setAttribute('data-name', info.name);
    tr.setAttribute('data-faction', info.factionShort);
    tr.setAttribute('data-decision', info.decision);

    // Col 1: Subtle faction dot + deputy name + optional deviation indicator
    var td1 = document.createElement('td');
    td1.className = 'rc-td';

    var link = document.createElement('a');
    link.href = info.href;
    link.className = 'rc-link';

    var dot = document.createElement('span');
    dot.className = 'rc-dot';
    dot.style.backgroundColor = info.factionColor;
    link.appendChild(dot);

    var nm = document.createElement('div');
    nm.className = 'rc-nm';
    var nmSpan = document.createElement('span');
    nmSpan.className = 'rc-nm-text truncate';
    nmSpan.textContent = info.name;
    nm.appendChild(nmSpan);

    if (info.devLine) {
      var devSpan = document.createElement('span');
      devSpan.className = 'text-[11px] font-medium text-amber-800 cursor-help shrink-0';
      devSpan.title = 'Balsojis pretēji frakcijas līnijai (' + info.devLine + ')';
      devSpan.textContent = '✦ Novirze';
      nm.appendChild(devSpan);
    }

    link.appendChild(nm);
    td1.appendChild(link);
    tr.appendChild(td1);

    // Col 2: Faction short + full name
    var td2 = document.createElement('td');
    td2.className = 'rc-td';
    var facDiv = document.createElement('div');
    facDiv.className = 'rc-fac';

    var fshort = document.createElement('span');
    fshort.className = 'rc-fshort';
    fshort.textContent = info.factionShort;
    facDiv.appendChild(fshort);

    var fname = document.createElement('span');
    fname.className = 'rc-fname';
    fname.textContent = info.factionName;
    facDiv.appendChild(fname);

    td2.appendChild(facDiv);
    tr.appendChild(td2);

    // Col 3: Clean typographic decision label
    var td3 = document.createElement('td');
    td3.className = 'rc-td text-right';
    var badge = document.createElement('span');
    badge.className = 'rc-badge dc-' + info.decision;
    badge.textContent = info.decisionLabel;
    td3.appendChild(badge);
    tr.appendChild(td3);

    return tr;
  }

  function initHemicycle() {
    var hemicycleContainer = document.querySelector('[data-hemicycle-container]');
    var tooltip = document.getElementById('seat-tooltip');
    var factionsMap = parseFactionsMap(hemicycleContainer);
    var seatNodes = hemicycleContainer
      ? Array.prototype.slice.call(hemicycleContainer.querySelectorAll('svg.hc a, [data-seat-link]'))
      : [];
    var seatInfos = seatNodes.map(function (el) {
      return extractSeatInfo(el, factionsMap);
    });

    if (hemicycleContainer && tooltip) {
      var nameEl = tooltip.querySelector('[data-tooltip-name]');
      var factionBadge = tooltip.querySelector('[data-tooltip-faction]');
      var decisionEl = tooltip.querySelector('[data-tooltip-decision]');

      function showTooltip(info) {
        nameEl.textContent = info.name;
        factionBadge.textContent = info.factionShort;
        factionBadge.style.backgroundColor = info.factionColor;
        factionBadge.style.color = info.factionTextColor;
        decisionEl.textContent = info.decisionLabel;
        decisionEl.style.color = info.decisionColor;

        // Position tooltip relative to container
        var containerRect = hemicycleContainer.getBoundingClientRect();
        var seatRect = info.el.getBoundingClientRect();

        // Calculate center of seat relative to container
        var seatCenterX = seatRect.left + seatRect.width / 2 - containerRect.left;
        var seatTopY = seatRect.top - containerRect.top;

        tooltip.style.left = seatCenterX + 'px';
        tooltip.style.top = (seatTopY - 8) + 'px';
        tooltip.classList.remove('opacity-0', 'pointer-events-none');
        tooltip.classList.add('opacity-100');
      }

      function hideTooltip() {
        tooltip.classList.remove('opacity-100');
        tooltip.classList.add('opacity-0', 'pointer-events-none');
      }

      seatInfos.forEach(function (info) {
        info.el.addEventListener('mouseenter', function () {
          showTooltip(info);
        });
        info.el.addEventListener('focus', function () {
          showTooltip(info);
        });
        info.el.addEventListener('mouseleave', hideTooltip);
        info.el.addEventListener('blur', hideTooltip);
      });

      hemicycleContainer.addEventListener('mouseleave', hideTooltip);
    }

    // Hydrate rollcall table synchronously from pre-rendered SVG seats
    var rollcallTable = document.getElementById('rollcall-table-body');
    var emptyRow = document.getElementById('rollcall-empty-row');
    var rows = rollcallTable
      ? Array.prototype.slice.call(rollcallTable.querySelectorAll('tr[data-deputy-row]'))
      : [];

    if (rollcallTable && rows.length === 0 && seatInfos.length > 0) {
      var frag = document.createDocumentFragment();
      seatInfos.forEach(function (info) {
        var tr = buildDeputyRow(info);
        rows.push(tr);
        frag.appendChild(tr);
      });
      if (emptyRow) {
        rollcallTable.insertBefore(frag, emptyRow);
      } else {
        rollcallTable.appendChild(frag);
      }
    }

    // Filter & Sort State
    var selectedDecision = 'ALL';
    var selectedFaction = 'ALL';
    var searchQuery = '';
    var currentSortKey = 'name';
    var currentSortAsc = true;

    var searchInput = document.getElementById('deputy-search-input');
    var factionSelect = document.getElementById('deputy-faction-filter');
    var countBadge = document.getElementById('deputy-visible-count');
    var filterBtns = document.querySelectorAll('[data-filter-decision]');
    var sortHeaders = document.querySelectorAll('th[data-sort]');

    function applyFilters() {
      // 1. Update Hemicycle seats opacity
      seatInfos.forEach(function (info) {
        var matchDec = (selectedDecision === 'ALL' || info.decision === selectedDecision);
        var matchFac = (selectedFaction === 'ALL' || info.factionShortUpper === selectedFaction);

        if (matchDec && matchFac) {
          info.el.style.opacity = '1';
        } else {
          info.el.style.opacity = '0.15';
        }
      });

      // 2. Update Table rows visibility
      var visible = 0;
      rows.forEach(function (row) {
        var nameNorm = normalizeText(row.getAttribute('data-name') || '');
        var faction = (row.getAttribute('data-faction') || '').toUpperCase();
        var decision = (row.getAttribute('data-decision') || '').toUpperCase();

        var matchSearch = (!searchQuery || nameNorm.indexOf(searchQuery) !== -1 || faction.toLowerCase().indexOf(searchQuery) !== -1);
        var matchDec = (selectedDecision === 'ALL' || decision === selectedDecision);
        var matchFac = (selectedFaction === 'ALL' || faction === selectedFaction);

        if (matchSearch && matchDec && matchFac) {
          row.style.display = '';
          visible++;
        } else {
          row.style.display = 'none';
        }
      });

      if (countBadge) {
        countBadge.textContent = visible + (visible % 10 === 1 && visible % 100 !== 11 ? ' deputāts' : ' deputāti');
      }

      if (emptyRow) {
        if (visible === 0) {
          emptyRow.classList.remove('hidden');
        } else {
          emptyRow.classList.add('hidden');
        }
      }
    }

    var decisionRank = { 'PAR': 1, 'PRET': 2, 'ATTURAS': 3, 'NEBALSO': 4 };

    function sortTable(key, asc) {
      currentSortKey = key;
      currentSortAsc = asc;

      rows.sort(function (a, b) {
        var nameA = (a.getAttribute('data-name') || '').trim();
        var nameB = (b.getAttribute('data-name') || '').trim();

        if (key === 'decision') {
          var decA = (a.getAttribute('data-decision') || '').toUpperCase();
          var decB = (b.getAttribute('data-decision') || '').toUpperCase();
          var rankA = decisionRank[decA] || 99;
          var rankB = decisionRank[decB] || 99;
          if (rankA !== rankB) return asc ? rankA - rankB : rankB - rankA;
          return nameA.localeCompare(nameB, 'lv');
        } else if (key === 'faction') {
          var facA = (a.getAttribute('data-faction') || '').trim();
          var facB = (b.getAttribute('data-faction') || '').trim();
          var cmpFac = facA.localeCompare(facB, 'lv');
          if (cmpFac !== 0) return asc ? cmpFac : -cmpFac;
          return nameA.localeCompare(nameB, 'lv');
        } else {
          var cmpName = nameA.localeCompare(nameB, 'lv');
          return asc ? cmpName : -cmpName;
        }
      });

      // Update header indicators
      sortHeaders.forEach(function (th) {
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
      });

      // Re-append sorted rows
      if (rollcallTable) {
        var frag = document.createDocumentFragment();
        rows.forEach(function (row) {
          frag.appendChild(row);
        });
        if (emptyRow) {
          rollcallTable.insertBefore(frag, emptyRow);
        } else {
          rollcallTable.appendChild(frag);
        }
      }
    }

    // Connect sort headers
    sortHeaders.forEach(function (header) {
      header.addEventListener('click', function () {
        var key = header.getAttribute('data-sort');
        var asc = (currentSortKey === key) ? !currentSortAsc : true;
        sortTable(key, asc);
      });
    });

    // Connect decision buttons
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dec = btn.getAttribute('data-filter-decision') || 'ALL';
        selectedDecision = dec;

        filterBtns.forEach(function (b) {
          if (b === btn) {
            b.className = 'px-2.5 py-1 font-semibold text-xs transition bg-neutral-950 text-white inline-flex items-center gap-1.5 cursor-pointer tabular-nums';
          } else {
            b.className = 'px-2.5 py-1 font-medium text-xs text-neutral-700 bg-white border border-neutral-200 hover:border-neutral-950 transition inline-flex items-center gap-1.5 cursor-pointer tabular-nums';
          }
        });

        applyFilters();
      });
    });

    if (factionSelect) {
      factionSelect.addEventListener('change', function () {
        selectedFaction = (factionSelect.value || 'ALL').toUpperCase();
        applyFilters();
      });
    }

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        searchQuery = normalizeText(searchInput.value);
        applyFilters();
      });
    }

    // Copy link button
    var copyBtn = document.getElementById('copy-link-btn');
    var copyText = document.getElementById('copy-link-text');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (navigator.clipboard && window.location.href) {
          navigator.clipboard.writeText(window.location.href).then(function () {
            if (copyText) copyText.textContent = '✓ Saite nokopēta!';
            setTimeout(function () {
              if (copyText) copyText.textContent = 'Kopēt saiti';
            }, 2000);
          }).catch(function () {});
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHemicycle);
  } else {
    initHemicycle();
  }
})();
