import React, { useState, useMemo } from 'react';
import type { Vote, Faction, FactionBreakdown } from '../types';
import { normalizeLatvianSearch, parseLatvianDate } from '../types';
import {
  Shield,
  Coins,
  Scale,
  Zap,
  HeartHandshake,
  Building2,
  Sparkles,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Info,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  Layers,
  Check
} from 'lucide-react';

interface IssueRadarViewProps {
  votes: Vote[];
  factions: Faction[];
  onSelectVote: (vote: Vote) => void;
  onSelectCategory?: (categoryId: string) => void;
}

interface CivicDomainConfig {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  activeBorder: string;
  activeBg: string;
}

const CIVIC_DOMAINS: CivicDomainConfig[] = [
  {
    id: 'drosiba',
    title: 'Valsts drošība un aizsardzība',
    shortTitle: 'Drošība',
    description: 'Nacionālie bruņotie spēki, robežapsardzība, NATO integrācija, iekšlietu dienesti un civilā aizsardzība.',
    icon: Shield,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-700',
    activeBorder: 'border-blue-600',
    activeBg: 'bg-blue-50/50',
  },
  {
    id: 'budzets',
    title: 'Budžets un nodokļi',
    shortTitle: 'Budžets',
    description: 'Valsts ikgadējais budžets, nodokļu un nodevu likmes, fiskālā disciplīna un valsts kases uzraudzība.',
    icon: Coins,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
    activeBorder: 'border-amber-600',
    activeBg: 'bg-amber-50/50',
  },
  {
    id: 'tiesiskums',
    title: 'Tiesiskums un korupcijas novēršana',
    shortTitle: 'Tiesiskums',
    description: 'Satversmes grozījumi, tiesu reformas, KNAB uzraudzība, administratīvā atbildība un cilvēktiesības.',
    icon: Scale,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-700',
    activeBorder: 'border-purple-600',
    activeBg: 'bg-purple-50/50',
  },
  {
    id: 'ekonomika',
    title: 'Ekonomika un enerģētika',
    shortTitle: 'Ekonomika',
    description: 'Enerģētiskā neatkarība, elektroenerģijas tirgus, infrastruktūra, lauksaimniecība un tirdzniecība.',
    icon: Zap,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    activeBorder: 'border-emerald-600',
    activeBg: 'bg-emerald-50/50',
  },
  {
    id: 'socialie',
    title: 'Veselība un labklājība',
    shortTitle: 'Labklājība',
    description: 'Veselības aprūpes finansējums, pensiju indeksācija, sociālie pabalsti un izglītības sistēmas reformas.',
    icon: HeartHandshake,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-700',
    activeBorder: 'border-rose-600',
    activeBg: 'bg-rose-50/50',
  },
  {
    id: 'administracija',
    title: 'Valsts pārvalde',
    shortTitle: 'Pārvalde',
    description: 'Pašvaldību pārraudzība, Saeimas kārtības rullis, vēlēšanu procedūras un publiskā sektora atvērtība.',
    icon: Building2,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    activeBorder: 'border-slate-800',
    activeBg: 'bg-slate-100/60',
  },
];

// Correct Latvian noun declension for counts
function formatLatvianCount(count: number, singular: string, pluralNom: string, pluralGen: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) {
    return `${count} ${pluralGen}`;
  }
  if (mod10 === 1) {
    return `${count} ${singular}`;
  }
  if (mod10 === 0) {
    return `${count} ${pluralGen}`;
  }
  return `${count} ${pluralNom}`;
}

// Strips redundant preamble filler from parliamentary titles
function cleanVoteTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let t = rawTitle.trim();
  t = t.replace(/^\s*Par\s+likumprojekta\s+/i, '');
  t = t.replace(/^\s*Par\s+likumprojektu\s+/i, '');
  t = t.replace(/^\s*Par\s+lēmuma\s+projektu\s+/i, '');
  t = t.replace(/^\s*Par\s+lēmuma\s+/i, '');
  t = t.replace(/^\s*Likumprojekts\s+/i, '');
  t = t.replace(/^\s*Par\s+priekšlikumu\s+/i, '');
  t = t.replace(/\s*\(\s*\d+\/[A-Za-z0-9]+\s*\)\s*$/, '');
  t = t.trim();
  if (t.length > 0) {
    return t[0].toUpperCase() + t.slice(1);
  }
  return rawTitle;
}

interface FactionStance {
  decision: 'PAR' | 'PRET' | 'ATTURAS' | 'NEBALSO' | 'NAV_DATU';
  isSplit: boolean;
  par: number;
  pret: number;
  atturas: number;
  nebalso: number;
  activeCount: number;
  totalMembers: number;
  majorityPct: number;
  tooltip: string;
}

function getFactionVoteStance(
  factionBreakdown: FactionBreakdown[] | undefined,
  factionId: string,
  shortName: string
): FactionStance {
  const fb = factionBreakdown?.find(
    (item) => item.factionId.toLowerCase() === factionId.toLowerCase() || item.shortName.toUpperCase() === shortName.toUpperCase()
  );

  if (!fb) {
    return {
      decision: 'NAV_DATU',
      isSplit: false,
      par: 0,
      pret: 0,
      atturas: 0,
      nebalso: 0,
      activeCount: 0,
      totalMembers: 0,
      majorityPct: 0,
      tooltip: `${shortName}: dati par šo balsojumu nav pieejami`,
    };
  }

  const par = fb.votes.par || 0;
  const pret = fb.votes.pret || 0;
  const atturas = fb.votes.atturas || 0;
  const nebalso = fb.votes.nebalso || 0;
  const activeCount = par + pret + atturas;
  const totalMembers = activeCount + nebalso;

  if (activeCount === 0) {
    if (nebalso > 0) {
      return {
        decision: 'NEBALSO',
        isSplit: false,
        par: 0,
        pret: 0,
        atturas: 0,
        nebalso,
        activeCount: 0,
        totalMembers,
        majorityPct: 100,
        tooltip: `${shortName}: ${nebalso} reģistrēti zālē, bet nebalsoja (kvoruma manevrs)`,
      };
    }
    return {
      decision: 'NAV_DATU',
      isSplit: false,
      par: 0,
      pret: 0,
      atturas: 0,
      nebalso: 0,
      activeCount: 0,
      totalMembers: 0,
      majorityPct: 0,
      tooltip: `${shortName}: visi deputāti prombūtnē`,
    };
  }

  const options: Array<{ decision: 'PAR' | 'PRET' | 'ATTURAS'; count: number }> = [
    { decision: 'PAR', count: par },
    { decision: 'PRET', count: pret },
    { decision: 'ATTURAS', count: atturas },
  ];
  options.sort((a, b) => b.count - a.count);

  const dominant = options[0];
  const second = options[1];
  const isSplit = second.count > 0;
  const majorityPct = Math.round((dominant.count / activeCount) * 100);

  const parts: string[] = [];
  if (par > 0) parts.push(`${par} Par`);
  if (pret > 0) parts.push(`${pret} Pret`);
  if (atturas > 0) parts.push(`${atturas} Atturas`);
  if (nebalso > 0) parts.push(`${nebalso} Nebalsoja`);

  const breakdownStr = parts.join(' · ');
  const statusNote = isSplit ? ` (${majorityPct}% vienoti)` : ' (vienbalsīgi)';

  return {
    decision: dominant.decision,
    isSplit,
    par,
    pret,
    atturas,
    nebalso,
    activeCount,
    totalMembers,
    majorityPct,
    tooltip: `${shortName}: ${breakdownStr}${statusNote}`,
  };
}

export const IssueRadarView: React.FC<IssueRadarViewProps> = ({
  votes,
  factions,
  onSelectVote,
  onSelectCategory,
}) => {
  const [selectedDomainId, setSelectedDomainId] = useState<string>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'PIENEMTS' | 'NORAIDITS'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tier1Only, setTier1Only] = useState<boolean>(true);
  const [expandedVoteId, setExpandedVoteId] = useState<string | null>(null);

  // Compute counts per domain for the domain navigation strip
  const domainCounts = useMemo(() => {
    const counts = new Map<string, number>();
    CIVIC_DOMAINS.forEach((d) => counts.set(d.id, 0));

    votes.forEach((v) => {
      // Respect tier1 filter for radar domain counts
      if (tier1Only && !v.isTier1) return;
      const catId = v.category?.id;
      if (catId && counts.has(catId)) {
        counts.set(catId, (counts.get(catId) || 0) + 1);
      }
    });

    return counts;
  }, [votes, tier1Only]);

  const totalTier1Count = useMemo(() => {
    return votes.filter((v) => (tier1Only ? v.isTier1 : true)).length;
  }, [votes, tier1Only]);

  // Active domain object (if a specific domain is selected)
  const activeDomain = useMemo(() => {
    return CIVIC_DOMAINS.find((d) => d.id === selectedDomainId) || null;
  }, [selectedDomainId]);

  // Filter votes for the current view
  const filteredVotes = useMemo(() => {
    return votes
      .filter((v) => {
        // Scope filter: Tier 1 landmark laws vs all votes
        if (tier1Only && !v.isTier1) return false;

        // Domain filter
        if (selectedDomainId !== 'ALL' && v.category?.id !== selectedDomainId) return false;

        // Outcome filter
        if (outcomeFilter !== 'ALL') {
          if (outcomeFilter === 'PIENEMTS' && v.result !== 'PIENEMTS') return false;
          if (outcomeFilter === 'NORAIDITS' && v.result === 'PIENEMTS') return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = normalizeLatvianSearch(searchQuery.trim());
          const inTitle = normalizeLatvianSearch(v.simplifiedTitle).includes(q);
          const inOfficial = normalizeLatvianSearch(v.officialTitle).includes(q);
          const inBill = normalizeLatvianSearch(v.billNumber).includes(q);
          const inSummary = normalizeLatvianSearch(v.summary).includes(q);
          if (!inTitle && !inOfficial && !inBill && !inSummary) return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Chronological descending (latest sitting date first)
        const dateA = parseLatvianDate(a.sittingDate || a.sessionDate);
        const dateB = parseLatvianDate(b.sittingDate || b.sessionDate);
        return dateB - dateA;
      });
  }, [votes, tier1Only, selectedDomainId, outcomeFilter, searchQuery]);

  // Statistics for current filtered domain scope
  const domainScopeStats = useMemo(() => {
    const scopeVotes = votes.filter((v) => {
      if (tier1Only && !v.isTier1) return false;
      if (selectedDomainId !== 'ALL' && v.category?.id !== selectedDomainId) return false;
      return true;
    });

    const total = scopeVotes.length;
    let passed = 0;
    let rejected = 0;
    let noQuorum = 0;
    let consensusCount = 0;

    scopeVotes.forEach((v) => {
      if (v.result === 'PIENEMTS') passed += 1;
      else if (v.result === 'NORAIDITS') rejected += 1;
      else if (v.result === 'NAV_KVORUMA') noQuorum += 1;

      // Check consensus: >= 75 Par votes or >= 80% of present active voters
      const activeTotal = v.counts.par + v.counts.pret + v.counts.atturas;
      if (activeTotal > 0 && (v.counts.par / activeTotal) >= 0.8) {
        consensusCount += 1;
      }
    });

    const passedPct = total > 0 ? Math.round((passed / total) * 100) : 0;
    const rejectedPct = total > 0 ? Math.round((rejected / total) * 100) : 0;
    const consensusPct = total > 0 ? Math.round((consensusCount / total) * 100) : 0;

    return { total, passed, rejected, noQuorum, passedPct, rejectedPct, consensusCount, consensusPct };
  }, [votes, tier1Only, selectedDomainId]);

  // Parliamentary order of factions
  // Coalition (JV, ZZS, PRO), Opposition (AS, NA, LPV, S!), Independents (PIEFR)
  const orderedFactions = useMemo(() => {
    if (factions && factions.length > 0) {
      return factions;
    }
    // Fallback standard 14th Saeima factions if list empty
    return [
      { id: 'jv', shortName: 'JV', name: 'Jaunā VIENOTĪBA', color: '#00529B', seats: 26 },
      { id: 'zzs', shortName: 'ZZS', name: 'Zaļo un Zemnieku savienība', color: '#006837', seats: 16 },
      { id: 'pro', shortName: 'PRO', name: 'PROGRESĪVIE', color: '#E30613', seats: 10 },
      { id: 'as', shortName: 'AS', name: 'APVIENOTAIS SARAKSTS', color: '#1E3A8A', seats: 15 },
      { id: 'na', shortName: 'NA', name: 'Nacionālā apvienība', color: '#8B0000', seats: 13 },
      { id: 'lpv', shortName: 'LPV', name: 'Latvija pirmajā vietā', color: '#F58220', seats: 8 },
      { id: 's!', shortName: 'S!', name: '"Stabilitātei!"', color: '#00AEEF', seats: 10 },
      { id: 'piefr', shortName: 'PIEFR', name: 'Pie frakcijām nepiederošie', color: '#64748B', seats: 2 },
    ];
  }, [factions]);

  return (
    <div className="space-y-4">
      {/* 1. DOMAIN SELECTION TAB STRIP */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-700" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Tematiskie virzieni
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {formatLatvianCount(totalTier1Count, 'zīmīgs likums', 'zīmīgi likumi', 'zīmīgu likumu')}
          </span>
        </div>

        {/* Horizontal domain pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {/* ALL DOMAINS BUTTON */}
          <button
            type="button"
            onClick={() => setSelectedDomainId('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
              selectedDomainId === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Visas jomas</span>
            <span
              className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                selectedDomainId === 'ALL'
                  ? 'bg-slate-800 text-slate-200'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {totalTier1Count}
            </span>
          </button>

          {/* 6 CIVIC DOMAIN BUTTONS */}
          {CIVIC_DOMAINS.map((domain) => {
            const count = domainCounts.get(domain.id) || 0;
            const Icon = domain.icon;
            const isSelected = selectedDomainId === domain.id;

            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => setSelectedDomainId(domain.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? `${domain.activeBg} text-slate-900 ${domain.activeBorder} shadow-2xs font-bold ring-1 ring-slate-400/40`
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className={`p-0.5 rounded ${domain.iconBg} ${domain.iconColor}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span>{domain.shortTitle}</span>
                <span
                  className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected ? 'bg-white text-slate-900 border border-slate-300' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. ACTIVE DOMAIN SUMMARY & QUICK STATS HERO */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Domain Description */}
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-1">
              {activeDomain ? (
                <>
                  <div className={`p-1.5 rounded-lg ${activeDomain.iconBg} ${activeDomain.iconColor}`}>
                    <activeDomain.icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{activeDomain.title}</h3>
                </>
              ) : (
                <>
                  <div className="p-1.5 rounded-lg bg-slate-900 text-white">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Visas likumdošanas jomas kopumā</h3>
                </>
              )}
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mt-1">
              {activeDomain
                ? activeDomain.description
                : 'Pārskats par Saeimas nozīmīgākajiem pieņemtajiem un noraidītajiem likumprojektiem visās nozarēs ar katras frakcijas balsojuma nostāju.'}
            </p>

            {onSelectCategory && activeDomain && (
              <button
                type="button"
                onClick={() => onSelectCategory(activeDomain.id)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900 mt-2 transition cursor-pointer"
              >
                <span>Atvērt visus šīs jomas balsojumus galvenajā plūsmā</span>
                <span aria-hidden="true">&rarr;</span>
              </button>
            )}
          </div>

          {/* Right: Quick Insights Metric Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2 text-center min-w-[100px]">
              <div className="text-[10px] text-slate-500 font-medium">Likumi</div>
              <div className="text-sm font-bold font-mono text-slate-900 mt-0.5">
                {domainScopeStats.total}
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2 text-center min-w-[100px]">
              <div className="text-[10px] text-emerald-800 font-medium">Pieņemti</div>
              <div className="text-sm font-bold font-mono text-emerald-700 mt-0.5">
                {domainScopeStats.passed}{' '}
                <span className="text-[10px] font-normal text-emerald-600">({domainScopeStats.passedPct}%)</span>
              </div>
            </div>

            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-2 text-center min-w-[100px]">
              <div className="text-[10px] text-rose-800 font-medium">Noraidīti</div>
              <div className="text-sm font-bold font-mono text-rose-700 mt-0.5">
                {domainScopeStats.rejected}{' '}
                <span className="text-[10px] font-normal text-rose-600">({domainScopeStats.rejectedPct}%)</span>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2 text-center min-w-[100px]">
              <div className="text-[10px] text-blue-800 font-medium">Konsenss</div>
              <div className="text-sm font-bold font-mono text-blue-700 mt-0.5">
                {domainScopeStats.consensusCount}{' '}
                <span className="text-[10px] font-normal text-blue-600">({domainScopeStats.consensusPct}%)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Outcome progress bar */}
        {domainScopeStats.total > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${domainScopeStats.passedPct}%` }}
                title={`Pieņemti: ${domainScopeStats.passed} (${domainScopeStats.passedPct}%)`}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-300"
                style={{ width: `${domainScopeStats.rejectedPct}%` }}
                title={`Noraidīti: ${domainScopeStats.rejected} (${domainScopeStats.rejectedPct}%)`}
              />
              {domainScopeStats.noQuorum > 0 && (
                <div
                  className="bg-amber-400 h-full transition-all duration-300"
                  style={{
                    width: `${Math.round((domainScopeStats.noQuorum / domainScopeStats.total) * 100)}%`,
                  }}
                  title={`Nav kvoruma: ${domainScopeStats.noQuorum}`}
                />
              )}
            </div>
          </div>
        )}
      </section>

      {/* 3. TOOLBAR: SEARCH & SCOPE FILTERS */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Meklēt likumu, numuru vai atslēgvārdu..."
            className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Outcome Filter */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setOutcomeFilter('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                outcomeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visi iznākumi
            </button>
            <button
              type="button"
              onClick={() => setOutcomeFilter('PIENEMTS')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                outcomeFilter === 'PIENEMTS'
                  ? 'bg-emerald-50 text-emerald-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pieņemtie
            </button>
            <button
              type="button"
              onClick={() => setOutcomeFilter('NORAIDITS')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                outcomeFilter === 'NORAIDITS'
                  ? 'bg-rose-50 text-rose-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Noraidītie
            </button>
          </div>

          {/* Scope Toggle: Tier 1 vs All */}
          <button
            type="button"
            onClick={() => setTier1Only(!tier1Only)}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              tier1Only
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Ierobežot tikai ar nozīmīgākajiem 2. un 3. galīgajiem lasījumiem"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Zīmīgie lēmumi</span>
            {tier1Only && <Check className="h-3 w-3" />}
          </button>
        </div>
      </section>

      {/* 4. THE LANDMARK DECISIONS CROSS-FACTION MATRIX TABLE */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Zīmīgāko lēmumu kartotēka un frakciju nostājas
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Katras frakcijas dominējošā nostāja un iekšējā vienotība. Klikšķiniet uz rindas, lai redzētu anotāciju vai atvērtu 100 deputātu sēžu zāli.
            </p>
          </div>
          <div className="text-[11px] text-slate-500 font-mono flex-shrink-0">
            {formatLatvianCount(filteredVotes.length, 'atbilstīgs lēmums', 'atbilstīgi lēmumi', 'atbilstīgu lēmumu')}
          </div>
        </div>

        {/* Table Ledger */}
        {filteredVotes.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Info className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">Netika atrasts neviens likumprojekts</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Mēģiniet mainīt meklēšanas vārdus, noņemt filtrus vai ieslēgt visus balsojumus.
            </p>
            {(searchQuery || outcomeFilter !== 'ALL' || !tier1Only) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setOutcomeFilter('ALL');
                  setTier1Only(true);
                }}
                className="mt-3 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                Atiestatīt filtrus
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[920px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] text-slate-600 font-bold uppercase tracking-wider select-none">
                  {/* Column 1: Date & Bill Title */}
                  <th scope="col" className="py-2.5 px-3 w-5/12">
                    Datums un likumprojekts
                  </th>

                  {/* Faction Columns */}
                  {orderedFactions.map((f) => (
                    <th
                      key={f.id}
                      scope="col"
                      className="py-2.5 px-1.5 text-center w-[46px]"
                      title={`${f.name} (${f.seats} mandāti)`}
                    >
                      <div className="inline-flex flex-col items-center">
                        <span
                          className="h-1.5 w-4 rounded-full mb-0.5"
                          style={{ backgroundColor: f.color }}
                        />
                        <span className="text-[10px] font-mono font-bold text-slate-800">
                          {f.shortName}
                        </span>
                      </div>
                    </th>
                  ))}

                  {/* Outcome Column */}
                  <th scope="col" className="py-2.5 px-3 text-center w-28">
                    Iznākums
                  </th>

                  {/* Action Column */}
                  <th scope="col" className="py-2.5 px-3 text-right w-24">
                    Sēžu zāle
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVotes.map((vote) => {
                  const isApproved = vote.result === 'PIENEMTS';
                  const isQuorumBreak = vote.result === 'NAV_KVORUMA';
                  const isExpanded = expandedVoteId === vote.id;
                  const displayTitle = cleanVoteTitle(vote.simplifiedTitle || vote.officialTitle);

                  return (
                    <React.Fragment key={vote.id}>
                      <tr
                        onClick={() => setExpandedVoteId(isExpanded ? null : vote.id)}
                        className={`transition hover:bg-slate-50/80 cursor-pointer ${
                          isExpanded ? 'bg-slate-50/90' : ''
                        }`}
                      >
                        {/* 1. Date, Badges & Law Title */}
                        <td className="py-2.5 px-3 align-middle">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[11px] font-mono text-slate-500 font-medium">
                              {vote.sittingDate || vote.sessionDate}
                            </span>

                            {vote.readingStage && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                {vote.readingStage}
                              </span>
                            )}

                            {vote.billNumber && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200">
                                {vote.billNumber}
                              </span>
                            )}

                            {vote.isUrgent && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Steidzams
                              </span>
                            )}
                          </div>

                          <div className="font-semibold text-slate-900 leading-snug line-clamp-2 hover:text-blue-900 transition">
                            {displayTitle}
                          </div>
                        </td>

                        {/* 2. Faction Stance Cells */}
                        {orderedFactions.map((f) => {
                          const stance = getFactionVoteStance(vote.factionBreakdown, f.id, f.shortName);

                          return (
                            <td
                              key={f.id}
                              className="py-2.5 px-1 text-center align-middle"
                              title={stance.tooltip}
                            >
                              {stance.decision === 'PAR' && (
                                <span
                                  className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    stance.isSplit
                                      ? 'bg-emerald-50 text-emerald-800 border border-dashed border-emerald-300 gap-0.5'
                                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  }`}
                                >
                                  <span>PAR</span>
                                  {stance.isSplit && (
                                    <span
                                      className="h-1 w-1 rounded-full bg-amber-500"
                                      title="Sašķelts frakcijas balsojums"
                                    />
                                  )}
                                </span>
                              )}

                              {stance.decision === 'PRET' && (
                                <span
                                  className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                                    stance.isSplit
                                      ? 'bg-rose-50 text-rose-800 border border-dashed border-rose-300 gap-0.5'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  <span>PRET</span>
                                  {stance.isSplit && (
                                    <span
                                      className="h-1 w-1 rounded-full bg-amber-500"
                                      title="Sašķelts frakcijas balsojums"
                                    />
                                  )}
                                </span>
                              )}

                              {stance.decision === 'ATTURAS' && (
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  ATT.
                                </span>
                              )}

                              {stance.decision === 'NEBALSO' && (
                                <span className="inline-flex items-center justify-center px-1 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                  NEB.
                                </span>
                              )}

                              {stance.decision === 'NAV_DATU' && (
                                <span className="text-slate-300 text-xs select-none">—</span>
                              )}
                            </td>
                          );
                        })}

                        {/* 3. Outcome Cell */}
                        <td className="py-2.5 px-3 text-center align-middle whitespace-nowrap">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>PIEŅEMTS</span>
                            </span>
                          ) : isQuorumBreak ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>NAV KVORUMA</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>NORAIDĪTS</span>
                            </span>
                          )}

                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                            {vote.counts.par} : {vote.counts.pret}
                          </div>
                        </td>

                        {/* 4. Action / Hemicycle Link */}
                        <td className="py-2.5 px-3 text-right align-middle whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectVote(vote);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 text-xs font-semibold shadow-2xs transition cursor-pointer"
                              title="Atvērt 100 deputātu sēžu zāles interaktīvo karti"
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Zāle</span>
                            </button>

                            <button
                              type="button"
                              aria-label="Izvērst detaļas"
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={orderedFactions.length + 3} className="px-4 py-3">
                            <div className="space-y-2 text-xs">
                              {/* Official Title if different from displayTitle */}
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                                  Oficiālais Saeimas nosaukums
                                </div>
                                <div className="text-slate-800 font-medium leading-relaxed">
                                  {vote.officialTitle}
                                </div>
                              </div>

                              {/* Summary / Annotation */}
                              {vote.summary && (
                                <div className="pt-1">
                                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                                    Likumprojekta anotācija un mērķis
                                  </div>
                                  <p className="text-slate-600 leading-relaxed max-w-3xl">
                                    {vote.summary}
                                  </p>
                                </div>
                              )}

                              {/* Footer Actions */}
                              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/60">
                                <div className="text-[11px] text-slate-500 font-mono">
                                  Kopā reģistrēti:{' '}
                                  <strong className="text-slate-800">
                                    {vote.counts.par + vote.counts.pret + vote.counts.atturas + vote.counts.nebalso}
                                  </strong>{' '}
                                  deputāti ({vote.counts.par} Par, {vote.counts.pret} Pret, {vote.counts.atturas} Atturas, {vote.counts.nebalso} Nebalsoja)
                                </div>

                                <div className="flex items-center gap-2">
                                  {vote.protocolUrl && (
                                    <a
                                      href={vote.protocolUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:text-blue-900 font-medium underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <span>Saeimas oficiālais protokols</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => onSelectVote(vote)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition cursor-pointer"
                                  >
                                    <Users className="w-3.5 h-3.5" />
                                    <span>Atvērt 100 deputātu sēžu zāles karti</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 5. EDUCATIONAL METHODOLOGY FOOTER */}
      <footer className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-start gap-3 text-xs text-slate-600">
        <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800">Par matricas metodoloģiju:</strong> Katras frakcijas šūnā attēlota tās aktīvo deputātu vairākuma izvēle (<strong className="text-emerald-700">PAR</strong>, <strong className="text-rose-700">PRET</strong> vai <strong className="text-amber-700">ATT.</strong>). Neliels punkts pie koda norāda uz sašķeltu frakcijas balsojumu. <strong className="text-slate-700">NEB.</strong> apzīmē gadījumu, kad frakcija apzināti piedalījās kvorumā, bet nebalsoja. Visus datus iespējams pārbaudīt oficiālajos Saeimas stenogrammu protokolos.
        </div>
      </footer>
    </div>
  );
};
