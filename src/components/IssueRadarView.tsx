import React, { useState, useMemo } from 'react';
import type { Vote, Faction } from '../types';
import { normalizeLatvianSearch, parseLatvianDate } from '../types';
import { VoteCard } from './VoteCard';
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
  Info,
  Flame,
  LayoutGrid,
  Filter
} from 'lucide-react';

interface IssueRadarViewProps {
  votes: Vote[];
  factions: Faction[];
  onSelectVote: (vote: Vote) => void;
  onSelectCategory?: (categoryId: string) => void;
}

export type RadarContentiousFilter = 'CONTENTIOUS_ONLY' | 'ALL_VOTES' | 'MAJOR_SPLIT_ONLY' | 'TIGHT_MARGIN_ONLY';

interface CivicDomainConfig {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
}

const CIVIC_DOMAINS: CivicDomainConfig[] = [
  {
    id: 'drosiba',
    title: 'Valsts drošība un aizsardzība',
    shortTitle: 'Drošība',
    description: 'Nacionālie bruņotie spēki, robežapsardzība, NATO integrācija un civilā aizsardzība.',
    icon: Shield,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-700',
    badgeBg: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'budzets',
    title: 'Budžets un nodokļi',
    shortTitle: 'Budžets',
    description: 'Valsts ikgadējais budžets, nodokļu likmes, fiskālā disciplīna un valsts kases uzraudzība.',
    icon: Coins,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800',
  },
  {
    id: 'tiesiskums',
    title: 'Tiesiskums un korupcijas novēršana',
    shortTitle: 'Tiesiskums',
    description: 'Satversmes grozījumi, tiesu reformas, KNAB uzraudzība un administratīvā atbildība.',
    icon: Scale,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-700',
    badgeBg: 'bg-purple-100 text-purple-800',
  },
  {
    id: 'ekonomika',
    title: 'Ekonomika un enerģētika',
    shortTitle: 'Ekonomika',
    description: 'Enerģētiskā neatkarība, elektroenerģijas tirgus, infrastruktūra un lauksaimniecība.',
    icon: Zap,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'socialie',
    title: 'Veselība un labklājība',
    shortTitle: 'Labklājība',
    description: 'Veselības aprūpes finansējums, pensiju indeksācija, sociālie pabalsti un izglītība.',
    icon: HeartHandshake,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-700',
    badgeBg: 'bg-rose-100 text-rose-800',
  },
  {
    id: 'administracija',
    title: 'Valsts pārvalde',
    shortTitle: 'Pārvalde',
    description: 'Pašvaldību pārraudzība, Saeimas kārtības rullis, vēlēšanu procedūras un atvērtība.',
    icon: Building2,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    badgeBg: 'bg-slate-200 text-slate-800',
  },
];

const INITIAL_PAGE_SIZE = 25;

// Pure objective criteria: large split (≥ 15 Pret votes)
function isMajorSplitVote(v: Vote, threshold = 15): boolean {
  return (v.counts.pret || 0) >= threshold;
}

// Pure objective criteria: tight margin (difference between PAR and PRET+ATTURAS ≤ 10)
function isTightMarginVote(v: Vote, threshold = 10): boolean {
  const par = v.counts.par || 0;
  const block = (v.counts.pret || 0) + (v.counts.atturas || 0);
  return Math.abs(par - block) <= threshold && (par + block) >= 30;
}

export const IssueRadarView: React.FC<IssueRadarViewProps> = ({
  votes,
  factions,
  onSelectVote,
  onSelectCategory,
}) => {
  const [selectedDomainId, setSelectedDomainId] = useState<string>('ALL');
  // Default to contentious votes (anomalies, substantial splits & tight margins)
  const [contentiousFilter, setContentiousFilter] = useState<RadarContentiousFilter>('CONTENTIOUS_ONLY');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_PAGE_SIZE);

  // Standard institutional order: mandate size (seat count) descending, unaffiliated MPs anchored at the end
  const orderedFactions = useMemo(() => {
    const defaultList: Faction[] = [
      { id: 'jv', shortName: 'JV', name: 'Jaunā VIENOTĪBA', color: '#00529B', seats: 26 },
      { id: 'zzs', shortName: 'ZZS', name: 'Zaļo un Zemnieku savienība', color: '#006837', seats: 16 },
      { id: 'as', shortName: 'AS', name: 'APVIENOTAIS SARAKSTS', color: '#1E3A8A', seats: 15 },
      { id: 'na', shortName: 'NA', name: 'Nacionālā apvienība', color: '#8B0000', seats: 12 },
      { id: 'pro', shortName: 'PRO', name: 'PROGRESĪVIE', color: '#E30613', seats: 10 },
      { id: 'lpv', shortName: 'LPV', name: 'Latvija pirmajā vietā', color: '#F58220', seats: 9 },
      { id: 'st', shortName: 'S!', name: '"Stabilitātei!"', color: '#00AEEF', seats: 8 },
      { id: 'ind', shortName: 'PIEFR', name: 'Pie frakcijām nepiederošie', color: '#64748B', seats: 4 },
    ];

    if (!factions || factions.length === 0) {
      return defaultList;
    }

    return [...factions].sort((a, b) => {
      const aInd = ['ind', 'piefr'].includes(a.id.toLowerCase()) || ['ind', 'piefr'].includes(a.shortName.toLowerCase());
      const bInd = ['ind', 'piefr'].includes(b.id.toLowerCase()) || ['ind', 'piefr'].includes(b.shortName.toLowerCase());
      if (aInd && !bInd) return 1;
      if (!aInd && bInd) return -1;
      return b.seats - a.seats;
    });
  }, [factions]);

  // 1. TOPIC COMPARISON MATRIX DATA: Raw affirmative voting rate (% PAR) per domain
  const heatmapData = useMemo(() => {
    // domainId -> factionShortName/Id -> { parCount, activeTotal }
    const stats: Record<string, Record<string, { parCount: number; activeTotal: number }>> = {};

    CIVIC_DOMAINS.forEach((d) => {
      stats[d.id] = {};
      orderedFactions.forEach((f) => {
        stats[d.id][f.id] = { parCount: 0, activeTotal: 0 };
        stats[d.id][f.shortName] = stats[d.id][f.id];
      });
    });

    votes.forEach((v) => {
      const catId = v.category?.id;
      if (!catId || !stats[catId]) return;

      (v.factionBreakdown || []).forEach((fb) => {
        const fid = fb.factionId?.toLowerCase();
        const short = fb.shortName;
        const target = stats[catId][fid] || stats[catId][short];

        if (target) {
          const p = fb.votes.par || 0;
          const pr = fb.votes.pret || 0;
          const a = fb.votes.atturas || 0;
          target.parCount += p;
          target.activeTotal += (p + pr + a);
        }
      });
    });

    return stats;
  }, [votes, orderedFactions]);

  // Overall consensus rating per domain
  const domainConsensusStats = useMemo(() => {
    const map = new Map<string, { totalVotes: number; consensusPct: number; contentiousCount: number }>();

    CIVIC_DOMAINS.forEach((domain) => {
      const dVotes = votes.filter((v) => v.category?.id === domain.id);
      const totalVotes = dVotes.length;
      let consensusCount = 0;
      let contentiousCount = 0;

      dVotes.forEach((v) => {
        const isSplit = isMajorSplitVote(v);
        const isTight = isTightMarginVote(v);
        if (isSplit || isTight) {
          contentiousCount += 1;
        }

        const activeTotal = v.counts.par + v.counts.pret + v.counts.atturas;
        if (activeTotal > 0 && (v.counts.par / activeTotal) >= 0.8) {
          consensusCount += 1;
        }
      });

      const consensusPct = totalVotes > 0 ? Math.round((consensusCount / totalVotes) * 100) : 0;
      map.set(domain.id, { totalVotes, consensusPct, contentiousCount });
    });

    return map;
  }, [votes]);

  // Counts for the contentious / all filter switcher in active domain scope
  const filterCounts = useMemo(() => {
    let totalInScope = 0;
    let contentiousInScope = 0;
    let splitInScope = 0;
    let tightInScope = 0;

    votes.forEach((v) => {
      if (selectedDomainId !== 'ALL' && v.category?.id !== selectedDomainId) return;
      totalInScope += 1;

      const isSplit = isMajorSplitVote(v);
      const isTight = isTightMarginVote(v);

      if (isSplit) splitInScope += 1;
      if (isTight) tightInScope += 1;
      if (isSplit || isTight) contentiousInScope += 1;
    });

    return { totalInScope, contentiousInScope, splitInScope, tightInScope };
  }, [votes, selectedDomainId]);

  // Filtered votes for the feed
  const filteredVotes = useMemo(() => {
    return votes
      .filter((v) => {
        // Domain filter
        if (selectedDomainId !== 'ALL' && v.category?.id !== selectedDomainId) return false;

        // Pure objective criteria filter
        const isSplit = isMajorSplitVote(v);
        const isTight = isTightMarginVote(v);

        if (contentiousFilter === 'CONTENTIOUS_ONLY' && !isSplit && !isTight) return false;
        if (contentiousFilter === 'MAJOR_SPLIT_ONLY' && !isSplit) return false;
        if (contentiousFilter === 'TIGHT_MARGIN_ONLY' && !isTight) return false;

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
        const dateA = parseLatvianDate(a.sittingDate || a.sessionDate);
        const dateB = parseLatvianDate(b.sittingDate || b.sessionDate);
        return dateB - dateA;
      });
  }, [votes, selectedDomainId, contentiousFilter, searchQuery]);

  const visibleVotes = useMemo(() => {
    return filteredVotes.slice(0, visibleCount);
  }, [filteredVotes, visibleCount]);

  const handleSelectDomain = (domainId: string) => {
    setSelectedDomainId(domainId);
    setVisibleCount(INITIAL_PAGE_SIZE);
  };

  const handleSelectContentious = (filter: RadarContentiousFilter) => {
    setContentiousFilter(filter);
    setVisibleCount(INITIAL_PAGE_SIZE);
  };

  // Muted, institutional cell color styling based on % PAR
  const getCellColorClass = (pct: number) => {
    if (pct >= 90) return 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80 font-bold';
    if (pct >= 75) return 'bg-emerald-50/40 text-emerald-700 border-emerald-100 font-medium';
    if (pct >= 55) return 'bg-amber-50/70 text-amber-800 border-amber-200/80 font-medium';
    if (pct >= 35) return 'bg-rose-50/60 text-rose-800 border-rose-200/60 font-medium';
    return 'bg-rose-100/70 text-rose-900 border-rose-300 font-bold';
  };

  const activeDomainObj = CIVIC_DOMAINS.find((d) => d.id === selectedDomainId);

  return (
    <div className="space-y-4">
      {/* 1. HERO TITLE & CONTEXT */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-slate-900 text-white">
                <LayoutGrid className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Tematiskais politikas radars
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Parlamentārās saskaņas un šķelšanās radars. Salīdziniet frakciju nostājas pa nozarēm un atklājiet likumprojektus ar asākajām pretrunām vai ciešākajiem balsojumiem.
            </p>
          </div>
          <div className="text-right flex-shrink-0 self-start sm:self-auto">
            <span className="text-[11px] text-slate-500 font-mono font-medium">
              {votes.length} balsojumi · 6 nozares
            </span>
          </div>
        </div>
      </section>

      {/* 2. THE TOPIC COMPARISON MATRIX (INSTITUTIONAL RADAR HEATMAP) */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>Frakciju un nozaru atbalsta matrica</span>
              <span className="text-[10px] text-slate-500 lowercase font-normal">
                (noklikšķiniet uz nozares, lai filtrētu balsojumus)
              </span>
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Rāda, cik % no aktīvajām balsīm katra frakcija attiecīgajā nozarē balsojusi "PAR". Frakcijas sakārtotas pēc mandātu skaita.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-mono">
              Metrika: <strong>Balsots "PAR" %</strong>
            </span>
          </div>
        </div>

        {/* Heatmap Table: Clean, Single Institutional Header Row, Seat-Ordered */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/80 text-[10px] text-slate-700 font-bold uppercase tracking-wider select-none">
                <th scope="col" className="py-2.5 px-3 w-56">
                  {selectedDomainId !== 'ALL' ? (
                    <button
                      type="button"
                      onClick={() => handleSelectDomain('ALL')}
                      className="text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer text-[10px]"
                    >
                      ← Rādīt visas nozares
                    </button>
                  ) : (
                    <span>Nozare / Temats</span>
                  )}
                </th>

                {/* All 8 Factions in Single Sequence Ordered Strictly by Seat Count */}
                {orderedFactions.map((f) => (
                  <th
                    key={f.id}
                    scope="col"
                    className="py-2.5 px-1 text-center w-14"
                    title={`${f.name} (${f.seats} mandāti)`}
                  >
                    <div className="inline-flex flex-col items-center">
                      <span className="h-1.5 w-3.5 rounded-full mb-0.5" style={{ backgroundColor: f.color }} />
                      <span className="text-[10px] font-mono font-bold text-slate-800">{f.shortName}</span>
                    </div>
                  </th>
                ))}

                {/* Overall Consensus */}
                <th scope="col" className="py-2.5 px-2 text-center w-20">
                  Konsenss
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {CIVIC_DOMAINS.map((domain) => {
                const isSelected = selectedDomainId === domain.id;
                const dStats = domainConsensusStats.get(domain.id);
                const Icon = domain.icon;

                return (
                  <tr
                    key={domain.id}
                    onClick={() => handleSelectDomain(isSelected ? 'ALL' : domain.id)}
                    className={`transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-4 border-l-blue-600 font-semibold'
                        : 'hover:bg-slate-50/90'
                    }`}
                  >
                    {/* Domain Title with Icon and Count */}
                    <td className="py-2.5 px-3 align-middle">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-2 truncate">
                          <div className={`p-1 rounded ${domain.iconBg} ${domain.iconColor} flex-shrink-0`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-slate-900 truncate">{domain.title}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          <span className="text-[10px] text-slate-500 font-mono">
                            {dStats?.totalVotes || 0}
                          </span>
                          {isSelected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Faction Support Rate Cells */}
                    {orderedFactions.map((f) => {
                      const fStats = heatmapData[domain.id]?.[f.id] || heatmapData[domain.id]?.[f.shortName];
                      const pct = fStats && fStats.activeTotal > 0
                        ? Math.round((fStats.parCount / fStats.activeTotal) * 100)
                        : 0;
                      const tooltip = `${domain.shortTitle} · ${f.shortName}: ${fStats?.parCount || 0}/${fStats?.activeTotal || 0} (${pct}%) PAR`;

                      return (
                        <td key={f.id} className="py-2 px-1 text-center align-middle" title={tooltip}>
                          <span className={`inline-block w-10 py-0.5 rounded text-[11px] font-mono border ${getCellColorClass(pct)}`}>
                            {pct}%
                          </span>
                        </td>
                      );
                    })}

                    {/* Overall Domain Consensus Rating */}
                    <td className="py-2 px-2 text-center align-middle">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {dStats?.consensusPct || 0}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. COMPACT TOPIC FILTER PILLS STRIP */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Nozaru filtri:
            </span>
          </div>

          {activeDomainObj && (
            <button
              type="button"
              onClick={() => handleSelectDomain('ALL')}
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
            >
              Noņemt filtru (rādīt visas nozares)
            </button>
          )}
        </div>

        {/* Horizontal Topic Pill Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          <button
            type="button"
            onClick={() => handleSelectDomain('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
              selectedDomainId === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Visas nozares</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              selectedDomainId === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
            }`}>
              {votes.length}
            </span>
          </button>

          {CIVIC_DOMAINS.map((domain) => {
            const dStats = domainConsensusStats.get(domain.id);
            const isSelected = selectedDomainId === domain.id;
            const Icon = domain.icon;

            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => handleSelectDomain(domain.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-blue-50 text-blue-950 border-blue-600 shadow-2xs ring-1 ring-blue-500/40 font-bold'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className={`p-0.5 rounded ${domain.iconBg} ${domain.iconColor}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span>{domain.shortTitle}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-blue-200/80 text-blue-900 font-bold' : 'bg-slate-200 text-slate-700'
                }`}>
                  {dStats?.totalVotes || 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Domain Banner */}
        {activeDomainObj && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-900">{activeDomainObj.title}:</strong> {activeDomainObj.description}
            </div>
            {onSelectCategory && (
              <button
                type="button"
                onClick={() => onSelectCategory(activeDomainObj.id)}
                className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline whitespace-nowrap cursor-pointer flex-shrink-0"
              >
                Skatīt galvenajā balsojumu plūsmā →
              </button>
            )}
          </div>
        )}
      </section>

      {/* 4. CONTENTIOUS VOTE TOGGLE ("Šķelšanās un saspringtie balsojumi") & SEARCH */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-2.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
          {/* Main Contentious / All Votes Toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => handleSelectContentious('CONTENTIOUS_ONLY')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                contentiousFilter === 'CONTENTIOUS_ONLY'
                  ? 'bg-rose-700 text-white shadow-2xs font-bold'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Rādīt balsojumus ar būtisku opozīciju (≥ 15 pret) vai ciešu iznākumu (starpība ≤ 10)"
            >
              <Flame className="h-3.5 w-3.5" />
              <span>Tikai šķelšanās un saspringtie</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                contentiousFilter === 'CONTENTIOUS_ONLY' ? 'bg-rose-800 text-rose-100' : 'bg-slate-200 text-slate-700'
              }`}>
                {filterCounts.contentiousInScope}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectContentious('ALL_VOTES')}
              className={`px-3 py-1.5 rounded-md font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                contentiousFilter === 'ALL_VOTES'
                  ? 'bg-slate-900 text-white shadow-2xs font-bold'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>Visi balsojumi</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                contentiousFilter === 'ALL_VOTES' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
              }`}>
                {filterCounts.totalInScope}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(INITIAL_PAGE_SIZE);
              }}
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
        </div>

        {/* Objective Sub-Filters for Specific Fracture Types */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-600">
          <span className="text-[11px] font-medium text-slate-500">Detalizētāk:</span>

          <button
            type="button"
            onClick={() => handleSelectContentious('MAJOR_SPLIT_ONLY')}
            className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer border ${
              contentiousFilter === 'MAJOR_SPLIT_ONLY'
                ? 'bg-rose-50 text-rose-900 border-rose-300 font-bold shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Balsojumi, kuros vismaz 15 deputāti balsoja Pret"
          >
            Lielā šķelšanās (≥ 15 pret) ({filterCounts.splitInScope})
          </button>

          <button
            type="button"
            onClick={() => handleSelectContentious('TIGHT_MARGIN_ONLY')}
            className={`px-2 py-0.5 rounded text-[11px] transition cursor-pointer border ${
              contentiousFilter === 'TIGHT_MARGIN_ONLY'
                ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Balsojumi ar ļoti ciešu iznākumu (starpība ≤ 10 balsīm)"
          >
            Saspringtie balsojumi (≤ 10 balsīm) ({filterCounts.tightInScope})
          </button>
        </div>
      </section>

      {/* 5. CLEAN VOTE CARDS FEED (WITH FACTION STANCE PILLS) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1 text-xs text-slate-600">
          <div className="font-semibold text-slate-800">
            {activeDomainObj ? `${activeDomainObj.title} — ` : ''}
            {contentiousFilter === 'CONTENTIOUS_ONLY'
              ? 'Šķelšanās un saspringtie balsojumi'
              : contentiousFilter === 'MAJOR_SPLIT_ONLY'
              ? 'Lielā šķelšanās (≥ 15 pret)'
              : contentiousFilter === 'TIGHT_MARGIN_ONLY'
              ? 'Saspringtie balsojumi (starpība ≤ 10 balsīm)'
              : 'Visi balsojumi'}
          </div>

          <div className="font-mono text-[11px] text-slate-500">
            Parādīti {visibleVotes.length} no {filteredVotes.length}
          </div>
        </div>

        {/* Empty state */}
        {filteredVotes.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
            <Info className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">Netika atrasts neviens atbilstīgs balsojums</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Šajā nozarē nav reģistrēti balsojumi ar šādiem filtriem. Izvēlieties "Visi balsojumi" vai notīriet meklēšanu.
            </p>
            <button
              type="button"
              onClick={() => {
                setContentiousFilter('ALL_VOTES');
                setSelectedDomainId('ALL');
                setSearchQuery('');
                setVisibleCount(INITIAL_PAGE_SIZE);
              }}
              className="mt-3 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Rādīt visus balsojumus
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleVotes.map((vote) => (
              <VoteCard
                key={vote.id}
                vote={vote}
                onSelect={onSelectVote}
                showFactionStances={true}
              />
            ))}
          </div>
        )}

        {/* Progressive Loading Trigger */}
        {filteredVotes.length > visibleCount && (
          <div className="pt-2 pb-4 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + INITIAL_PAGE_SIZE)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold shadow-2xs hover:bg-slate-900 hover:text-white hover:border-slate-900 transition cursor-pointer"
            >
              <span>Rādīt vēl {Math.min(INITIAL_PAGE_SIZE, filteredVotes.length - visibleCount)} balsojumus</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="mt-1.5 text-[11px] text-slate-500 font-mono">
              Parādīti {visibleCount} no {filteredVotes.length} balsojumiem
            </div>
          </div>
        )}
      </section>

      {/* 6. METHODOLOGY FOOTER */}
      <footer className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-start gap-3 text-xs text-slate-600">
        <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800">Par radara metodoloģiju:</strong> Matrica aprēķina katras frakcijas aktīvo deputātu atbalsta īpatsvaru (balsots "PAR" %) konkrētajā nozarē. Frakcijas sakārtotas pēc mandātu skaita Saeimā. Saspringtie balsojumi atlasa lēmumus ar balsu starpību ≤ 10, bet lielā šķelšanās fiksē likumprojektus, kuros vismaz 15 deputāti balsoja pret. Visi dati balstīti uz oficiālajiem Saeimas plenārsēžu protokoliem bez politiskiem pieņēmumiem.
        </div>
      </footer>
    </div>
  );
};
