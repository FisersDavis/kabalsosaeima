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
  Flame,
  Split,
  FileCheck2,
  LayoutGrid,
  Filter
} from 'lucide-react';

interface IssueRadarViewProps {
  votes: Vote[];
  factions: Faction[];
  onSelectVote: (vote: Vote) => void;
  onSelectCategory?: (categoryId: string) => void;
}

export type RadarCharacterFilter = 'ALL' | 'TIGHT_MARGIN' | 'COALITION_SPLIT' | 'FINAL_PASSAGE';
export type RadarMatrixMetric = 'COALITION_ALIGNMENT' | 'VOTE_PAR';

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
    activeBorder: 'border-blue-600',
    activeBg: 'bg-blue-50/50',
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
    activeBorder: 'border-amber-600',
    activeBg: 'bg-amber-50/50',
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
    activeBorder: 'border-purple-600',
    activeBg: 'bg-purple-50/50',
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
    activeBorder: 'border-emerald-600',
    activeBg: 'bg-emerald-50/50',
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
    activeBorder: 'border-rose-600',
    activeBg: 'bg-rose-50/50',
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
    activeBorder: 'border-slate-800',
    activeBg: 'bg-slate-100/60',
    badgeBg: 'bg-slate-200 text-slate-800',
  },
];

const INITIAL_PAGE_SIZE = 25;

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

// Helper to get majority decision for a faction in a vote
function getFactionMajority(
  fbList: FactionBreakdown[] | undefined,
  factionId: string
): 'PAR' | 'PRET' | 'ATTURAS' | 'NEBALSO' | null {
  if (!fbList) return null;
  const fb = fbList.find(
    (item) => item.factionId.toLowerCase() === factionId.toLowerCase() || item.shortName.toUpperCase() === factionId.toUpperCase()
  );
  if (!fb) return null;

  const par = fb.votes.par || 0;
  const pret = fb.votes.pret || 0;
  const atturas = fb.votes.atturas || 0;
  const nebalso = fb.votes.nebalso || 0;
  const active = par + pret + atturas;

  if (active === 0) {
    return nebalso > 0 ? 'NEBALSO' : null;
  }
  if (par >= pret && par >= atturas) return 'PAR';
  if (pret >= par && pret >= atturas) return 'PRET';
  return 'ATTURAS';
}

// Check if a vote had a tight margin (difference between PAR and PRET+ATTURAS <= threshold)
function isTightMarginVote(v: Vote, threshold = 10): boolean {
  const par = v.counts.par || 0;
  const block = (v.counts.pret || 0) + (v.counts.atturas || 0);
  return Math.abs(par - block) <= threshold && (par + block) >= 30;
}

// Check if coalition partners (JV, ZZS, PRO) voted against each other
function isCoalitionSplitVote(v: Vote): boolean {
  const jv = getFactionMajority(v.factionBreakdown, 'jv');
  const zzs = getFactionMajority(v.factionBreakdown, 'zzs');
  const pro = getFactionMajority(v.factionBreakdown, 'pro');

  const activeDecisions = [jv, zzs, pro].filter((d): d is 'PAR' | 'PRET' | 'ATTURAS' => d === 'PAR' || d === 'PRET' || d === 'ATTURAS');
  if (activeDecisions.length < 2) return false;

  const distinct = new Set(activeDecisions);
  return distinct.size > 1;
}

// Check if a vote is final legislative passage
function isFinalPassageVote(v: Vote): boolean {
  if (v.isTier1) return true;
  if (v.reading === 3) return true;
  if (v.isUrgent && v.reading === 2) return true;
  return v.voteType === 'likums';
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
  const [characterFilter, setCharacterFilter] = useState<RadarCharacterFilter>('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState<'ALL' | 'PIENEMTS' | 'NORAIDITS'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_PAGE_SIZE);
  const [expandedVoteId, setExpandedVoteId] = useState<string | null>(null);
  const [matrixMetric, setMatrixMetric] = useState<RadarMatrixMetric>('COALITION_ALIGNMENT');

  // Parliamentary order of factions
  const orderedFactions = useMemo(() => {
    if (factions && factions.length > 0) {
      return factions;
    }
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

  // 1. MACRO TOPIC MATRIX & HEATMAP CALCULATIONS
  // Computes faction-by-domain alignment heatmap data
  const heatmapData = useMemo(() => {
    // domainId -> factionId -> { alignedVotes, totalVotes, parVotes, activeVotes }
    const stats: Record<
      string,
      Record<string, { alignedCount: number; alignedTotal: number; parCount: number; activeTotal: number }>
    > = {};

    CIVIC_DOMAINS.forEach((d) => {
      stats[d.id] = {};
      orderedFactions.forEach((f) => {
        stats[d.id][f.id] = { alignedCount: 0, alignedTotal: 0, parCount: 0, activeTotal: 0 };
      });
    });

    votes.forEach((v) => {
      const catId = v.category?.id;
      if (!catId || !stats[catId]) return;

      // Determine coalition line for this vote: sum active votes of JV + ZZS + PRO
      let cPar = 0;
      let cBlock = 0;
      const fDecisions: Record<string, 'PAR' | 'PRET' | 'ATTURAS' | 'NEBALSO' | null> = {};

      (v.factionBreakdown || []).forEach((fb) => {
        const fid = fb.factionId?.toLowerCase() || fb.shortName?.toLowerCase();
        const maj = getFactionMajority(v.factionBreakdown, fid);
        fDecisions[fid] = maj;

        if (['jv', 'zzs', 'pro'].includes(fid)) {
          cPar += fb.votes.par || 0;
          cBlock += (fb.votes.pret || 0) + (fb.votes.atturas || 0);
        }

        // Tally PAR / Active votes for raw support metric
        if (stats[catId][fid]) {
          const act = (fb.votes.par || 0) + (fb.votes.pret || 0) + (fb.votes.atturas || 0);
          stats[catId][fid].parCount += fb.votes.par || 0;
          stats[catId][fid].activeTotal += act;
        }
      });

      // Coalition line decision
      if (cPar + cBlock > 0) {
        const coalitionLine = cPar >= cBlock ? 'PAR' : 'PRET';

        orderedFactions.forEach((f) => {
          const fDec = fDecisions[f.id];
          if (fDec && fDec !== 'NEBALSO') {
            stats[catId][f.id].alignedTotal += 1;
            if (fDec === coalitionLine) {
              stats[catId][f.id].alignedCount += 1;
            }
          }
        });
      }
    });

    return stats;
  }, [votes, orderedFactions]);

  // Overall domain summary tiles stats
  const domainTilesStats = useMemo(() => {
    return CIVIC_DOMAINS.map((domain) => {
      const dVotes = votes.filter((v) => v.category?.id === domain.id);
      const total = dVotes.length;
      let passed = 0;
      let rejected = 0;
      let noQuorum = 0;
      let consensusCount = 0;

      dVotes.forEach((v) => {
        if (v.result === 'PIENEMTS') passed += 1;
        else if (v.result === 'NORAIDITS') rejected += 1;
        else if (v.result === 'NAV_KVORUMA') noQuorum += 1;

        const activeTotal = v.counts.par + v.counts.pret + v.counts.atturas;
        if (activeTotal > 0 && (v.counts.par / activeTotal) >= 0.8) {
          consensusCount += 1;
        }
      });

      const consensusPct = total > 0 ? Math.round((consensusCount / total) * 100) : 0;
      const passedPct = total > 0 ? Math.round((passed / total) * 100) : 0;

      return {
        ...domain,
        total,
        passed,
        rejected,
        noQuorum,
        consensusPct,
        passedPct,
      };
    });
  }, [votes]);

  // Character filter counts
  const characterCounts = useMemo(() => {
    let tight = 0;
    let split = 0;
    let finalP = 0;

    votes.forEach((v) => {
      if (selectedDomainId !== 'ALL' && v.category?.id !== selectedDomainId) return;
      if (isTightMarginVote(v)) tight += 1;
      if (isCoalitionSplitVote(v)) split += 1;
      if (isFinalPassageVote(v)) finalP += 1;
    });

    const total = votes.filter((v) => selectedDomainId === 'ALL' || v.category?.id === selectedDomainId).length;

    return { total, tight, split, finalP };
  }, [votes, selectedDomainId]);

  // Filtered votes for the dossier ledger
  const filteredVotes = useMemo(() => {
    return votes
      .filter((v) => {
        // Domain filter
        if (selectedDomainId !== 'ALL' && v.category?.id !== selectedDomainId) return false;

        // Character filter
        if (characterFilter === 'TIGHT_MARGIN' && !isTightMarginVote(v)) return false;
        if (characterFilter === 'COALITION_SPLIT' && !isCoalitionSplitVote(v)) return false;
        if (characterFilter === 'FINAL_PASSAGE' && !isFinalPassageVote(v)) return false;

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
        const dateA = parseLatvianDate(a.sittingDate || a.sessionDate);
        const dateB = parseLatvianDate(b.sittingDate || b.sessionDate);
        return dateB - dateA;
      });
  }, [votes, selectedDomainId, characterFilter, outcomeFilter, searchQuery]);

  // Capped visible slice (prevents infinite DOM receipt bloat)
  const visibleVotes = useMemo(() => {
    return filteredVotes.slice(0, visibleCount);
  }, [filteredVotes, visibleCount]);

  // Reset pagination on filter change
  const handleSelectDomain = (domainId: string) => {
    setSelectedDomainId(domainId);
    setVisibleCount(INITIAL_PAGE_SIZE);
  };

  const handleSelectCharacter = (cf: RadarCharacterFilter) => {
    setCharacterFilter(cf);
    setVisibleCount(INITIAL_PAGE_SIZE);
  };

  // Helper for heatmap cell color styling
  const getCellColorClass = (pct: number) => {
    if (pct >= 90) return 'bg-emerald-100 text-emerald-900 font-bold border-emerald-300';
    if (pct >= 75) return 'bg-emerald-50 text-emerald-800 font-medium border-emerald-200';
    if (pct >= 55) return 'bg-amber-50 text-amber-800 font-medium border-amber-200';
    if (pct >= 35) return 'bg-rose-50 text-rose-800 font-medium border-rose-200';
    return 'bg-rose-100 text-rose-900 font-bold border-rose-300';
  };

  const activeDomainObj = CIVIC_DOMAINS.find((d) => d.id === selectedDomainId);

  return (
    <div className="space-y-4">
      {/* 1. HERO CONTEXT & INTRODUCTION */}
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
              Makro pārskats par Saeimas nozaru politiku un partiju savstarpējo saskaņu. Salīdziniet frakciju vienotību pa tēmām, atklājiet koalīcijas šķelšanās un filtrējiet zīmīgākos lēmumus.
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto flex-shrink-0">
            <span className="text-[11px] text-slate-500 font-mono font-medium">
              {formatLatvianCount(votes.length, 'reģistrēts balsojums', 'reģistrēti balsojumi', 'reģistrētu balsojumu')}
            </span>
          </div>
        </div>
      </section>

      {/* 2. THE TOPIC COMPARISON MATRIX (RADAR HEATMAP) */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>Frakciju un nozaru saskaņas matrica</span>
              <span className="text-[10px] text-slate-500 lowercase font-normal">(noklikšķiniet uz rindas, lai filtrētu)</span>
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {matrixMetric === 'COALITION_ALIGNMENT'
                ? 'Rāda, cik % balsojumu konkrētā frakcija balsojusi vienoti ar valdības koalīcijas vairākumu (JV+ZZS+PRO).'
                : 'Rāda, cik % no aktīvajiem balsojumiem konkrētā frakcija šajā tēmā balsojusi "PAR".'}
            </p>
          </div>

          {/* Metric Switcher */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => setMatrixMetric('COALITION_ALIGNMENT')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                matrixMetric === 'COALITION_ALIGNMENT'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Koalīcijas saskaņa %
            </button>
            <button
              type="button"
              onClick={() => setMatrixMetric('VOTE_PAR')}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                matrixMetric === 'VOTE_PAR'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Balsots "PAR" %
            </button>
          </div>
        </div>

        {/* Heatmap Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] text-slate-600 font-bold uppercase tracking-wider select-none">
                <th scope="col" className="py-2 px-3 w-56">
                  Nozare / Temats
                </th>
                {orderedFactions.map((f) => (
                  <th key={f.id} scope="col" className="py-2 px-1 text-center w-14">
                    <div className="inline-flex flex-col items-center">
                      <span className="h-1.5 w-3.5 rounded-full mb-0.5" style={{ backgroundColor: f.color }} />
                      <span className="text-[10px] font-mono font-bold text-slate-800">{f.shortName}</span>
                    </div>
                  </th>
                ))}
                <th scope="col" className="py-2 px-2 text-center w-20">
                  Konsenss
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {CIVIC_DOMAINS.map((domain) => {
                const isSelected = selectedDomainId === domain.id;
                const dTile = domainTilesStats.find((t) => t.id === domain.id);
                const Icon = domain.icon;

                return (
                  <tr
                    key={domain.id}
                    onClick={() => handleSelectDomain(isSelected ? 'ALL' : domain.id)}
                    className={`transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 font-semibold'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Domain Title */}
                    <td className="py-2 px-3 align-middle">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${domain.iconBg} ${domain.iconColor} flex-shrink-0`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="truncate">
                          <span className="text-slate-900 font-semibold">{domain.title}</span>
                          <span className="ml-1.5 text-[10px] text-slate-500 font-mono">
                            ({dTile?.total || 0})
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Faction Heatmap Cells */}
                    {orderedFactions.map((f) => {
                      const fStats = heatmapData[domain.id]?.[f.id];
                      let pct = 0;
                      let tooltip = '';

                      if (matrixMetric === 'COALITION_ALIGNMENT') {
                        pct = fStats && fStats.alignedTotal > 0
                          ? Math.round((fStats.alignedCount / fStats.alignedTotal) * 100)
                          : 0;
                        tooltip = `${domain.shortTitle} · ${f.shortName}: ${fStats?.alignedCount || 0} no ${fStats?.alignedTotal || 0} balsojumiem (${pct}%) saskaņā ar koalīcijas līniju`;
                      } else {
                        pct = fStats && fStats.activeTotal > 0
                          ? Math.round((fStats.parCount / fStats.activeTotal) * 100)
                          : 0;
                        tooltip = `${domain.shortTitle} · ${f.shortName}: ${fStats?.parCount || 0} no ${fStats?.activeTotal || 0} aktīvajām balsīm (${pct}%) PAR`;
                      }

                      return (
                        <td key={f.id} className="py-2 px-1 text-center align-middle" title={tooltip}>
                          <span
                            className={`inline-block w-9 py-0.5 rounded text-[11px] font-mono border ${getCellColorClass(
                              pct
                            )}`}
                          >
                            {pct}%
                          </span>
                        </td>
                      );
                    })}

                    {/* Overall Domain Consensus Rating */}
                    <td className="py-2 px-2 text-center align-middle">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {dTile?.consensusPct || 0}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. INTERACTIVE TOPIC GRID / MACRO TILES */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Nozaru kopsavilkuma kartītes
            </h3>
          </div>
          {selectedDomainId !== 'ALL' && (
            <button
              type="button"
              onClick={() => handleSelectDomain('ALL')}
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
            >
              Rādīt visas jomas kopā
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {domainTilesStats.map((tile) => {
            const isSelected = selectedDomainId === tile.id;
            const Icon = tile.icon;

            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => handleSelectDomain(isSelected ? 'ALL' : tile.id)}
                className={`text-left rounded-xl border p-3.5 transition flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? `${tile.activeBg} ${tile.activeBorder} shadow-xs ring-2 ring-slate-400/40`
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg ${tile.iconBg} ${tile.iconColor}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {tile.total} balsojumi
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-900 text-white">
                          Atlasīts
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Short description */}
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {tile.title}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {tile.description}
                  </p>
                </div>

                {/* Card Footer: Consensus & Outcome bar */}
                <div className="mt-3 pt-2.5 border-t border-slate-100/80">
                  <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1">
                    <span>
                      Konsenss:{' '}
                      <strong className={tile.consensusPct >= 75 ? 'text-emerald-700' : 'text-amber-700'}>
                        {tile.consensusPct}%
                      </strong>
                    </span>
                    <span>
                      Pieņemti: <strong>{tile.passedPct}%</strong>
                    </span>
                  </div>

                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{ width: `${tile.passedPct}%` }}
                      title={`Pieņemti: ${tile.passed}`}
                    />
                    <div
                      className="bg-rose-500 h-full"
                      style={{ width: `${tile.total > 0 ? Math.round((tile.rejected / tile.total) * 100) : 0}%` }}
                      title={`Noraidīti: ${tile.rejected}`}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. FILTERS: BY NATURE ("Filtri pēc rakstura") & SEARCH */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs space-y-3">
        {/* Character Segmented Pills */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Filtri pēc rakstura:
            </span>
          </div>

          {/* Active Domain Indicator (if selected) */}
          {activeDomainObj && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500">Filtrēts pēc:</span>
              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${activeDomainObj.badgeBg}`}>
                {activeDomainObj.shortTitle}
              </span>
              <button
                type="button"
                onClick={() => handleSelectDomain('ALL')}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
                title="Noņemt nozares filtru"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* 4 Nature Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectCharacter('ALL')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
              characterFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>Visi balsojumi</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              characterFilter === 'ALL' ? 'bg-slate-800 text-slate-200' : 'bg-slate-200 text-slate-700'
            }`}>
              {characterCounts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectCharacter('TIGHT_MARGIN')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
              characterFilter === 'TIGHT_MARGIN'
                ? 'bg-amber-700 text-white border-amber-700 shadow-2xs font-bold'
                : 'bg-amber-50/70 text-amber-900 border-amber-200 hover:bg-amber-100/70'
            }`}
            title="Balsojumi ar ļoti ciešu iznākumu (starpība ≤ 10 balsīm)"
          >
            <Flame className="h-3.5 w-3.5 text-amber-500" />
            <span>Saspringtie balsojumi</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              characterFilter === 'TIGHT_MARGIN' ? 'bg-amber-800 text-amber-100' : 'bg-amber-200/80 text-amber-900'
            }`}>
              {characterCounts.tight}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectCharacter('COALITION_SPLIT')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
              characterFilter === 'COALITION_SPLIT'
                ? 'bg-rose-700 text-white border-rose-700 shadow-2xs font-bold'
                : 'bg-rose-50/70 text-rose-900 border-rose-200 hover:bg-rose-100/70'
            }`}
            title="Balsojumi, kuros koalīcijas partneri (JV, ZZS, PRO) balsoja pretēji"
          >
            <Split className="h-3.5 w-3.5 text-rose-500" />
            <span>Koalīcijas šķelšanās</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              characterFilter === 'COALITION_SPLIT' ? 'bg-rose-800 text-rose-100' : 'bg-rose-200/80 text-rose-900'
            }`}>
              {characterCounts.split}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectCharacter('FINAL_PASSAGE')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
              characterFilter === 'FINAL_PASSAGE'
                ? 'bg-blue-700 text-white border-blue-700 shadow-2xs font-bold'
                : 'bg-blue-50/70 text-blue-900 border-blue-200 hover:bg-blue-100/70'
            }`}
            title="Galīgie 2. un 3. lasījumu likumu balsojumi, izslēdzot procedūru balsojumus"
          >
            <FileCheck2 className="h-3.5 w-3.5 text-blue-500" />
            <span>Likumu pieņemšana</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              characterFilter === 'FINAL_PASSAGE' ? 'bg-blue-800 text-blue-100' : 'bg-blue-200/80 text-blue-900'
            }`}>
              {characterCounts.finalP}
            </span>
          </button>
        </div>

        {/* Search & Outcome Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-md">
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

          {/* Outcome Filter */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setOutcomeFilter('ALL');
                setVisibleCount(INITIAL_PAGE_SIZE);
              }}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                outcomeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Visi
            </button>
            <button
              type="button"
              onClick={() => {
                setOutcomeFilter('PIENEMTS');
                setVisibleCount(INITIAL_PAGE_SIZE);
              }}
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
              onClick={() => {
                setOutcomeFilter('NORAIDITS');
                setVisibleCount(INITIAL_PAGE_SIZE);
              }}
              className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                outcomeFilter === 'NORAIDITS'
                  ? 'bg-rose-50 text-rose-800 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Noraidītie
            </button>
          </div>
        </div>
      </section>

      {/* 5. THE SUBSTANTIVE DECISIONS LEDGER (CAPPED AT 25 WITH PAGINATION) */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              {activeDomainObj ? `${activeDomainObj.title} — lēmumi` : 'Atlasītie Saeimas balsojumi'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Parādīti {visibleVotes.length} no {filteredVotes.length} atlasītajiem balsojumiem. Klikšķiniet uz rindas, lai redzētu anotāciju vai atvērtu zāles karti.
            </p>
          </div>

          {onSelectCategory && activeDomainObj && (
            <button
              type="button"
              onClick={() => onSelectCategory(activeDomainObj.id)}
              className="text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
            >
              Atvērt šo tēmu galvenajā plūsmā →
            </button>
          )}
        </div>

        {/* Table Content */}
        {filteredVotes.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Info className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-700">Netika atrasts neviens atbilstīgs balsojums</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Mēģiniet izvēlēties citu filtru pēc rakstura, notīrīt meklēšanu vai apskatīt citas nozares.
            </p>
            {(searchQuery || outcomeFilter !== 'ALL' || characterFilter !== 'ALL' || selectedDomainId !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setOutcomeFilter('ALL');
                  setCharacterFilter('ALL');
                  setSelectedDomainId('ALL');
                  setVisibleCount(INITIAL_PAGE_SIZE);
                }}
                className="mt-3 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
              >
                Atiestatīt visus filtrus
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[920px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[10px] text-slate-600 font-bold uppercase tracking-wider select-none">
                  <th scope="col" className="py-2.5 px-3 w-5/12">
                    Datums un likumprojekts
                  </th>
                  {orderedFactions.map((f) => (
                    <th key={f.id} scope="col" className="py-2.5 px-1.5 text-center w-[46px]" title={`${f.name} (${f.seats} mandāti)`}>
                      <div className="inline-flex flex-col items-center">
                        <span className="h-1.5 w-4 rounded-full mb-0.5" style={{ backgroundColor: f.color }} />
                        <span className="text-[10px] font-mono font-bold text-slate-800">{f.shortName}</span>
                      </div>
                    </th>
                  ))}
                  <th scope="col" className="py-2.5 px-3 text-center w-28">
                    Iznākums
                  </th>
                  <th scope="col" className="py-2.5 px-3 text-right w-24">
                    Sēžu zāle
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">
                {visibleVotes.map((vote) => {
                  const isApproved = vote.result === 'PIENEMTS';
                  const isQuorumBreak = vote.result === 'NAV_KVORUMA';
                  const isExpanded = expandedVoteId === vote.id;
                  const displayTitle = cleanVoteTitle(vote.simplifiedTitle || vote.officialTitle);
                  const isTight = isTightMarginVote(vote);
                  const isSplitCoalition = isCoalitionSplitVote(vote);

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
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
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

                            {isTight && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                Saspringts
                              </span>
                            )}

                            {isSplitCoalition && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                                Koalīcija šķēlās
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
                            <td key={f.id} className="py-2.5 px-1 text-center align-middle" title={stance.tooltip}>
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
                                    <span className="h-1 w-1 rounded-full bg-amber-500" title="Sašķelts frakcijas balsojums" />
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
                                    <span className="h-1 w-1 rounded-full bg-amber-500" title="Sašķelts frakcijas balsojums" />
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
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Details Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={orderedFactions.length + 3} className="px-4 py-3">
                            <div className="space-y-2 text-xs">
                              <div>
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                                  Oficiālais Saeimas nosaukums
                                </div>
                                <div className="text-slate-800 font-medium leading-relaxed">
                                  {vote.officialTitle}
                                </div>
                              </div>

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

        {/* 6. PAGINATION: "RĀDĪT VĒL 25 BALSOJUMUS" */}
        {filteredVotes.length > visibleCount && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-slate-500 font-mono">
              Parādīti {visibleCount} no {filteredVotes.length} balsojumiem
            </span>

            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + INITIAL_PAGE_SIZE)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 text-xs font-semibold shadow-2xs hover:bg-slate-900 hover:text-white hover:border-slate-900 transition cursor-pointer"
            >
              <span>Rādīt vēl {Math.min(INITIAL_PAGE_SIZE, filteredVotes.length - visibleCount)} balsojumus</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </section>

      {/* 7. METHODOLOGY FOOTER */}
      <footer className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-start gap-3 text-xs text-slate-600">
        <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800">Par radara analīzi:</strong> Koalīcijas saskaņa mēra frakciju balsojumu atbilstību valdības koalīcijas (JV, ZZS, PRO) vairākuma nostājai. Saspringtie balsojumi atlasa lēmumus, kuros starpība starp atbalstu un noraidījumu nepārsniedza 10 balsis. Visi dati balstīti uz oficiālajiem Saeimas plenārsēžu protokoliem.
        </div>
      </footer>
    </div>
  );
};
