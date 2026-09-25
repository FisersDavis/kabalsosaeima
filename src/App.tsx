import { useState, useEffect, useMemo } from 'react';
import type { Vote, MP, Faction, SaeimaTerm } from './types';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { VoteCard } from './components/VoteCard';
import { HemicycleModal } from './components/HemicycleModal';
import { Footer } from './components/Footer';
import { Sparkles, AlertCircle, Info } from 'lucide-react';

export function App() {
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

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
  const [selectedOutcome, setSelectedOutcome] = useState<'ALL' | 'PIENEMTS' | 'NORAIDITS'>('ALL');
  const [tier1Only, setTier1Only] = useState<boolean>(true);

  // Sync dark mode class on html tag
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

  // Filtered votes within the selected term
  const filteredVotes = useMemo(() => {
    return termVotes.filter((v) => {
      if (tier1Only && !v.isTier1) return false;
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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        totalVotesCount={termVotes.length}
        terms={terms}
        selectedTerm={selectedTerm}
        onSelectTerm={setSelectedTerm}
      />

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white to-slate-50/50 p-6 sm:p-8 shadow-sm dark:border-slate-800/90 dark:from-slate-900 dark:to-slate-950">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{activeTermObj?.label || `${selectedTerm}. Saeima`} ({activeTermObj?.years})</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Kā deputāti balso par likumiem?
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Pārskati {selectedTerm}. Saeimas pieņemtos un noraidītos likumprojektus, salīdzini frakciju balsojumus un apskati katra no 100 deputātiem individuālo nostāju interaktīvā sēžu zāles kartē.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-6 border-t border-slate-200/70 dark:border-slate-800/70">
            <div>
              <div className="text-xs text-slate-400">Pēdējā reģistrētā sēde</div>
              <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                {termVotes.length > 0 ? termVotes[0].sittingDate : 'Nav datu'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Pieņemtie likumi</div>
              <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {termVotes.filter((v) => v.result === 'PIENEMTS').length} likumprojekti
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Noraidītie priekšlikumi</div>
              <div className="text-sm font-bold font-mono text-rose-600 dark:text-rose-400">
                {termVotes.filter((v) => v.result === 'NORAIDITS').length} lēmumi
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Pārstāvētie deputāti</div>
              <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">100 / 100 deputāti</div>
            </div>
          </div>
        </section>

        {/* Future / Empty Term Notice */}
        {!loading && termVotes.length === 0 && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-6 dark:border-sky-900/50 dark:bg-sky-950/30 flex items-start gap-4">
            <Info className="h-6 w-6 text-sky-600 dark:text-sky-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-sky-900 dark:text-sky-200">
                {activeTermObj?.label} vēl nav uzsākusi darbu
              </h3>
              <p className="text-xs text-sky-700 dark:text-sky-300 leading-relaxed">
                Šī sasaukuma sēžu balsojumi tiks automātiski sinhronizēti no Saeimas atvērtajiem datiem, tiklīdz jaunais parlaments sanāks uz savu pirmo sēdi.
              </p>
              <button
                type="button"
                onClick={() => setSelectedTerm(14)}
                className="mt-2 text-xs font-semibold text-sky-800 hover:underline dark:text-sky-300"
              >
                Pārslēgties atpakaļ uz 14. Saeimu (2022–2026) →
              </button>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        {termVotes.length > 0 && (
          <section className="sticky top-16 z-30 -mx-2 rounded-2xl bg-white/95 p-4 shadow-sm backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 dark:bg-slate-950/95">
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
        <section className="space-y-5">
          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <p className="mt-3 text-sm">Ielādē Saeimas balsojumus...</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400">
              <AlertCircle className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && termVotes.length > 0 && filteredVotes.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-base font-semibold">Nav atrasts neviens balsojums</p>
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
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
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

      {/* Hemicycle Modal for 100 MPs Chamber Seating */}
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
