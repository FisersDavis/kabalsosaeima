import React, { useState, useMemo } from 'react';
import type { Vote, Faction } from '../../types';
import { CIVIC_DOMAINS } from './radarDomains';
import { VoteCard } from '../VoteCard';
import {
  GitCompare,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';

interface FactionComparatorProps {
  votes: Vote[];
  factions: Faction[];
  onSelectVote: (vote: Vote) => void;
}

const FACTION_ORDER = ['JV', 'ZZS', 'AS', 'NA', 'PRO', 'LPV', 'S!', 'PIEFR'];

type FactionStance = 'SUPPORT' | 'BLOCK';

function getSubstantiveStance(v: Vote, factionShort: string): FactionStance | null {
  if (!v.factionBreakdown) return null;

  for (const fb of v.factionBreakdown) {
    let short = fb.shortName.toUpperCase();
    if (short === 'ST') short = 'S!';
    if (short === 'IND') short = 'PIEFR';

    if (short === factionShort.toUpperCase()) {
      const p = fb.votes.par || 0;
      const pr = fb.votes.pret || 0;
      const a = fb.votes.atturas || 0;
      const active = p + pr + a;

      if (active >= 2) {
        if (p > pr + a) return 'SUPPORT';
        if (pr + a > p) return 'BLOCK';
      }
    }
  }

  return null;
}

export const FactionComparator: React.FC<FactionComparatorProps> = ({
  votes,
  factions,
  onSelectVote,
}) => {
  // Institutional order: seat count descending
  const orderedFactions = useMemo(() => {
    const defaultList: Faction[] = [
      { id: 'jv', shortName: 'JV', name: 'Jaunā VIENOTĪBA', color: '#00529B', seats: 26 },
      { id: 'zzs', shortName: 'ZZS', name: 'Zaļo un Zemnieku savienība', color: '#1B5E20', seats: 16 },
      { id: 'as', shortName: 'AS', name: 'APVIENOTAIS SARAKSTS', color: '#00838F', seats: 15 },
      { id: 'na', shortName: 'NA', name: 'Nacionālā apvienība', color: '#881337', seats: 12 },
      { id: 'pro', shortName: 'PRO', name: 'PROGRESĪVIE', color: '#C2185B', seats: 10 },
      { id: 'lpv', shortName: 'LPV', name: 'LATVIJA PIRMAJĀ VIETĀ', color: '#D97706', seats: 9 },
      { id: 'st', shortName: 'S!', name: 'Stabilitātei!', color: '#475569', seats: 8 },
      { id: 'ind', shortName: 'PIEFR', name: 'Pie frakcijām nepiederošie', color: '#64748B', seats: 4 },
    ];

    const source = factions && factions.length > 0 ? factions : defaultList;

    return [...source].sort((a, b) => {
      const idxA = FACTION_ORDER.indexOf(a.shortName);
      const idxB = FACTION_ORDER.indexOf(b.shortName);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return b.seats - a.seats;
    });
  }, [factions]);

  // Faction selectors: default Faction A: JV, Faction B: PRO
  const [factionAId, setFactionAId] = useState<string>('JV');
  const [factionBId, setFactionBId] = useState<string>('PRO');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('ALL');

  const factionA = useMemo(
    () => orderedFactions.find((f) => f.shortName === factionAId) || orderedFactions[0],
    [orderedFactions, factionAId]
  );

  const factionB = useMemo(
    () =>
      orderedFactions.find((f) => f.shortName === factionBId) ||
      orderedFactions.find((f) => f.shortName !== factionAId) ||
      orderedFactions[1],
    [orderedFactions, factionBId, factionAId]
  );

  // Switch or handle dropdown selection
  const handleSelectA = (newShort: string) => {
    if (newShort === factionBId) {
      // Auto-swap if user selects the other faction
      setFactionBId(factionAId);
    }
    setFactionAId(newShort);
  };

  const handleSelectB = (newShort: string) => {
    if (newShort === factionAId) {
      // Auto-swap if user selects the other faction
      setFactionAId(factionBId);
    }
    setFactionBId(newShort);
  };

  // Comparative calculations across all votes
  const comparisonData = useMemo(() => {
    let totalCommon = 0;
    let totalAligned = 0;

    const sectorStats: Record<string, { common: number; aligned: number }> = {};
    CIVIC_DOMAINS.forEach((d) => {
      sectorStats[d.id] = { common: 0, aligned: 0 };
    });

    const divergentVotes: Vote[] = [];

    votes.forEach((v) => {
      const stA = getSubstantiveStance(v, factionA.shortName);
      const stB = getSubstantiveStance(v, factionB.shortName);

      if (stA && stB) {
        totalCommon += 1;
        const catId = v.category?.id;
        if (catId && sectorStats[catId]) {
          sectorStats[catId].common += 1;
        }

        if (stA === stB) {
          totalAligned += 1;
          if (catId && sectorStats[catId]) {
            sectorStats[catId].aligned += 1;
          }
        } else {
          divergentVotes.push(v);
        }
      }
    });

    const overallPct = totalCommon > 0 ? Math.round((totalAligned / totalCommon) * 100) : 0;

    // Filter divergent votes by sector if user selected a sector filter
    const filteredDivergent =
      selectedSectorFilter === 'ALL'
        ? divergentVotes
        : divergentVotes.filter((v) => v.category?.id === selectedSectorFilter);

    // Sort divergent votes: tightest margins first, then by date descending
    const topDivergent = [...filteredDivergent]
      .sort((a, b) => {
        const marginA = Math.abs((a.counts.par || 0) - ((a.counts.pret || 0) + (a.counts.atturas || 0)));
        const marginB = Math.abs((b.counts.par || 0) - ((b.counts.pret || 0) + (b.counts.atturas || 0)));
        return marginA - marginB;
      })
      .slice(0, 3);

    return {
      totalCommon,
      totalAligned,
      overallPct,
      sectorStats,
      totalDivergentCount: divergentVotes.length,
      filteredDivergentCount: filteredDivergent.length,
      topDivergent,
    };
  }, [votes, factionA.shortName, factionB.shortName, selectedSectorFilter]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
      {/* 1. Header & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
            <GitCompare className="h-4 w-4 text-blue-700" />
            <span>Frakciju divpusējais salīdzinātājs</span>
          </h3>
          <p className="text-xs text-slate-600 mt-0.5">
            Salīdziniet divu frakciju balsojumu saskaņu visās nozarēs un atklājiet likumprojektus, kuros to pozīcijas bija pretējas.
          </p>
        </div>

        <span className="text-[11px] font-mono text-slate-400 self-start sm:self-auto">
          Objektīvs balsojumu audits
        </span>
      </div>

      {/* 2. Interactive Faction Selectors */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/80">
        <div className="flex flex-1 items-center gap-2">
          {/* Faction A Selector */}
          <div className="relative flex-1">
            <label htmlFor="comparator-faction-a" className="sr-only">
              Izvēlēties pirmo frakciju
            </label>
            <div className="flex items-center gap-2 w-full px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-slate-300 transition focus-within:ring-2 focus-within:ring-blue-500/20">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: factionA.color }} />
              <select
                id="comparator-faction-a"
                value={factionAId}
                onChange={(e) => handleSelectA(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer appearance-none pr-5"
              >
                {orderedFactions.map((f) => (
                  <option key={f.id} value={f.shortName}>
                    {f.shortName} · {f.name} ({f.seats} mandāti)
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 pointer-events-none" />
            </div>
          </div>

          {/* Separator */}
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 shrink-0">
            pret
          </span>

          {/* Faction B Selector */}
          <div className="relative flex-1">
            <label htmlFor="comparator-faction-b" className="sr-only">
              Izvēlēties otro frakciju
            </label>
            <div className="flex items-center gap-2 w-full px-3 py-2 bg-white rounded-lg border border-slate-200 shadow-2xs hover:border-slate-300 transition focus-within:ring-2 focus-within:ring-blue-500/20">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: factionB.color }} />
              <select
                id="comparator-faction-b"
                value={factionBId}
                onChange={(e) => handleSelectB(e.target.value)}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer appearance-none pr-5"
              >
                {orderedFactions.map((f) => (
                  <option key={f.id} value={f.shortName}>
                    {f.shortName} · {f.name} ({f.seats} mandāti)
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Factions summary note */}
        <div className="text-right text-[11px] text-slate-500 shrink-0 hidden md:block">
          Kopā izskatīti <strong>{comparisonData.totalCommon}</strong> kopīgi balsojumi
        </div>
      </div>

      {/* 3. Core Comparative Analytics Panel (Overall Metric + Per-Sector Breakdown) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Sub-Panel: Overall Chamber Alignment Metric (4 cols) */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Kopējā saskaņa Saeimā
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-slate-900 leading-none">
                {comparisonData.overallPct}%
              </span>
              <span className="text-xs font-medium text-slate-500">vienoti balsojumi</span>
            </div>

            {/* Subtle descriptive verdict */}
            <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
              {comparisonData.overallPct >= 85 ? (
                <span>
                  Frakcijas <strong>{factionA.shortName}</strong> un <strong>{factionB.shortName}</strong> balso ar ļoti augstu saskaņu, demonstrējot vienotu nostāju pārliecinošā vairākumā lēmumu.
                </span>
              ) : comparisonData.overallPct >= 70 ? (
                <span>
                  Frakcijas <strong>{factionA.shortName}</strong> un <strong>{factionB.shortName}</strong> demonstrē mērenu saskaņu, taču regulāri sadalās atsevišķu nozaru nozīmīgos likumos.
                </span>
              ) : (
                <span>
                  Starp frakcijām <strong>{factionA.shortName}</strong> un <strong>{factionB.shortName}</strong> pastāv būtiska politiskā pretstāve un bieži pretēji balsojumi.
                </span>
              )}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>Saskaņoti: {comparisonData.totalAligned}</span>
            <span>Pretēji: {comparisonData.totalDivergentCount}</span>
          </div>
        </div>

        {/* Right Sub-Panel: Per-Sector Alignment Breakdown (8 cols) */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              Saskaņa pa nozarēm
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              6 politikas jomas
            </span>
          </div>

          {/* 6-Sector Progress Track Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {CIVIC_DOMAINS.map((domain) => {
              const dStats = comparisonData.sectorStats[domain.id] || { common: 0, aligned: 0 };
              const pct = dStats.common > 0 ? Math.round((dStats.aligned / dStats.common) * 100) : 0;
              const Icon = domain.icon;

              return (
                <div key={domain.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className={`p-1 rounded ${domain.iconBg} ${domain.iconColor} shrink-0`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <span className="text-slate-800 font-medium truncate">{domain.shortTitle}</span>
                    </div>

                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="font-bold text-slate-900">{pct}%</span>
                      <span className="text-[10px] text-slate-400">({dStats.aligned}/{dStats.common})</span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-700 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
            Metrika aprēķināta pēc aktīvajām balsīm (Satversmes 24. pants: Par pret Pret/Atturas).
          </div>
        </div>
      </div>

      {/* 4. Divergence Points (Pivotal Votes where Faction A and Faction B voted on opposite sides) */}
      <div className="pt-2 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>Izšķirošie šķelšanās punkti</span>
              <span className="text-[10px] font-mono text-slate-400 font-normal">
                ({comparisonData.totalDivergentCount} balsojumi ar pretēju nostāju)
              </span>
            </h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Likumprojekti, kuros <strong>{factionA.shortName}</strong> un <strong>{factionB.shortName}</strong> balsoja pretējās pusēs. Noklikšķiniet uz kartītes, lai atvērtu zāles izvietojumu.
            </p>
          </div>

          {/* Sector Filter for Divergence Points */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
            <button
              type="button"
              onClick={() => setSelectedSectorFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer border ${
                selectedSectorFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Visas nozares
            </button>
            {CIVIC_DOMAINS.map((domain) => (
              <button
                key={domain.id}
                type="button"
                onClick={() => setSelectedSectorFilter(domain.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer whitespace-nowrap border ${
                  selectedSectorFilter === domain.id
                    ? 'bg-blue-50 text-blue-900 border-blue-600 shadow-2xs font-bold'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {domain.shortTitle}
              </button>
            ))}
          </div>
        </div>

        {/* Divergent Votes Cards List */}
        {comparisonData.topDivergent.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 text-center text-slate-600 text-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1.5" />
            <span className="font-semibold text-slate-800">
              {selectedSectorFilter === 'ALL'
                ? `Starp frakcijām ${factionA.shortName} un ${factionB.shortName} nav reģistrēti balsojumi ar pretēju nostāju.`
                : `Šajā nozarē starp frakcijām ${factionA.shortName} un ${factionB.shortName} nav reģistrēti balsojumi ar pretēju nostāju.`}
            </span>
          </div>
        ) : (
          <div className="space-y-2.5">
            {comparisonData.topDivergent.map((vote) => (
              <VoteCard
                key={vote.id}
                vote={vote}
                onSelect={onSelectVote}
                showFactionStances={true}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
