// hemicycle-tooltip.js - Fast vanilla JS floating tooltip, interactive filters, search & column sorting for Saeima vote pages
(function () {
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

  function initHemicycle() {
    var hemicycleContainer = document.querySelector('[data-hemicycle-container]');
    var tooltip = document.getElementById('seat-tooltip');

    if (hemicycleContainer && tooltip) {
      var nameEl = tooltip.querySelector('[data-tooltip-name]');
      var factionBadge = tooltip.querySelector('[data-tooltip-faction]');
      var decisionEl = tooltip.querySelector('[data-tooltip-decision]');

      function showTooltip(seatEl) {
        var name = seatEl.getAttribute('data-name') || '';
        var faction = seatEl.getAttribute('data-faction') || '';
        var fColor = seatEl.getAttribute('data-faction-color') || '#64748B';
        var fTextColor = seatEl.getAttribute('data-faction-text-color') || '#FFFFFF';
        var decisionLabel = seatEl.getAttribute('data-decision-label') || seatEl.getAttribute('data-decision') || '';
        var decColor = seatEl.getAttribute('data-decision-color') || '#10B981';

        nameEl.textContent = name;
        factionBadge.textContent = faction;
        factionBadge.style.backgroundColor = fColor;
        factionBadge.style.color = fTextColor;
        decisionEl.textContent = decisionLabel;
        decisionEl.style.color = decColor;

        // Position tooltip relative to container
        var containerRect = hemicycleContainer.getBoundingClientRect();
        var seatRect = seatEl.getBoundingClientRect();

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

      var seats = hemicycleContainer.querySelectorAll('[data-seat-link]');
      seats.forEach(function (seat) {
        seat.addEventListener('mouseenter', function () {
          showTooltip(seat);
        });
        seat.addEventListener('focus', function () {
          showTooltip(seat);
        });
        seat.addEventListener('mouseleave', function () {
          hideTooltip();
        });
        seat.addEventListener('blur', function () {
          hideTooltip();
        });
      });

      hemicycleContainer.addEventListener('mouseleave', hideTooltip);
    }

    // Filter & Sort State
    var selectedDecision = 'ALL';
    var selectedFaction = 'ALL';
    var searchQuery = '';
    var currentSortKey = 'name';
    var currentSortAsc = true;

    var searchInput = document.getElementById('deputy-search-input');
    var factionSelect = document.getElementById('deputy-faction-filter');
    var rollcallTable = document.getElementById('rollcall-table-body');
    var countBadge = document.getElementById('deputy-visible-count');
    var filterBtns = document.querySelectorAll('[data-filter-decision]');
    var sortHeaders = document.querySelectorAll('th[data-sort]');
    var allSeats = hemicycleContainer ? hemicycleContainer.querySelectorAll('[data-seat-link]') : [];
    var rows = rollcallTable ? Array.prototype.slice.call(rollcallTable.querySelectorAll('tr[data-deputy-row]')) : [];

    function applyFilters() {
      // 1. Update Hemicycle seats opacity
      allSeats.forEach(function (seat) {
        var dec = (seat.getAttribute('data-decision') || '').toUpperCase();
        var fac = (seat.getAttribute('data-faction') || '').toUpperCase();

        var matchDec = (selectedDecision === 'ALL' || dec === selectedDecision);
        var matchFac = (selectedFaction === 'ALL' || fac === selectedFaction);

        if (matchDec && matchFac) {
          seat.style.opacity = '1';
        } else {
          seat.style.opacity = '0.15';
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

      var emptyRow = document.getElementById('rollcall-empty-row');
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
        rows.forEach(function (row) {
          rollcallTable.appendChild(row);
        });
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
            b.className = 'px-2.5 py-1 rounded-md font-bold text-xs transition bg-slate-900 text-white shadow-2xs flex items-center gap-1.5 cursor-pointer';
          } else {
            b.className = 'px-2.5 py-1 rounded-md font-medium text-xs text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-2xs flex items-center gap-1.5 cursor-pointer';
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
