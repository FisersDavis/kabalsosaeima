import { useState, useEffect, useMemo } from 'react';
import type { Vote, MP, Faction, SaeimaTerm, SiteMetadata, ActiveNavTab, MpSummaryMap } from './types';
import { isFinalDecisionVote, parseLatvianDate, normalizeLatvianSearch } from './types';
import { Navbar } from './components/Navbar';
import { FilterBar, type VoteTypeFilter } from './components/FilterBar';
import { VoteCard } from './components/VoteCard';
import { HemicycleModal } from './components/HemicycleModal';
import { MpProfileModal } from './components/MpProfileModal';
import { CivicInfoModal } from './components/CivicInfoModal';
import { Footer } from './components/Footer';
import { AlertCircle, Info, ChevronDown } from 'lucide-react';
import { MpDirectoryView } from './components/MpDirectoryView';
import { IssueRadarView } from './components/IssueRadarView';

const PAGE_SIZE = 30;

export function App() {
  const [terms, setTerms] = useState<SaeimaTerm[]>([
    { term: 14, label: "14. Saeima", years: "2022–2026", isActive: true, description: "Ievēlēta 2022. gada 1. oktobrī" },
    { term: 15, label: "15. Saeima", years: "2026–2030", isActive: false, description: "Vēlēšanas 2026. gada rudenī" }
  ]);
  const [selectedTerm, setSelectedTerm] = useState<number>(14);
  const [activeTab, setActiveTab] = useState<ActiveNavTab>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash.toLowerCase();
      if (h.startsWith('#radars') || h.startsWith('#tematiskais-radars') || h.startsWith('#issues')) return 'issues';
      if (h === '#deputati' || h === '#partijas' || h === '#mps') return 'mps';
    }
    return 'votes';
  });

  const handleSelectTab = (tab: ActiveNavTab) => {
    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      if (tab === 'issues') window.location.hash = '#radars';
      else if (tab === 'mps') window.location.hash = '#deputati';
      else window.location.hash = '#balsojumi';
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      const h = window.location.hash.toLowerCase();
      if (h.startsWith('#radars') || h.startsWith('#tematiskais-radars') || h.startsWith('#issues')) {
        setActiveTab('issues');
      } else if (h === '#deputati' || h === '#partijas' || h === '#mps') {
        setActiveTab('mps');
      } else if (h === '#balsojumi' || h === '#votes') {
        setActiveTab('votes');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [votes, setVotes] = useState<Vote[]>([]);
  const [mps, setMps] = useState<MP[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [metadata, setMetadata] = useState<SiteMetadata | null>(null);
  const [mpSummaries, setMpSummaries] = useState<MpSummaryMap>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVote, setSelectedVote] = useState<Vote | null>(null);
  const [selectedMp, setSelectedMp] = useState<MP | null>(null);
  const [mpInitialTab, setMpInitialTab] = useState<'attendance' | 'cohesion' | 'history'>('attendance');
  const [returnToMpAfterVote, setReturnToMpAfterVote] = useState<{ mp: MP; tab: 'attendance' | 'cohesion' | 'history' } | null>(null);
  const [returnToVoteAfterMp, setReturnToVoteAfterMp] = useState<Vote | null>(null);
  const [civicModalTab, setCivicModalTab] = useState<'about' | 'methodology' | 'data' | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedVoteType, setSelectedVoteType] = useState<VoteTypeFilter>('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState<'ALL' | 'PIENEMTS' | 'NORAIDITS' | 'NAV_KVORUMA'>('ALL');
  const [tier1Only, setTier1Only] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // States for 'Partijas & Deputāti' directory
  const [mpSearch, setMpSearch] = useState<string>('');
  const [mpFactionFilter, setMpFactionFilter] = useState<string>('ALL');
  const [mpActiveOnly, setMpActiveOnly] = useState<boolean>(true);

  // Reset pagination when any filter changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, selectedCategory, selectedVoteType, selectedOutcome, tier1Only, selectedTerm]);

  // Load JSON datasets from public/data/
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const t = Date.now();
        const [votesRes, mpsRes, factionsRes, termsRes, metaRes, summariesRes] = await Promise.all([
          fetch(`./data/votes.json?v=${t}`, { cache: 'no-store' }),
          fetch(`./data/mps.json?v=${t}`, { cache: 'no-store' }),
          fetch(`./data/factions.json?v=${t}`, { cache: 'no-store' }),
          fetch(`./data/terms.json?v=${t}`, { cache: 'no-store' }),
          fetch(`./data/metadata.json?v=${t}`, { cache: 'no-store' }).catch(() => null),
          fetch(`./data/mp_summaries.json?v=${t}`, { cache: 'no-store' }).catch(() => null),
        ]);

        if (!votesRes.ok || !mpsRes.ok || !factionsRes.ok) {
          throw new Error('Neizdevās ielādēt Saeimas datus');
        }

        const [votesData, mpsData, factionsData] = await Promise.all([
          votesRes.json(),
          mpsRes.json(),
          factionsRes.json(),
        ]);

        setVotes(votesData);
        setMps(mpsData);
        setFactions(factionsData);

        if (summariesRes && summariesRes.ok) {
          const summariesData = await summariesRes.json();
          setMpSummaries(summariesData);
        }

        if (termsRes.ok) {
          const termsData = await termsRes.json();
          setTerms(termsData);
          // Edge Case 1: Dynamically auto-select active parliament term (e.g. 15. Saeima when elected)
          const activeTerm = termsData.find((t: SaeimaTerm) => t.isActive);
          if (activeTerm) {
            setSelectedTerm(activeTerm.term);
          }
        }

        if (metaRes && metaRes.ok) {
          const metaData = await metaRes.json();
          setMetadata(metaData);
        }
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Kļūda datu ielādē');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Filter votes for the currently selected Saeima term
  const termVotes = useMemo(() => {
    return votes.filter((v) => v.saeimaTerm === selectedTerm);
  }, [votes, selectedTerm]);

  // Extract unique categories for this term
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    termVotes.forEach((v) => {
      if (v.category?.id && v.category?.label) {
        map.set(v.category.id, v.category.label);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [termVotes]);

  // Filtered votes within the selected term using edge-case helpers
  const filteredVotes = useMemo(() => {
    return termVotes.filter((v) => {
      if (selectedVoteType !== 'ALL' && v.voteType !== selectedVoteType) return false;
      if (tier1Only && !isFinalDecisionVote(v)) return false;
      if (selectedOutcome !== 'ALL' && v.result !== selectedOutcome) return false;
      if (selectedCategory !== 'ALL' && v.category?.id !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = normalizeLatvianSearch(searchQuery);
        const inTitle = normalizeLatvianSearch(v.simplifiedTitle).includes(q);
        const inOfficial = normalizeLatvianSearch(v.officialTitle).includes(q);
        const inBill = normalizeLatvianSearch(v.billNumber).includes(q);
        const inSummary = normalizeLatvianSearch(v.summary).includes(q);
        if (!inTitle && !inOfficial && !inBill && !inSummary) return false;
      }
      return true;
    });
  }, [termVotes, selectedVoteType, tier1Only, selectedOutcome, selectedCategory, searchQuery]);

  const visibleVotes = useMemo(() => {
    return filteredVotes.slice(0, visibleCount);
  }, [filteredVotes, visibleCount]);

  const activeTermObj = terms.find((t) => t.term === selectedTerm);

  // Dynamically determine true latest sitting date chronologically
  const latestSittingDate = useMemo(() => {
    if (termVotes.length === 0) return metadata?.latestSittingDate;
    let maxTime = 0;
    let maxDateStr = '';
    for (const v of termVotes) {
      if (v.sittingDate) {
        const t = parseLatvianDate(v.sittingDate);
        if (t > maxTime) {
          maxTime = t;
          maxDateStr = v.sittingDate;
        }
      }
    }
    return maxDateStr || termVotes[0]?.sittingDate || metadata?.latestSittingDate;
  }, [termVotes, metadata]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        totalVotesCount={termVotes.length}
        terms={terms}
        selectedTerm={selectedTerm}
        onSelectTerm={setSelectedTerm}
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        latestSittingDate={latestSittingDate}
        lastSyncDate={metadata?.formattedSyncDate}
        onOpenInfoModal={setCivicModalTab}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-3 sm:px-6 lg:px-8 space-y-3">
        {/* TAB 1: Balsojumi Feed */}
        {activeTab === 'votes' && (
          <>
            {/* Future / Empty Term Notice */}
            {!loading && termVotes.length === 0 && (
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-6 flex items-start gap-4">
                <Info className="h-5 w-5 text-slate-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeTermObj?.label} vēl nav uzsākusi darbu
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Šī sasaukuma sēžu balsojumi tiks automātiski sinhronizēti no Saeimas atvērtajiem datiem, tiklīdz jaunais parlaments sanāks uz savu pirmo sēdi.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedTerm(14)}
                    className="mt-2 text-xs font-semibold text-slate-800 hover:underline"
                  >
                    Pārslēgties uz 14. Saeimu (2022–2026) →
                  </button>
                </div>
              </div>
            )}

            {/* Filter Controls (Consolidated 1-Row Toolbar) */}
            {termVotes.length > 0 && (
              <section className="sticky top-[57px] z-30 -mx-1 rounded-xl bg-white/95 p-2 shadow-2xs backdrop-blur-md border border-slate-200">
                <FilterBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  selectedVoteType={selectedVoteType}
                  onVoteTypeChange={setSelectedVoteType}
                  selectedOutcome={selectedOutcome}
                  onOutcomeChange={setSelectedOutcome}
                  categories={categories}
                  tier1Only={tier1Only}
                  onTier1Toggle={setTier1Only}
                  totalFiltered={filteredVotes.length}
                />
              </section>
            )}

            {/* Vote Cards Feed */}
            <section className="space-y-4">
              {loading && (
                <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                  <p className="mt-3 text-xs">Ielādē Saeimas sēžu datus...</p>
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
                  <AlertCircle className="mx-auto h-7 w-7 mb-2" />
                  <p className="text-xs font-medium">{error}</p>
                </div>
              )}

              {!loading && !error && termVotes.length > 0 && filteredVotes.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
                  <p className="text-sm font-semibold">Nav atrasts neviens balsojums</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Pamēģiniet mainīt meklēšanas vārdu vai noņemt kādu no filtriem.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('ALL');
                      setSelectedVoteType('ALL');
                      setSelectedOutcome('ALL');
                      setTier1Only(false);
                    }}
                    className="mt-3 rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                  >
                    Atiestatīt visus filtrus
                  </button>
                </div>
              )}

              {!loading && !error && visibleVotes.map((vote) => (
                <VoteCard
                  key={vote.id}
                  vote={vote}
                  onSelect={(v) => {
                    setReturnToMpAfterVote(null);
                    setReturnToVoteAfterMp(null);
                    setSelectedVote(v);
                  }}
                />
              ))}

              {/* Progressive Loading Trigger */}
              {!loading && !error && visibleCount < filteredVotes.length && (
                <div className="pt-2 pb-6 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-xs font-semibold text-slate-800 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition"
                  >
                    <ChevronDown className="h-4 w-4 text-slate-500" />
                    Rādīt vēl {PAGE_SIZE} balsojumus (atlikuši {filteredVotes.length - visibleCount})
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {/* TAB 2: Partijas un deputāti */}
        {activeTab === 'mps' && (
          <MpDirectoryView
            mps={mps}
            factions={factions}
            searchQuery={mpSearch}
            onSearchChange={setMpSearch}
            selectedFaction={mpFactionFilter}
            onFactionChange={setMpFactionFilter}
            activeOnly={mpActiveOnly}
            onActiveOnlyToggle={setMpActiveOnly}
            onSelectMp={(mp) => {
              setReturnToMpAfterVote(null);
              setReturnToVoteAfterMp(null);
              setMpInitialTab('attendance');
              setSelectedMp(mp);
            }}
            mpSummaries={mpSummaries}
          />
        )}

        {/* TAB 3: Tematiskais radars */}
        {activeTab === 'issues' && (
          <IssueRadarView
            votes={termVotes}
            factions={factions}
            onSelectVote={(vote) => {
              setSelectedVote(vote);
            }}
            onSelectCategory={(categoryId) => {
              setSelectedCategory(categoryId);
              setActiveTab('votes');
              if (typeof window !== 'undefined') {
                window.location.hash = '#balsojumi';
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* Hemicycle Modal */}
      {selectedVote && (
        <HemicycleModal
          vote={selectedVote}
          mps={mps}
          factions={factions}
          onClose={() => {
            setSelectedVote(null);
            if (returnToMpAfterVote) {
              setSelectedMp(returnToMpAfterVote.mp);
              setMpInitialTab(returnToMpAfterVote.tab);
              setReturnToMpAfterVote(null);
            }
          }}
          onSelectMp={(mp) => {
            setReturnToVoteAfterMp(selectedVote);
            setSelectedVote(null);
            setSelectedMp(mp);
            setMpInitialTab('attendance');
          }}
        />
      )}

      {/* MP Profile Dossier Modal */}
      {selectedMp && (
        <MpProfileModal
          mp={selectedMp}
          faction={factions.find((f) => f.id === selectedMp.factionId)}
          initialTab={mpInitialTab}
          onClose={() => {
            setSelectedMp(null);
            if (returnToVoteAfterMp) {
              setSelectedVote(returnToVoteAfterMp);
              setReturnToVoteAfterMp(null);
            }
          }}
          onSelectVote={(voteId, currentTab) => {
            const v = votes.find((item) => item.id === voteId);
            if (v && selectedMp) {
              setReturnToMpAfterVote({ mp: selectedMp, tab: currentTab });
              setSelectedMp(null);
              setSelectedVote(v);
            }
          }}
        />
      )}

      {/* Civic Information & Methodology Modal */}
      {civicModalTab && (
        <CivicInfoModal
          initialTab={civicModalTab}
          onClose={() => setCivicModalTab(null)}
        />
      )}

      <Footer />
    </div>
  );
}

export default App;
