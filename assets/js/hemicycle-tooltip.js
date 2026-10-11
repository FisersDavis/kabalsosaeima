// hemicycle-tooltip.js - Fast vanilla JS floating tooltip & table search for Saeima vote pages
(function () {
  'use strict';

  function initHemicycle() {
    var hemicycleContainer = document.querySelector('[data-hemicycle-container]');
    var tooltip = document.getElementById('seat-tooltip');

    if (hemicycleContainer && tooltip) {
      var nameEl = tooltip.querySelector('[data-tooltip-name]');
      var factionBadge = tooltip.querySelector('[data-tooltip-faction]');
      var decisionEl = tooltip.querySelector('[data-tooltip-decision]');
      var activeLink = null;

      function showTooltip(seatEl) {
        var name = seatEl.getAttribute('data-name') || '';
        var faction = seatEl.getAttribute('data-faction') || '';
        var fColor = seatEl.getAttribute('data-faction-color') || '#64748B';
        var fTextColor = seatEl.getAttribute('data-faction-text-color') || '#FFFFFF';
        var decision = seatEl.getAttribute('data-decision') || '';
        var decColor = seatEl.getAttribute('data-decision-color') || '#10B981';

        nameEl.textContent = name;
        factionBadge.textContent = faction;
        factionBadge.style.backgroundColor = fColor;
        factionBadge.style.color = fTextColor;
        decisionEl.textContent = decision;
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

    // Rollcall Table Search & Filter
    var searchInput = document.getElementById('deputy-search-input');
    var rollcallTable = document.getElementById('rollcall-table-body');
    var countBadge = document.getElementById('deputy-visible-count');

    if (searchInput && rollcallTable) {
      searchInput.addEventListener('input', function () {
        var q = searchInput.value.trim().toLowerCase();
        var rows = rollcallTable.querySelectorAll('tr[data-deputy-row]');
        var visible = 0;

        rows.forEach(function (row) {
          var name = (row.getAttribute('data-deputy-name') || '').toLowerCase();
          var faction = (row.getAttribute('data-deputy-faction') || '').toLowerCase();
          var decision = (row.getAttribute('data-deputy-decision') || '').toLowerCase();

          if (!q || name.indexOf(q) !== -1 || faction.indexOf(q) !== -1 || decision.indexOf(q) !== -1) {
            row.style.display = '';
            visible++;
          } else {
            row.style.display = 'none';
          }
        });

        if (countBadge) {
          countBadge.textContent = visible + ' deputāti';
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
