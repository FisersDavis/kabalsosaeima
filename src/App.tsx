import { useState, useEffect, useMemo } from 'react';
import type { Vote, MP, Faction, SaeimaTerm } from './types';
import { isFinalDecisionVote } from './types';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { VoteCard } from './components/VoteCard';
import { HemicycleModal } from './components/HemicycleModal';
import { Footer } from './components/Footer';
import { BookOpen, AlertCircle, Info } from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedOutcome, setSelectedOutcome] = useState<'ALL' | 'PIENEMTS' | 'NORAIDITS' | 'NAV_KVORUMA'>('ALL');
  const [tier1Only, setTier1Only] = useState<boolean>(true);

  // Load JSON datasets from public/data/
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [votesRes, mpsRes, factionsRes, termsRes] = await Promise.all([
          fetch('./data/votes.json'),
          fetch('./data/mps.json'),
          fetch('./data/factions.json'),
          fetch('./data/terms.json'),
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
  }, [termVotes, tier1Only, selectedOutcome, selectedCategory, searchQuery]);

  const activeTermObj = terms.find((t) => t.term === selectedTerm);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar
        totalVotesCount={termVotes.length}
        terms={terms}
        selectedTerm={selectedTerm}
        onSelectTerm={setSelectedTerm}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Sober Civic Header (Valsts pārvaldes & LSM stils) */}
        <section className="rounded-xl border border-slate-200/90 bg-white p-6 shadow-sm">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200">
              <BookOpen className="h-3.5 w-3.5 text-slate-500" />
              <span>{activeTermObj?.label || `${selectedTerm}. Saeima`} ({activeTermObj?.years}) · Balsojumu reģistrs</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Saeimas plenārsēžu balsojumu pārskats
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Atvērts, neitrāls parlamenta lēmumu reģistrs. Pārbaudiet pieņemtos likumus, salīdziniet koalīcijas un opozīcijas nostāju un aplūkojiet katra no 100 deputātiem reģistrēto balsojumu.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-4 border-t border-slate-100 font-mono text-xs">
            <div>
              <div className="text-slate-500 text-[11px]">Pēdējā reģistrētā sēde</div>
              <div className="font-semibold text-slate-900">
                {termVotes.length > 0 ? termVotes[0].sittingDate : 'Nav datu'}
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">Pieņemtie likumi</div>
              <div className="font-semibold text-emerald-700">
                {termVotes.filter((v) => v.result === 'PIENEMTS').length} likumprojekti
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">Noraidīti / Nav kvoruma</div>
              <div className="font-semibold text-red-700">
                {termVotes.filter((v) => v.result === 'NORAIDITS' || v.result === 'NAV_KVORUMA').length} lēmumi
              </div>
            </div>
            <div>
              <div className="text-slate-500 text-[11px]">Saeimas sastāvs</div>
              <div className="font-semibold text-slate-900">100 deputāti</div>
            </div>
          </div>
        </section>

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

        {/* Filter Controls */}
        {termVotes.length > 0 && (
          <section className="sticky top-14 z-30 -mx-2 rounded-xl bg-white/95 p-3.5 shadow-sm backdrop-blur border border-slate-200/90">
            <FilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
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
                  setSelectedOutcome('ALL');
                  setTier1Only(false);
                }}
                className="mt-3 rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                Atiestatīt visus filtrus
              </button>
            </div>
          )}

          {!loading && !error && filteredVotes.map((vote) => (
            <VoteCard
              key={vote.id}
              vote={vote}
              onSelect={(v) => setSelectedVote(v)}
            />
          ))}
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

      <Footer />
    </div>
  );
}

export default App;
