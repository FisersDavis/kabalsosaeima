// hemicycle-tooltip.js - Viewport-clamped floating tooltip, rollcall table hydration, interactive filters, search & keyboard-accessible sorting
(function () {
  'use strict';

  var DECISION_LABELS = {
    PAR: 'PAR',
    PRET: 'PRET',
    ATTURAS: 'ATTURAS',
    NEBALSO: 'NEBALSOJA',
    NAV_REGISTRETS: 'NAV REĢISTRĒTS'
  };

  // WCAG 2.1 AA compliant foreground colors on white (#FFFFFF)
  var DECISION_COLORS = {
    PAR: '#047857',
    PRET: '#be123c',
    ATTURAS: '#b45309',
    NEBALSO: '#525252',
    NAV_REGISTRETS: '#525252'
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
    var fColor = seatEl.getAttribute('data-faction-color') || (fMeta ? fMeta[2] : '#475569');
    var fTextColor = seatEl.getAttribute('data-faction-text-color') || (fMeta ? fMeta[3] : '#FFFFFF');

    var decision = (seatEl.getAttribute('data-d') || seatEl.getAttribute('data-decision') || 'NEBALSO').toUpperCase();
    var decLabel = seatEl.getAttribute('data-decision-label') || DECISION_LABELS[decision] || 'NAV REĢISTRĒTS';
    var decColor = seatEl.getAttribute('data-decision-color') || DECISION_COLORS[decision] || '#525252';

    var name = seatEl.getAttribute('data-name') || '';
    if (!name) {
      var titleEl = seatEl.querySelector('title');
      var titleText = titleEl ? (titleEl.textContent || '') : (seatEl.getAttribute('aria-label') || '');
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

  function matchesDecisionFilter(decision, selectedDecision) {
    if (selectedDecision === 'ALL') return true;
    if (selectedDecision === 'NEBALSO') {
      return decision === 'NEBALSO' || decision === 'NAV_REGISTRETS';
    }
    return decision === selectedDecision;
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
    dot.setAttribute('aria-hidden', 'true');
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
      var caretEl = tooltip.querySelector('[data-tooltip-caret]');

      function showTooltip(info) {
        nameEl.textContent = info.name;
        factionBadge.textContent = info.factionShort;
        factionBadge.style.backgroundColor = info.factionColor;
        factionBadge.style.color = info.factionTextColor;
        decisionEl.textContent = info.decisionLabel;
        decisionEl.style.color = info.decisionColor;

        // Calculate position relative to container and clamp inside container/viewport bounds
        var containerRect = hemicycleContainer.getBoundingClientRect();
        var seatRect = info.el.getBoundingClientRect();
        var tooltipWidth = tooltip.offsetWidth || 170;
        var halfWidth = tooltipWidth / 2;
        var pad = 6;

        var seatCenterX = seatRect.left + seatRect.width / 2 - containerRect.left;
        var seatTopY = seatRect.top - containerRect.top;

        var minLeft = halfWidth + pad;
        var maxLeft = Math.max(minLeft, containerRect.width - halfWidth - pad);
        var clampedLeft = Math.max(minLeft, Math.min(maxLeft, seatCenterX));

        tooltip.style.left = clampedLeft + 'px';
        tooltip.style.top = (seatTopY - 8) + 'px';

        if (caretEl) {
          var caretOffset = seatCenterX - clampedLeft;
          var maxCaretShift = halfWidth - 14;
          var clampedShift = Math.max(-maxCaretShift, Math.min(maxCaretShift, caretOffset));
          caretEl.style.left = 'calc(50% + ' + clampedShift.toFixed(1) + 'px)';
        }

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
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          hideTooltip();
        }
      });
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
    var currentSortKey = '';
    var currentSortAsc = true;

    var searchInput = document.getElementById('deputy-search-input');
    var factionSelect = document.getElementById('deputy-faction-filter');
    var countBadge = document.getElementById('deputy-visible-count');
    var filterBtns = document.querySelectorAll('[data-filter-decision]');
    var sortHeaders = document.querySelectorAll('th[data-sort]');

    function applyFilters() {
      // 1. Update Hemicycle seats opacity (synced with decision, faction, AND search query)
      seatInfos.forEach(function (info) {
        var matchSearch = (!searchQuery || info.nameNorm.indexOf(searchQuery) !== -1 || info.factionShort.toLowerCase().indexOf(searchQuery) !== -1);
        var matchDec = matchesDecisionFilter(info.decision, selectedDecision);
        var matchFac = (selectedFaction === 'ALL' || info.factionShortUpper === selectedFaction);

        if (matchSearch && matchDec && matchFac) {
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
        var matchDec = matchesDecisionFilter(decision, selectedDecision);
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

    var decisionRank = { 'PAR': 1, 'PRET': 2, 'ATTURAS': 3, 'NEBALSO': 4, 'NAV_REGISTRETS': 5 };

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

      // Update aria-sort and neutral-palette header indicators
      sortHeaders.forEach(function (th) {
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

    // Connect keyboard-accessible sort headers
    sortHeaders.forEach(function (header) {
      var trigger = header.querySelector('button') || header;
      trigger.addEventListener('click', function () {
        var key = header.getAttribute('data-sort');
        var asc = (currentSortKey === key) ? !currentSortAsc : true;
        sortTable(key, asc);
      });
    });

    // Connect decision buttons with aria-pressed sync
    filterBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var dec = btn.getAttribute('data-filter-decision') || 'ALL';
        selectedDecision = dec;

        filterBtns.forEach(function (b) {
          var isSelected = (b === btn);
          b.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
          if (isSelected) {
            b.className = 'px-2.5 py-1 font-semibold text-xs transition border border-neutral-950 bg-neutral-950 text-white inline-flex items-center gap-1.5 cursor-pointer tabular-nums';
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

    // Copy link button with clipboard fallback & timer reset
    var copyBtn = document.getElementById('copy-link-btn');
    var copyText = document.getElementById('copy-link-text');
    var copyTimer = null;
    if (copyBtn) {
      function showCopiedFeedback() {
        if (!copyText) return;
        copyText.textContent = '✓ Saite nokopēta!';
        clearTimeout(copyTimer);
        copyTimer = setTimeout(function () {
          copyText.textContent = 'Kopēt saiti';
        }, 2000);
      }

      function fallbackCopy(text) {
        try {
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          if (ok) showCopiedFeedback();
        } catch (_) {}
      }

      copyBtn.addEventListener('click', function () {
        var href = window.location.href;
        if (!href) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(href).then(showCopiedFeedback).catch(function () {
            fallbackCopy(href);
          });
        } else {
          fallbackCopy(href);
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
