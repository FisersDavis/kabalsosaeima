// Zero-latency client-side DOM filter and URL parameter synchronization
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

  function initFilter() {
    var searchInput = document.getElementById('filter-search');
    var stageSelect = document.getElementById('filter-stage');
    var categorySelect = document.getElementById('filter-category');
    var outcomeSelect = document.getElementById('filter-outcome');
    var tier1Toggle = document.getElementById('filter-tier1');
    var resetBtn = document.getElementById('filter-reset');
    var countEl = document.getElementById('filter-count');
    var emptyState = document.getElementById('filter-empty-state');
    var emptyResetBtn = document.getElementById('filter-empty-reset');
    var toggleBtn = document.getElementById('filter-toggle-btn');
    var filterPanel = document.getElementById('filter-panel');
    var filterBadge = document.getElementById('filter-badge');
    var cards = document.querySelectorAll('.vote-card');

    if (!cards.length) return;

    function applyFilter() {
      var query = searchInput ? normalizeText(searchInput.value) : '';
      var stage = stageSelect ? stageSelect.value : 'ALL';
      var category = categorySelect ? categorySelect.value : 'ALL';
      var outcome = outcomeSelect ? outcomeSelect.value : 'ALL';
      var tier1 = tier1Toggle ? tier1Toggle.getAttribute('data-active') === 'true' : false;

      var activeDrawerFilters = 0;
      if (stage !== 'ALL') activeDrawerFilters++;
      if (category !== 'ALL') activeDrawerFilters++;
      if (outcome !== 'ALL') activeDrawerFilters++;
      if (tier1) activeDrawerFilters++;

      if (filterBadge) {
        if (activeDrawerFilters > 0) {
          filterBadge.textContent = activeDrawerFilters;
          filterBadge.classList.remove('hidden');
        } else {
          filterBadge.classList.add('hidden');
        }
      }

      if (toggleBtn) {
        if (activeDrawerFilters > 0) {
          toggleBtn.classList.add('border-slate-800', 'bg-slate-100', 'font-semibold');
        } else {
          toggleBtn.classList.remove('border-slate-800', 'bg-slate-100', 'font-semibold');
        }
      }

      if (resetBtn) {
        if (query || activeDrawerFilters > 0) {
          resetBtn.classList.remove('hidden');
        } else {
          resetBtn.classList.add('hidden');
        }
      }

      var visible = 0;
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var cardTitle = normalizeText(card.getAttribute('data-title') || '');
        var cardStage = card.getAttribute('data-stage') || '';
        var cardCat = card.getAttribute('data-category') || '';
        var cardOutcome = card.getAttribute('data-outcome') || '';
        var cardTier1 = card.getAttribute('data-tier1') === 'true';

        var matchQuery = !query || cardTitle.indexOf(query) !== -1;
        var matchStage = stage === 'ALL' || cardStage === stage;
        var matchCat = category === 'ALL' || cardCat === category;
        var matchOutcome = outcome === 'ALL' || cardOutcome === outcome;
        var matchTier1 = !tier1 || cardTier1;

        if (matchQuery && matchStage && matchCat && matchOutcome && matchTier1) {
          card.classList.remove('hidden');
          visible++;
        } else {
          card.classList.add('hidden');
        }
      }

      if (countEl) {
        countEl.textContent = 'Atrasti ' + visible + ' ' + (visible === 1 ? 'balsojums' : 'balsojumi');
      }

      if (emptyState) {
        if (visible === 0) {
          emptyState.classList.remove('hidden');
        } else {
          emptyState.classList.add('hidden');
        }
      }

      // Sync URL query params without reloading
      var params = new URLSearchParams();
      if (query) params.set('q', searchInput.value);
      if (stage !== 'ALL') params.set('stage', stage);
      if (category !== 'ALL') params.set('category', category);
      if (outcome !== 'ALL') params.set('outcome', outcome);
      if (tier1) params.set('tier1', '1');

      var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState(null, '', newUrl);
    }

    function setTier1State(active) {
      if (!tier1Toggle) return;
      tier1Toggle.setAttribute('data-active', active ? 'true' : 'false');
      if (active) {
        tier1Toggle.classList.add('bg-slate-900', 'text-white');
        tier1Toggle.classList.remove('bg-white', 'text-slate-700', 'hover:text-slate-900');
      } else {
        tier1Toggle.classList.remove('bg-slate-900', 'text-white');
        tier1Toggle.classList.add('bg-white', 'text-slate-700', 'hover:text-slate-900');
      }
    }

    function resetAllFilters() {
      if (searchInput) searchInput.value = '';
      if (stageSelect) stageSelect.value = 'ALL';
      if (categorySelect) categorySelect.value = 'ALL';
      if (outcomeSelect) outcomeSelect.value = 'ALL';
      setTier1State(false);
      applyFilter();
    }

    // Restore from URL parameters
    var urlParams = new URLSearchParams(window.location.search);
    if (searchInput && urlParams.get('q')) searchInput.value = urlParams.get('q');
    if (stageSelect && urlParams.get('stage')) stageSelect.value = urlParams.get('stage');
    if (categorySelect && urlParams.get('category')) categorySelect.value = urlParams.get('category');
    if (outcomeSelect && urlParams.get('outcome')) outcomeSelect.value = urlParams.get('outcome');
    if (tier1Toggle && urlParams.get('tier1') === '1') {
      setTier1State(true);
    }

    // Auto-expand filter panel if URL params activate any drawer filter
    if (filterPanel && ((stageSelect && stageSelect.value !== 'ALL') || (categorySelect && categorySelect.value !== 'ALL') || (outcomeSelect && outcomeSelect.value !== 'ALL') || (tier1Toggle && tier1Toggle.getAttribute('data-active') === 'true'))) {
      filterPanel.classList.remove('hidden');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    }

    if (toggleBtn && filterPanel) {
      toggleBtn.addEventListener('click', function() {
        var isHidden = filterPanel.classList.contains('hidden');
        if (isHidden) {
          filterPanel.classList.remove('hidden');
          toggleBtn.setAttribute('aria-expanded', 'true');
        } else {
          filterPanel.classList.add('hidden');
          toggleBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (searchInput) searchInput.addEventListener('input', applyFilter);
    if (stageSelect) stageSelect.addEventListener('change', applyFilter);
    if (categorySelect) categorySelect.addEventListener('change', applyFilter);
    if (outcomeSelect) outcomeSelect.addEventListener('change', applyFilter);

    if (tier1Toggle) {
      tier1Toggle.addEventListener('click', function() {
        var active = tier1Toggle.getAttribute('data-active') === 'true';
        setTier1State(!active);
        applyFilter();
      });
    }

    if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAllFilters);

    applyFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilter);
  } else {
    initFilter();
  }
})();
