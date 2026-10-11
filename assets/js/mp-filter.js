// Zero-latency client-side MP filter and URL parameter synchronization
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
    var searchInput = document.getElementById('mp-filter-search');
    var factionSelect = document.getElementById('mp-filter-faction');
    var activeToggle = document.getElementById('mp-filter-active');
    var resetBtn = document.getElementById('mp-filter-reset');
    var countEl = document.getElementById('mp-filter-count');
    var emptyState = document.getElementById('mp-empty-state');
    var cards = document.querySelectorAll('.mp-card');

    if (!cards.length) return;

    function applyFilter() {
      var query = searchInput ? normalizeText(searchInput.value) : '';
      var faction = factionSelect ? factionSelect.value : 'ALL';
      var activeOnly = activeToggle ? activeToggle.getAttribute('data-active') === 'true' : false;

      var visible = 0;
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var cardName = normalizeText(card.getAttribute('data-name') || '');
        var cardFaction = card.getAttribute('data-faction') || '';
        var cardActive = card.getAttribute('data-active') === 'true';

        var matchQuery = !query || cardName.indexOf(query) !== -1;
        var matchFaction = faction === 'ALL' || cardFaction === faction;
        var matchActive = !activeOnly || cardActive;

        if (matchQuery && matchFaction && matchActive) {
          card.classList.remove('hidden');
          visible++;
        } else {
          card.classList.add('hidden');
        }
      }

      if (countEl) {
        if (activeOnly) {
          countEl.textContent = 'Atrasti ' + visible + ' ' + (visible === 1 ? 'aktīvs deputāts' : 'aktīvi deputāti');
        } else {
          countEl.textContent = 'Atrasti ' + visible + ' ' + (visible === 1 ? 'deputāts' : 'deputāti');
        }
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
      if (faction !== 'ALL') params.set('faction', faction);
      if (activeOnly) params.set('active', '1');

      var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
      window.history.replaceState(null, '', newUrl);
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
          activeToggle.setAttribute('data-active', 'false');
          activeToggle.classList.remove('bg-slate-900', 'text-white', 'border-slate-900');
          activeToggle.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
        }
        applyFilter();
      });
    }

    applyFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMpFilter);
  } else {
    initMpFilter();
  }
})();
