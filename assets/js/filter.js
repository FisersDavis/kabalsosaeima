// Zero-latency client-side DOM filter, URL parameter synchronization,
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

  function isLvSingular(n) {
    return n % 10 === 1 && n % 100 !== 11;
  }

  function formatFoundCount(shown, total, isFiltered, isArchive) {
    var suffix = isArchive ? ' (visā sasaukumā)' : '';
    if (!isFiltered && shown >= total) {
      return total + (isLvSingular(total) ? ' balsojums' : ' balsojumi');
    }
    if (shown < total) {
      var shownVerb = isLvSingular(shown) ? 'Rādīts ' : 'Rādīti ';
      var totalNoun = isLvSingular(total) ? ' balsojuma' : ' balsojumiem';
      return shownVerb + shown + ' no ' + total + totalNoun + suffix;
    }
    var foundVerb = isLvSingular(total) ? 'Atrasts ' : 'Atrasti ';
    var noun = isLvSingular(total) ? ' balsojums' : ' balsojumi';
    return foundVerb + total + noun + suffix;
  }

  function formatRemaining(n) {
    return (isLvSingular(n) ? 'atlicis ' : 'atlikuši ') + n;
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

  function displayReadingStage(v) {
    var stage = (v && v.readingStage ? v.readingStage : '').trim();
    if (!stage) return '';
    if (stage.toLowerCase() === 'likuma pieņemšana' && (v.billNumber || '').toLowerCase().indexOf('/lm') !== -1) {
      return 'Saeimas lēmums';
    }
    return stage;
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

  function decisionLabel(dec) {
    var d = (dec || '').toUpperCase().trim();
    if (d === 'PAR') return 'PAR';
    if (d === 'PRET') return 'PRET';
    if (d === 'ATTURAS') return 'ATTURAS';
    if (d === 'NEBALSO') return 'NEBALSOJA';
    return 'NAV REĢISTRĒTS';
  }

  function termUrl(basePath, path) {
    var bp = (basePath || '').replace(/\/+$/, '');
    if (!bp) return path;
    if (!path || path === '/') return bp + '/';
    return bp + (path.charAt(0) === '/' ? path : '/' + path);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  var LV_MONTHS = ['', 'janv.', 'febr.', 'marts', 'apr.', 'maijs', 'jūn.', 'jūl.', 'aug.', 'sept.', 'okt.', 'nov.', 'dec.'];
  function formatLatvianDate(raw) {
    var s = (raw || '').trim();
    var m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) {
      var mo = parseInt(m[2], 10);
      if (mo >= 1 && mo <= 12) return parseInt(m[1], 10) + '. ' + LV_MONTHS[mo] + ' ' + m[3];
    }
    var m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m2) {
      var mo2 = parseInt(m2[2], 10);
      if (mo2 >= 1 && mo2 <= 12) return parseInt(m2[3], 10) + '. ' + LV_MONTHS[mo2] + ' ' + m2[1];
    }
    return s;
  }

  function resultTextClass(res) {
    if (res === 'PIENEMTS') return 'text-emerald-800';
    if (res === 'NAV_KVORUMA') return 'text-amber-800';
    if (res === 'NORAIDITS') return 'text-rose-800';
    return 'text-neutral-700';
  }

  function selectHasValue(selectEl, value) {
    if (!selectEl || value === null || value === undefined) return false;
    for (var i = 0; i < selectEl.options.length; i++) {
      if (selectEl.options[i].value === value) return true;
    }
    return false;
  }

  function buildProportionalBar(par, pret, att, neb, total, heightClass, withTitles) {
    var bar = el('div', 'w-full ' + heightClass + ' bg-neutral-100 overflow-hidden flex');
    if (par > 0) {
      var s1 = el('div', 'bg-emerald-700 h-full');
      s1.style.width = (par * 100 / total).toFixed(1) + '%';
      if (withTitles) s1.title = 'Par: ' + par;
      bar.appendChild(s1);
    }
    if (pret > 0) {
      var s2 = el('div', 'bg-rose-700 h-full');
      s2.style.width = (pret * 100 / total).toFixed(1) + '%';
      if (withTitles) s2.title = 'Pret: ' + pret;
      bar.appendChild(s2);
    }
    if (att > 0) {
      var s3 = el('div', 'bg-amber-600 h-full');
      s3.style.width = (att * 100 / total).toFixed(1) + '%';
      if (withTitles) s3.title = 'Atturas: ' + att;
      bar.appendChild(s3);
    }
    if (neb > 0) {
      var s4 = el('div', 'bg-neutral-300 h-full');
      s4.style.width = (neb * 100 / total).toFixed(1) + '%';
      if (withTitles) s4.title = 'Nebalsoja: ' + neb;
      bar.appendChild(s4);
    }
    return bar;
  }

  function buildArchiveCard(v, basePath) {
    var counts = v.counts || {};
    var par = counts.par || 0;
    var pret = counts.pret || 0;
    var att = counts.atturas || 0;
    var neb = counts.nebalso || 0;
    var total = par + pret + att + neb || 100;
    var voteHref = termUrl(basePath, '/balsojumi/' + v.id + '/');
    var stageLabel = displayReadingStage(v);

    var article = el('article', 'grid grid-cols-1 md:grid-cols-[120px_1fr_176px] gap-y-2 md:gap-x-7 py-6 transition');

    // Left column: date + desktop status tags + mobile outcome
    var left = el('div', 'flex items-center justify-between md:flex-col md:items-start md:justify-start md:pt-1 gap-2');
    left.appendChild(el('time', 'text-xs text-neutral-600 tabular-nums whitespace-nowrap', formatLatvianDate(v.sittingDate)));
    var mobRes = el('div', 'flex md:hidden items-center gap-2 text-xs tabular-nums');
    mobRes.appendChild(el('span', 'font-semibold uppercase tracking-wider text-[11px] ' + resultTextClass(v.result), resultLabel(v.result)));
    if (par > 0 || pret > 0) {
      mobRes.appendChild(el('span', 'text-neutral-800 font-semibold', par + ' : ' + pret));
    }
    left.appendChild(mobRes);
    if (v.isUrgent) {
      left.appendChild(el('span', 'hidden md:inline-block text-[10px] font-semibold uppercase tracking-wider text-amber-800 mt-1', 'Steidzams'));
    }
    if (v.isSecret) {
      left.appendChild(el('span', 'hidden md:inline-block text-[10px] font-medium text-neutral-600 mt-1', 'Aizklāts balsojums'));
    }
    article.appendChild(left);

    // Center column: eyebrow + serif title + summary + deviations + mobile bar
    var center = el('div', 'min-w-0 space-y-2');
    var eyebrow = el('div', 'flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-neutral-600');
    if (stageLabel) {
      var isProcedural = (stageLabel === 'Darba kārtība' || stageLabel === 'Procedūra');
      eyebrow.appendChild(el('span', isProcedural ? 'font-medium uppercase tracking-wider text-neutral-600' : 'font-semibold uppercase tracking-wider text-neutral-900', stageLabel));
    }
    if (v.category && v.category.label) {
      eyebrow.appendChild(el('span', 'whitespace-nowrap', v.category.label));
    }
    if (v.billNumber) {
      var billLink = el('a', 'tabular-nums whitespace-nowrap hover:text-neutral-950 hover:underline underline-offset-2 transition', 'Nr. ' + cleanBillNr(v.billNumber));
      billLink.href = termUrl(basePath, '/likumprojekti/' + cleanBillSlug(v.billNumber) + '/');
      billLink.title = 'Skatīt likumprojekta gaitu';
      eyebrow.appendChild(billLink);
    }
    if (v.isUrgent) {
      eyebrow.appendChild(el('span', 'md:hidden font-semibold uppercase tracking-wider text-amber-800 whitespace-nowrap', 'Steidzams'));
    }
    if (v.isSecret) {
      eyebrow.appendChild(el('span', 'md:hidden font-medium text-neutral-600 whitespace-nowrap', 'Aizklāts'));
    }
    center.appendChild(eyebrow);

    var h2 = el('h2', 'font-serif text-[20px] sm:text-[22px] font-semibold leading-[1.26] tracking-[-0.01em] text-neutral-950');
    var titleLink = el('a', 'hover:underline decoration-1 underline-offset-4 decoration-neutral-400 transition', cleanVoteTitle(v.simplifiedTitle || v.officialTitle || v.id));
    titleLink.href = voteHref;
    h2.appendChild(titleLink);
    center.appendChild(h2);

    var ctx = meaningfulPurpose(v.purpose);
    if (ctx) {
      center.appendChild(el('p', 'text-sm text-neutral-600 leading-relaxed line-clamp-2', ctx));
    }

    // Deviations line (matching SSR overview.templ)
    var devItems = [];
    (v.factionBreakdown || []).forEach(function(fb) {
      (fb.deviatingMps || []).forEach(function(d) {
        devItems.push({ mp: d, fShort: fb.shortName || fb.factionId || '' });
      });
    });
    if (devItems.length > 0) {
      var devDiv = el('div', 'pt-0.5 text-xs text-neutral-600');
      devDiv.appendChild(el('span', 'font-medium text-neutral-800', '✦ Novirzes no frakcijas (' + devItems.length + '): '));
      devItems.forEach(function(item, idx) {
        var mpLink = el('a', 'text-neutral-900 underline underline-offset-2 decoration-neutral-400 hover:decoration-neutral-950 transition', item.mp.name || item.mp.mpId);
        mpLink.href = termUrl(basePath, '/deputati/' + (item.mp.slug || item.mp.mpId) + '/');
        devDiv.appendChild(mpLink);
        devDiv.appendChild(el('span', 'text-neutral-600', ' (' + item.fShort + ' ' + decisionLabel(item.mp.decision).toLowerCase() + ')'));
        if (idx < devItems.length - 1) {
          var sep = el('span', 'text-neutral-400', ' · ');
          sep.setAttribute('aria-hidden', 'true');
          devDiv.appendChild(sep);
        }
      });
      center.appendChild(devDiv);
    }

    // Mobile slim proportional bar (matching SSR overview.templ)
    var mobBarWrap = el('div', 'md:hidden pt-1');
    mobBarWrap.appendChild(buildProportionalBar(par, pret, att, neb, total, 'h-1', false));
    center.appendChild(mobBarWrap);

    article.appendChild(center);

    // Right column: outcome + tally + bar + CTA
    var right = el('div', 'hidden md:flex flex-col justify-start gap-2.5 pt-1 pl-4 border-l border-neutral-100');
    var rTop = el('div', 'space-y-2');
    var rRow = el('div', 'flex items-baseline justify-between gap-2');
    rRow.appendChild(el('span', 'text-[11px] font-bold uppercase tracking-wider ' + resultTextClass(v.result), resultLabel(v.result)));
    if (par > 0 || pret > 0) {
      rRow.appendChild(el('span', 'text-sm font-semibold text-neutral-950 tabular-nums', par + ' : ' + pret));
    }
    rTop.appendChild(rRow);
    rTop.appendChild(buildProportionalBar(par, pret, att, neb, total, 'h-1.5', true));
    rTop.appendChild(el('div', 'text-[11px] text-neutral-600 tabular-nums', par + ' par · ' + pret + ' pret' + (att > 0 ? ' · ' + att + ' att.' : '')));
    right.appendChild(rTop);

    var detailLink = el('a', 'text-xs font-medium text-neutral-600 hover:text-neutral-950 transition pt-1', 'Skatīt balsojumu →');
    detailLink.href = voteHref;
    right.appendChild(detailLink);
    article.appendChild(right);

    return article;
  }

  function initFilter() {
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
    var searchDebounceTimer = null;

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
      archiveStatusEl.classList.remove('hidden', 'text-emerald-800', 'text-amber-800');
      archiveStatusEl.classList.add(isError ? 'text-amber-800' : 'text-emerald-800');
    }

    function ensureArchiveLoaded() {
      if (archiveVotes !== null || archiveLoading || archiveFailed || totalPages <= 1) return;
      archiveLoading = true;
      setArchiveStatus('Ielādē un meklē visos ' + totalVotes + ' sasaukuma balsojumos...', false);
      if (emptyState) emptyState.classList.add('hidden');
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
            applyFilter(true);
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
          applyFilter(true);
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
        countEl.textContent = formatFoundCount(shown, matches.length, true, true);
      }

      if (loadMoreWrap && loadMoreText) {
        var remaining = matches.length - shown;
        if (remaining > 0) {
          var nextBatch = Math.min(PAGE_SIZE, remaining);
          loadMoreText.textContent = 'Rādīt vēl ' + nextBatch + ' (' + formatRemaining(remaining) + ')';
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
          toggleBtn.classList.add('border-neutral-950', 'bg-neutral-100', 'font-semibold');
          toggleBtn.classList.remove('border-neutral-300', 'bg-white', 'font-medium');
        } else {
          toggleBtn.classList.remove('border-neutral-950', 'bg-neutral-100', 'font-semibold');
          toggleBtn.classList.add('border-neutral-300', 'bg-white', 'font-medium');
        }
      }

      if (resetBtn) {
        if (hasAnyFilter) {
          resetBtn.classList.remove('hidden');
        } else {
          resetBtn.classList.add('hidden');
        }
      }

      // Sync URL query params without reloading (preserving hash)
      var params = new URLSearchParams();
      if (query) params.set('q', searchInput.value);
      if (stage !== 'ALL') params.set('stage', stage);
      if (category !== 'ALL') params.set('category', category);
      if (outcome !== 'ALL') params.set('outcome', outcome);
      if (tier1) params.set('tier1', '1');
      var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + (window.location.hash || '');
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
          // While archive loads, avoid flashing a premature empty state
          if (staticPaginationEl) staticPaginationEl.classList.add('hidden');
          if (loadMoreWrap) loadMoreWrap.classList.add('hidden');
          if (emptyState) emptyState.classList.add('hidden');
          return;
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

      // Fast DOM-only filter path (single-page terms, unfiltered browsing, or fallback)
      var matched = 0;
      var shown = 0;
      var useClientLimit = (totalPages <= 1);
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
          if (!useClientLimit || shown < visibleLimit) {
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
        countEl.textContent = formatFoundCount(shown, matched, hasAnyFilter, false);
      }

      if (loadMoreWrap && loadMoreText) {
        var remaining = matched - shown;
        if (useClientLimit && remaining > 0) {
          var nextBatch = Math.min(PAGE_SIZE, remaining);
          loadMoreText.textContent = 'Rādīt vēl ' + nextBatch + ' (' + formatRemaining(remaining) + ')';
          loadMoreWrap.classList.remove('hidden');
        } else {
          loadMoreWrap.classList.add('hidden');
        }
      }

      if (emptyState) {
        if (matched === 0 && !archiveLoading) {
          emptyState.classList.remove('hidden');
        } else {
          emptyState.classList.add('hidden');
        }
      }
    }

    function setTier1State(active) {
      if (!tier1Toggle) return;
      tier1Toggle.setAttribute('data-active', active ? 'true' : 'false');
      tier1Toggle.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) {
        tier1Toggle.classList.add('bg-neutral-950', 'text-white', 'border-neutral-950');
        tier1Toggle.classList.remove('bg-white', 'text-neutral-700', 'border-neutral-300');
      } else {
        tier1Toggle.classList.remove('bg-neutral-950', 'text-white', 'border-neutral-950');
        tier1Toggle.classList.add('bg-white', 'text-neutral-700', 'border-neutral-300');
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

    // Restore from URL parameters (validating <select> values against actual options)
    var urlParams = new URLSearchParams(window.location.search);
    if (searchInput && urlParams.get('q')) searchInput.value = urlParams.get('q');
    if (stageSelect && selectHasValue(stageSelect, urlParams.get('stage'))) stageSelect.value = urlParams.get('stage');
    if (categorySelect && selectHasValue(categorySelect, urlParams.get('category'))) categorySelect.value = urlParams.get('category');
    if (outcomeSelect && selectHasValue(outcomeSelect, urlParams.get('outcome'))) outcomeSelect.value = urlParams.get('outcome');
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

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(function() {
          applyFilter(true);
        }, 150);
      });
    }
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
