import { useState, useEffect, useMemo } from 'react';
import type { Vote, MP, Faction, SaeimaTerm } from './types';
import { isFinalDecisionVote } from './types';
import { Navbar } from './components/Navbar';
import { FilterBar, type VoteTypeFilter } from './components/FilterBar';
import { VoteCard } from './components/VoteCard';
import { HemicycleModal } from './components/HemicycleModal';
import { CivicInfoModal } from './components/CivicInfoModal';
import { Footer } from './components/Footer';
import { AlertCircle, Info, ChevronDown } from 'lucide-react';

const PAGE_SIZE = 30;

export function App() {
  const [terms, setTerms] = useState<SaeimaTerm[]>([
    { term: 14, label: "14. Saeima", years: "2022–2026", isActive: true, description: "Ievēlēta 2022. gada 1. oktobrī" },
    { term: 15, label: "15. Saeima", years: "2026–2030", isActive: false, description: "Vēlēšanas 2026. gada rudenī" }
  ]);
  const [selectedTerm, setSelectedTerm] = useState<number>(14);

  const [votes, setVotes] = useState<Vote[]>([]);
  const [mps, setMps] = useState<MP[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVote, setSelectedVote] = useState<Vote | null>(null);
  const [civicModalTab, setCivicModalTab] = useState<'about' | 'methodology' | 'data' | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedVoteType, setSelectedVoteType] = useState<VoteTypeFilter>('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState<'ALL' | 'PIENEMTS' | 'NORAIDITS' | 'NAV_KVORUMA'>('ALL');
  const [tier1Only, setTier1Only] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

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
        const [votesRes, mpsRes, factionsRes, termsRes] = await Promise.all([
          fetch(`./data/votes.json?v=${t}`, { cache: 'no-store' }),
          fetch(`./data/mps.json?v=${t}`, { cache: 'no-store' }),
          fetch(`./data/factions.json?v=${t}`, { cache: 'no-store' }),
          fetch(`./data/terms.json?v=${t}`, { cache: 'no-store' }),
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

        if (termsRes.ok) {
          const termsData = await termsRes.json();
          setTerms(termsData);
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
        const q = searchQuery.toLowerCase();
        const inTitle = v.simplifiedTitle.toLowerCase().includes(q);
        const inOfficial = v.officialTitle.toLowerCase().includes(q);
        const inBill = v.billNumber.toLowerCase().includes(q);
        const inSummary = v.summary.toLowerCase().includes(q);
        if (!inTitle && !inOfficial && !inBill && !inSummary) return false;
      }
      return true;
    });
  }, [termVotes, selectedVoteType, tier1Only, selectedOutcome, selectedCategory, searchQuery]);

  const visibleVotes = useMemo(() => {
    return filteredVotes.slice(0, visibleCount);
  }, [filteredVotes, visibleCount]);

  const activeTermObj = terms.find((t) => t.term === selectedTerm);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        totalVotesCount={termVotes.length}
        terms={terms}
        selectedTerm={selectedTerm}
        onSelectTerm={setSelectedTerm}
        latestSittingDate={termVotes[0]?.sittingDate}
        onOpenInfoModal={setCivicModalTab}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-3 sm:px-6 lg:px-8 space-y-3">
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
              onSelect={(v) => setSelectedVote(v)}
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
      </main>

      {/* Hemicycle Modal */}
      {selectedVote && (
        <HemicycleModal
          vote={selectedVote}
          mps={mps}
          factions={factions}
          onClose={() => setSelectedVote(null)}
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
