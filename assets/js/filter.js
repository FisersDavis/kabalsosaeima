// Zero-latency client-side DOM filter, sticky header offset sync, URL parameter synchronization,
// and on-demand cross-page archive search via the official open-data /data/votes.json bundle.
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

  function syncStickyHeaderOffset() {
    var header = document.getElementById('site-header');
    if (!header) return;
    function update() {
      var h = Math.ceil(header.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty('--header-h', (h + 8) + 'px');
      }
    }
    update();
    window.addEventListener('resize', update);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(update).observe(header);
    }
  }

  function cleanVoteTitle(raw) {
    if (!raw) return '';
    var t = raw.trim()
      .replace(/^\s*Par\s+likumprojekta\s+/i, '')
      .replace(/^\s*Par\s+likumprojektu\s+/i, '')
      .replace(/^\s*Par\s+lēmuma\s+projektu\s+/i, '')
      .replace(/^\s*Par\s+lēmuma\s+/i, '')
      .replace(/^\s*Likumprojekts\s+/i, '')
      .replace(/^\s*Par\s+priekšlikumu\s+/i, '')
      .replace(/\s*\(\s*\d+\/[A-Za-z0-9]+\s*\)\s*$/, '')
      .trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : raw;
  }

  function cleanBillNr(raw) {
    return (raw || '').trim().replace(/^Nr\./i, '').replace(/^#/, '').trim();
  }

  function cleanBillSlug(billNumber) {
    return cleanBillNr(billNumber)
      .toLowerCase()
      .replace(/\//g, '-')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function meaningfulPurpose(purpose) {
    var s = (purpose || '').trim();
    if (!s) return '';
    if (s.indexOf('Saeimas izskatīts likumprojekts') === 0) return '';
    if (s.indexOf('Procedūras lēmums Saeimas sēdes gaitā') === 0) return '';
    if (s.indexOf('Priekšlikums likumprojektam') === 0) return '';
    return s;
  }

  function isFinalReadingVote(v) {
    if (!v || v.voteType !== 'likums') return false;
    if (v.reading === 3) return true;
    if (v.reading === 2 && v.isUrgent) return true;
    var stage = (v.readingStage || '').toLowerCase();
    return stage.indexOf('3. las') !== -1 || stage.indexOf('galīg') !== -1 || stage.indexOf('steidzam') !== -1;
  }

  function resultLabel(res) {
    if (res === 'PIENEMTS') return 'Pieņemts';
    if (res === 'NAV_KVORUMA') return 'Nav kvoruma';
    if (res === 'NORAIDITS') return 'Noraidīts';
    return res || '';
  }

  function resultBadgeClass(res) {
    if (res === 'PIENEMTS') return 'border-emerald-300 bg-emerald-50 text-emerald-800';
    if (res === 'NAV_KVORUMA') return 'border-amber-300 bg-amber-50 text-amber-900';
    if (res === 'NORAIDITS') return 'border-rose-300 bg-rose-50 text-rose-800';
    return 'border-slate-300 bg-slate-50 text-slate-800';
  }

  function decisionBadgeClass(dec) {
    if (dec === 'PAR') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (dec === 'PRET') return 'bg-rose-50 text-rose-700 border-rose-200';
    if (dec === 'ATTURAS') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 text-slate-600 border-slate-200';
  }

  function termUrl(basePath, path) {
    var bp = (basePath || '').replace(/\/+$/, '');
    if (!bp) return path;
    if (!path || path === '/') return bp + '/';
    return bp + (path.charAt(0) === '/' ? path : '/' + path);
  }

  function groupFactionDecisions(breakdowns) {
    var buckets = { PAR: [], PRET: [], ATTURAS: [], NEBALSOJA: [] };
    (breakdowns || []).forEach(function(fb) {
      var votes = fb.votes || {};
      var p = votes.par || 0;
      var pr = votes.pret || 0;
      var a = votes.atturas || 0;
      var n = votes.nebalso || 0;
      var maxActive = p;
      var best = 'PAR';
      if (pr > maxActive) { maxActive = pr; best = 'PRET'; }
      if (a > maxActive) { maxActive = a; best = 'ATTURAS'; }
      if (maxActive > 0) {
        buckets[best].push({ shortName: fb.shortName || fb.factionId, count: maxActive });
      } else if (n > 0) {
        buckets.NEBALSOJA.push({ shortName: fb.shortName || fb.factionId, count: n });
      }
    });
    var groups = [];
    ['PAR', 'PRET', 'ATTURAS', 'NEBALSOJA'].forEach(function(key) {
      if (buckets[key].length > 0) {
        groups.push({ decision: key, factions: buckets[key] });
      }
    });
    return groups;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function buildArchiveCard(v, basePath) {
    var article = el('article', 'rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition hover:border-slate-300 hover:shadow-xs space-y-2.5');

    // Eyebrow metadata
    var eyebrow = el('div', 'flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-medium tracking-wide');
    eyebrow.appendChild(el('span', 'font-mono text-slate-500', v.sittingDate || ''));

    if (v.readingStage && v.readingStage !== 'Darba kārtība' && v.readingStage !== 'Procedūra') {
      eyebrow.appendChild(el('span', '', '·'));
      eyebrow.appendChild(el('span', 'uppercase tracking-wider text-slate-600 text-[10px] font-semibold', v.readingStage));
    }
    if (v.billNumber) {
      eyebrow.appendChild(el('span', '', '·'));
      var billLink = el('a', 'font-mono text-slate-500 hover:text-emerald-700 hover:underline', 'Nr. ' + cleanBillNr(v.billNumber));
      billLink.href = termUrl(basePath, '/likumprojekti/' + cleanBillSlug(v.billNumber) + '/');
      billLink.title = 'Skatīt likumprojekta gaitu';
      eyebrow.appendChild(billLink);
    }
    if (v.category && v.category.label) {
      eyebrow.appendChild(el('span', '', '·'));
      eyebrow.appendChild(el('span', 'text-slate-500', v.category.label));
    }
    if (v.isUrgent) {
      eyebrow.appendChild(el('span', '', '·'));
      eyebrow.appendChild(el('span', 'font-semibold text-amber-700 uppercase tracking-wider text-[10px]', 'Steidzams'));
    }
    article.appendChild(eyebrow);

    // Title + outcome badge
    var header = el('div', 'flex items-start justify-between gap-3');
    var h3 = el('h3', 'text-base sm:text-lg font-bold leading-snug text-slate-900');
    var voteHref = termUrl(basePath, '/balsojumi/' + v.id + '/');
    var titleLink = el('a', 'hover:text-emerald-700 transition', cleanVoteTitle(v.simplifiedTitle || v.officialTitle || v.id));
    titleLink.href = voteHref;
    h3.appendChild(titleLink);
    header.appendChild(h3);

    var badge = el('span', 'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold shadow-2xs whitespace-nowrap shrink-0 ' + resultBadgeClass(v.result));
    badge.appendChild(document.createTextNode(resultLabel(v.result)));
    var counts = v.counts || {};
    if ((counts.par || 0) > 0 || (counts.pret || 0) > 0) {
      badge.appendChild(el('span', 'font-mono ml-2 text-[11px] font-semibold opacity-90 tabular-nums', (counts.par || 0) + ' : ' + (counts.pret || 0)));
    }
    header.appendChild(badge);
    article.appendChild(header);

    // Purpose context
    var ctx = meaningfulPurpose(v.purpose);
    if (ctx) {
      article.appendChild(el('p', 'text-xs sm:text-[13px] text-slate-600 leading-relaxed border-l-2 border-slate-300 pl-3 py-0.5', ctx));
    }

    // Faction stance breakdown
    var stanceGroups = groupFactionDecisions(v.factionBreakdown);
    if (stanceGroups.length > 0 && !v.isSecret) {
      var fbWrap = el('div', 'pt-2 border-t border-slate-100');
      var grid = el('div', 'text-xs ' + (stanceGroups.length > 1 ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5' : 'w-full'));
      stanceGroups.forEach(function(sg) {
        var row = el('div', 'flex items-start gap-2 min-w-0');
        row.appendChild(el('span', 'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border tracking-wider min-w-[50px] justify-center shrink-0 mt-0.5 ' + decisionBadgeClass(sg.decision), sg.decision));
        var list = el('div', 'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs leading-relaxed min-w-0');
        sg.factions.forEach(function(f, idx) {
          var item = el('span', 'text-slate-800 font-medium whitespace-nowrap');
          item.appendChild(document.createTextNode(f.shortName + ' '));
          item.appendChild(el('span', 'text-slate-500 font-mono text-[11px]', '(' + f.count + ')'));
          list.appendChild(item);
          if (idx < sg.factions.length - 1) {
            list.appendChild(el('span', 'text-slate-300', '·'));
          }
        });
        row.appendChild(list);
        grid.appendChild(row);
      });
      fbWrap.appendChild(grid);
      article.appendChild(fbWrap);
    }

    // Footer action link
    var footer = el('div', 'pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs');
    var detailLink = el('a', 'inline-flex items-center gap-1.5 font-semibold text-emerald-800 hover:text-emerald-950 transition', 'Skatīt sēžu zāli un likumprojekta gaitu →');
    detailLink.href = voteHref;
    footer.appendChild(detailLink);
    article.appendChild(footer);

    return article;
  }

  function initFilter() {
    syncStickyHeaderOffset();

    var root = document.getElementById('overview-feed-root');
    var basePath = root ? (root.getAttribute('data-base-path') || '') : '';
    var totalPages = root ? (parseInt(root.getAttribute('data-total-pages') || '1', 10) || 1) : 1;
    var totalVotes = root ? (parseInt(root.getAttribute('data-total-votes') || '0', 10) || 0) : 0;

    var searchInput = document.getElementById('filter-search');
    var stageSelect = document.getElementById('filter-stage');
    var categorySelect = document.getElementById('filter-category');
    var outcomeSelect = document.getElementById('filter-outcome');
    var tier1Toggle = document.getElementById('filter-tier1');
    var resetBtn = document.getElementById('filter-reset');
    var countEl = document.getElementById('filter-count');
    var archiveStatusEl = document.getElementById('filter-archive-status');
    var archiveResultsEl = document.getElementById('filter-archive-results');
    var staticFeedEl = document.getElementById('static-vote-feed');
    var staticPaginationEl = document.getElementById('static-pagination');
    var emptyState = document.getElementById('filter-empty-state');
    var emptyResetBtn = document.getElementById('filter-empty-reset');
    var toggleBtn = document.getElementById('filter-toggle-btn');
    var filterPanel = document.getElementById('filter-panel');
    var filterBadge = document.getElementById('filter-badge');
    var loadMoreWrap = document.getElementById('filter-load-more-wrap');
    var loadMoreBtn = document.getElementById('filter-load-more');
    var loadMoreText = document.getElementById('filter-load-more-text');
    var cards = document.querySelectorAll('.vote-card');

    if (!cards.length) return;

    var PAGE_SIZE = 50;
    var visibleLimit = PAGE_SIZE;

    // On-demand full-archive cache for multi-page terms (uses official /data/votes.json, no redundant index)
    var archiveVotes = null;
    var archiveLoading = false;
    var archiveFailed = false;
    var lastArchiveMatches = [];

    function setArchiveStatus(msg, isError) {
      if (!archiveStatusEl) return;
      if (!msg) {
        archiveStatusEl.textContent = '';
        archiveStatusEl.classList.add('hidden');
        return;
      }
      archiveStatusEl.textContent = msg;
      archiveStatusEl.classList.remove('hidden', 'text-emerald-700', 'text-amber-700');
      archiveStatusEl.classList.add(isError ? 'text-amber-700' : 'text-emerald-700');
    }

    function ensureArchiveLoaded() {
      if (archiveVotes !== null || archiveLoading || archiveFailed || totalPages <= 1) return;
      archiveLoading = true;
      setArchiveStatus('Meklē visos ' + totalVotes + ' sasaukuma balsojumos...', false);
      var url = termUrl(basePath, '/data/votes.json');
      fetch(url)
        .then(function(resp) {
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          return resp.json();
        })
        .then(function(list) {
          archiveLoading = false;
          if (!Array.isArray(list)) {
            archiveFailed = true;
            setArchiveStatus('Meklēts tikai šajā lapā (' + cards.length + ' no ' + totalVotes + ' balsojumiem)', true);
            return;
          }
          // Pre-normalize search text once per vote for instant subsequent keystrokes
          archiveVotes = list.map(function(v) {
            return {
              vote: v,
              searchNorm: normalizeText([v.simplifiedTitle, v.officialTitle, v.billNumber, v.summary, v.purpose].join(' ')),
              stage: v.voteType || '',
              cat: (v.category && v.category.id) ? v.category.id : '',
              outcome: v.result || '',
              tier1: isFinalReadingVote(v)
            };
          });
          applyFilter(true);
        })
        .catch(function() {
          archiveLoading = false;
          archiveFailed = true;
          setArchiveStatus('Meklēts tikai šajā lapā (' + cards.length + ' no ' + totalVotes + ' balsojumiem)', true);
        });
    }

    function renderArchiveResults(matches) {
      if (!archiveResultsEl) return;
      archiveResultsEl.innerHTML = '';
      var shown = Math.min(visibleLimit, matches.length);
      var frag = document.createDocumentFragment();
      for (var i = 0; i < shown; i++) {
        frag.appendChild(buildArchiveCard(matches[i].vote, basePath));
      }
      archiveResultsEl.appendChild(frag);
      archiveResultsEl.classList.remove('hidden');
      if (staticFeedEl) staticFeedEl.classList.add('hidden');
      if (staticPaginationEl) staticPaginationEl.classList.add('hidden');

      if (countEl) {
        var suffix = (matches.length % 10 === 1 && matches.length % 100 !== 11 ? 'balsojums' : 'balsojumi');
        if (shown < matches.length) {
          countEl.textContent = 'Rādīti ' + shown + ' no ' + matches.length + ' ' + suffix + ' (visā sasaukumā)';
        } else {
          countEl.textContent = 'Atrasti ' + matches.length + ' ' + suffix + ' (visā sasaukumā)';
        }
      }

      if (loadMoreWrap && loadMoreText) {
        var remaining = matches.length - shown;
        if (remaining > 0) {
          var nextBatch = Math.min(PAGE_SIZE, remaining);
          loadMoreText.textContent = 'Rādīt vēl ' + nextBatch + ' (atlikuši ' + remaining + ')';
          loadMoreWrap.classList.remove('hidden');
        } else {
          loadMoreWrap.classList.add('hidden');
        }
      }

      if (emptyState) {
        if (matches.length === 0) {
          emptyState.classList.remove('hidden');
        } else {
          emptyState.classList.add('hidden');
        }
      }
    }

    function applyFilter(resetLimit) {
      if (resetLimit !== false) {
        visibleLimit = PAGE_SIZE;
      }

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

      var hasAnyFilter = Boolean(query) || activeDrawerFilters > 0;

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
        if (hasAnyFilter) {
          resetBtn.classList.remove('hidden');
        } else {
          resetBtn.classList.add('hidden');
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

      // Multi-page full archive search path when any filter/query is active
      if (totalPages > 1 && hasAnyFilter) {
        if (archiveVotes !== null) {
          setArchiveStatus('Meklēts visos ' + archiveVotes.length + ' balsojumos', false);
          var matches = [];
          for (var a = 0; a < archiveVotes.length; a++) {
            var item = archiveVotes[a];
            if (query && item.searchNorm.indexOf(query) === -1) continue;
            if (stage !== 'ALL' && item.stage !== stage) continue;
            if (category !== 'ALL' && item.cat !== category) continue;
            if (outcome !== 'ALL' && item.outcome !== outcome) continue;
            if (tier1 && !item.tier1) continue;
            matches.push(item);
          }
          lastArchiveMatches = matches;
          renderArchiveResults(matches);
          return;
        } else if (!archiveFailed) {
          ensureArchiveLoaded();
        } else {
          setArchiveStatus('Meklēts tikai šajā lapā (' + cards.length + ' no ' + totalVotes + ' balsojumiem)', true);
        }
      } else {
        setArchiveStatus('', false);
        lastArchiveMatches = [];
        if (archiveResultsEl) {
          archiveResultsEl.classList.add('hidden');
          archiveResultsEl.innerHTML = '';
        }
        if (staticFeedEl) staticFeedEl.classList.remove('hidden');
        if (staticPaginationEl) staticPaginationEl.classList.remove('hidden');
      }

      // Fast DOM-only filter path (all single-page terms, unfiltered pagination browsing, or while archive JSON loads)
      var matched = 0;
      var shown = 0;
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
          matched++;
          if (shown < visibleLimit) {
            card.classList.remove('hidden');
            shown++;
          } else {
            card.classList.add('hidden');
          }
        } else {
          card.classList.add('hidden');
        }
      }

      if (countEl) {
        var suffix = (matched % 10 === 1 && matched % 100 !== 11 ? 'balsojums' : 'balsojumi');
        if (shown < matched) {
          countEl.textContent = 'Rādīti ' + shown + ' no ' + matched + ' ' + suffix;
        } else {
          countEl.textContent = 'Atrasti ' + matched + ' ' + suffix;
        }
      }

      if (loadMoreWrap && loadMoreText) {
        var remaining = matched - shown;
        if (remaining > 0) {
          var nextBatch = Math.min(PAGE_SIZE, remaining);
          loadMoreText.textContent = 'Rādīt vēl ' + nextBatch + ' (atlikuši ' + remaining + ')';
          loadMoreWrap.classList.remove('hidden');
        } else {
          loadMoreWrap.classList.add('hidden');
        }
      }

      if (emptyState) {
        if (matched === 0) {
          emptyState.classList.remove('hidden');
        } else {
          emptyState.classList.add('hidden');
        }
      }
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
      applyFilter(true);
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

    if (searchInput) searchInput.addEventListener('input', function() { applyFilter(true); });
    if (stageSelect) stageSelect.addEventListener('change', function() { applyFilter(true); });
    if (categorySelect) categorySelect.addEventListener('change', function() { applyFilter(true); });
    if (outcomeSelect) outcomeSelect.addEventListener('change', function() { applyFilter(true); });

    if (tier1Toggle) {
      tier1Toggle.addEventListener('click', function() {
        var active = tier1Toggle.getAttribute('data-active') === 'true';
        setTier1State(!active);
        applyFilter(true);
      });
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', function() {
        visibleLimit += PAGE_SIZE;
        if (archiveResultsEl && !archiveResultsEl.classList.contains('hidden')) {
          renderArchiveResults(lastArchiveMatches);
        } else {
          applyFilter(false);
        }
      });
    }

    if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
    if (emptyResetBtn) emptyResetBtn.addEventListener('click', resetAllFilters);

    applyFilter(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilter);
  } else {
    initFilter();
  }
})();
