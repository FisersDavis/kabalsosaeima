import React, { useState, useEffect, useMemo } from 'react';
import type { Vote, Faction } from '../../types';
import { parseLatvianDate } from '../../types';
import { VoteCard } from '../VoteCard';
import { SectorCardGrid } from './SectorCardGrid';
import { FactionComparator } from './FactionComparator';
import { isVoteTense } from '../../utils/tension';
import {
  CIVIC_DOMAINS,
  INSTITUTIONAL_ORDER,
  getFrictionBadge,
  type CivicDomainConfig,
  type FrictionBadgeInfo,
} from './radarDomains';
import {
  ArrowLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  Layers,
  Flame,
  Handshake,
  GitCompare,
  TrendingUp,
} from 'lucide-react';

export interface TematiskaisRadarsViewProps {
  votes: Vote[];
  factions: Faction[];
  onSelectVote: (vote: Vote) => void;
  onSelectCategory?: (categoryId: string) => void;
}

export {
  CIVIC_DOMAINS,
  INSTITUTIONAL_ORDER,
  getFrictionBadge,
  type CivicDomainConfig,
  type FrictionBadgeInfo,
};

interface PairwiseAgreement {
  faction1: Faction;
  faction2: Faction;
  agreePct: number;
  agreeCount: number;
  totalCount: number;
}

interface SpectrumPlacement {
  faction: Faction;
  pct: number;
  parVotes: number;
  totalVotes: number;
  lane: number;
}

export const TematiskaisRadarsView: React.FC<TematiskaisRadarsViewProps> = ({
  votes,
  factions,
  onSelectVote,
  onSelectCategory,
}) => {
  // Sector Deep Dive state synchronized with window.location.hash
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.hash.match(/^#radars\/([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        const found = CIVIC_DOMAINS.find((d) => d.id === match[1].toLowerCase());
        if (found) return found.id;
      }
    }
    return null;
  });

  // Listen to hashchange for forward/back browser navigation and direct links
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#radars\/([a-zA-Z0-9_-]+)/i);
      if (match && match[1]) {
        const found = CIVIC_DOMAINS.find((d) => d.id === match[1].toLowerCase());
        if (found) {
          setSelectedSectorId(found.id);
          return;
        }
      }
      if (hash.toLowerCase() === '#radars' || !hash.toLowerCase().startsWith('#radars/')) {
        setSelectedSectorId(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleOpenSector = (sectorId: string) => {
    setSelectedSectorId(sectorId);
    if (typeof window !== 'undefined') {
      window.location.hash = `#radars/${sectorId}`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBackToMacro = () => {
    setSelectedSectorId(null);
    if (typeof window !== 'undefined') {
      window.location.hash = '#radars';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Standard institutional order: mandate size descending, unaffiliated MPs anchored at the end
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
      const idxA = INSTITUTIONAL_ORDER.indexOf(a.shortName);
      const idxB = INSTITUTIONAL_ORDER.indexOf(b.shortName);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      return b.seats - a.seats;
    });
  }, [factions]);

  // Support rates (% PAR) per domain and faction
  const heatmapData = useMemo(() => {
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
        let short = fb.shortName;
        if (short === 'ST') short = 'S!';
        if (short === 'IND') short = 'PIEFR';

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

  // Domain consensus ratings, tension counts, and tight margin votes count
  const domainStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalVotes: number;
        consensusPct: number;
        tightVotesCount: number;
        tenseVotesCount: number;
        friction: FrictionBadgeInfo;
        dominantCamps: { label: string; factionsText: string; isSplit: boolean };
      }
    >();

    CIVIC_DOMAINS.forEach((domain) => {
      const dVotes = votes.filter((v) => v.category?.id === domain.id);
      const totalVotes = dVotes.length;
      let consensusCount = 0;
      let tightVotesCount = 0;
      let tenseVotesCount = 0;

      dVotes.forEach((v) => {
        if (isVoteTense(v)) {
          tenseVotesCount += 1;
        }

        const par = v.counts.par || 0;
        const pret = v.counts.pret || 0;
        const att = v.counts.atturas || 0;
        const activeTotal = par + pret + att;

        if (activeTotal > 0 && par / activeTotal >= 0.8) {
          consensusCount += 1;
        }

        const margin = Math.abs(par - (pret + att));
        if (margin <= 10 && activeTotal >= 30) {
          tightVotesCount += 1;
        }
      });

      const consensusPct = totalVotes > 0 ? Math.round((consensusCount / totalVotes) * 100) : 0;
      const friction = getFrictionBadge(consensusPct, tightVotesCount);

      // Dominant voting camps calculation
      const supporting: string[] = [];
      const neutral: string[] = [];
      const opposing: string[] = [];

      orderedFactions.forEach((f) => {
        const fStat = heatmapData[domain.id]?.[f.id] || heatmapData[domain.id]?.[f.shortName];
        const pct = fStat && fStat.activeTotal > 0 ? Math.round((fStat.parCount / fStat.activeTotal) * 100) : 0;
        if (pct >= 70) {
          supporting.push(f.shortName);
        } else if (pct <= 40) {
          opposing.push(f.shortName);
        } else {
          neutral.push(f.shortName);
        }
      });

      let dominantCamps: { label: string; factionsText: string; isSplit: boolean };
      if (consensusPct > 80 || (opposing.length === 0 && neutral.length === 0)) {
        dominantCamps = {
          label: 'Vienots atbalsts',
          factionsText: supporting.join(', '),
          isSplit: false,
        };
      } else if (opposing.length > 0) {
        dominantCamps = {
          label: 'Pozīcijas',
          factionsText: `Atbalsta: ${supporting.join(', ')} · Pret/Atturas: ${opposing.join(', ')}`,
          isSplit: true,
        };
      } else {
        dominantCamps = {
          label: 'Pozīcijas',
          factionsText: `Atbalsta: ${supporting.join(', ')} · Dalīts: ${neutral.join(', ')}`,
          isSplit: true,
        };
      }

      map.set(domain.id, {
        totalVotes,
        consensusPct,
        tightVotesCount,
        tenseVotesCount,
        friction,
        dominantCamps,
      });
    });

    return map;
  }, [votes, orderedFactions, heatmapData]);

  // Selected Sector Object
  const activeSector = useMemo(() => {
    if (!selectedSectorId) return null;
    return CIVIC_DOMAINS.find((d) => d.id === selectedSectorId) || null;
  }, [selectedSectorId]);

  // Votes belonging strictly to the active deep dive sector
  const activeSectorVotes = useMemo(() => {
    if (!selectedSectorId) return [];
    return votes.filter((v) => v.category?.id === selectedSectorId);
  }, [votes, selectedSectorId]);

  // 1. DEEP DIVE SECTION 1: Alignment Spectrum placements with vertical collision avoidance
  const spectrumPlacements = useMemo(() => {
    if (!selectedSectorId) return { placements: [], totalLanes: 1 };

    const items = orderedFactions.map((f) => {
      const stat = heatmapData[selectedSectorId]?.[f.id] || heatmapData[selectedSectorId]?.[f.shortName] || { parCount: 0, activeTotal: 0 };
      const pct = stat.activeTotal > 0 ? Math.round((stat.parCount / stat.activeTotal) * 100) : 0;
      return {
        faction: f,
        pct,
        parVotes: stat.parCount,
        totalVotes: stat.activeTotal,
        seats: f.seats,
      };
    });

    // Sort by pct ascending; tiebreaker: seat count descending
    const sorted = [...items].sort((a, b) => {
      if (a.pct !== b.pct) return a.pct - b.pct;
      return b.seats - a.seats;
    });

    const minDistPercent = 8.5; // Horizontal safety margin before stacking onto a new lane
    const lanes: number[] = [];
    const placements: SpectrumPlacement[] = [];

    for (const item of sorted) {
      let assignedLane = -1;
      for (let i = 0; i < lanes.length; i++) {
        if (item.pct - lanes[i] >= minDistPercent) {
          lanes[i] = item.pct;
          assignedLane = i;
          break;
        }
      }
      if (assignedLane === -1) {
        assignedLane = lanes.length;
        lanes.push(item.pct);
      }

      placements.push({
        faction: item.faction,
        pct: item.pct,
        parVotes: item.parVotes,
        totalVotes: item.totalVotes,
        lane: assignedLane,
      });
    }

    return { placements, totalLanes: Math.max(lanes.length, 1) };
  }, [selectedSectorId, orderedFactions, heatmapData]);

  // 2. DEEP DIVE SECTION 2: Flashpoint votes (|Par - (Pret + Atturas)| <= 10)
  const flashpointVotes = useMemo(() => {
    if (!selectedSectorId) return [];

    return activeSectorVotes
      .filter((v) => {
        const par = v.counts.par || 0;
        const pret = v.counts.pret || 0;
        const att = v.counts.atturas || 0;
        const active = par + pret + att;
        const margin = Math.abs(par - (pret + att));
        return margin <= 10 && active >= 30;
      })
      .sort((a, b) => {
        const marginA = Math.abs((a.counts.par || 0) - ((a.counts.pret || 0) + (a.counts.atturas || 0)));
        const marginB = Math.abs((b.counts.par || 0) - ((b.counts.pret || 0) + (b.counts.atturas || 0)));
        if (marginA !== marginB) return marginA - marginB;
        const dateA = parseLatvianDate(a.sittingDate || a.sessionDate);
        const dateB = parseLatvianDate(b.sittingDate || b.sessionDate);
        return dateB - dateA;
      })
      .slice(0, 3);
  }, [activeSectorVotes, selectedSectorId]);

  // 3. DEEP DIVE SECTION 3: Pairwise agreement (Curated extremes: Top 3 Highest & Top 3 Lowest)
  const pairwiseExtremes = useMemo(() => {
    if (!selectedSectorId || activeSectorVotes.length === 0) {
      return { highestPairs: [], lowestPairs: [] };
    }

    // Only official parliamentary factions (excluding unaffiliated MPs as they do not form a voting bloc)
    const politicalFactions = orderedFactions.filter(
      (f) => !['ind', 'piefr'].includes(f.id.toLowerCase()) && !['ind', 'piefr'].includes(f.shortName.toLowerCase())
    );

    const pairStats = new Map<string, { f1: Faction; f2: Faction; agree: number; total: number }>();

    for (let i = 0; i < politicalFactions.length; i++) {
      for (let j = i + 1; j < politicalFactions.length; j++) {
        const f1 = politicalFactions[i];
        const f2 = politicalFactions[j];
        const key = `${f1.shortName}_${f2.shortName}`;
        pairStats.set(key, { f1, f2, agree: 0, total: 0 });
      }
    }

    activeSectorVotes.forEach((v) => {
      const stances = new Map<string, 'PAR' | 'PRET'>();

      (v.factionBreakdown || []).forEach((fb) => {
        let short = fb.shortName;
        if (short === 'ST') short = 'S!';
        if (short === 'IND') short = 'PIEFR';

        const p = fb.votes.par || 0;
        const pr = fb.votes.pret || 0;
        const a = fb.votes.atturas || 0;
        const active = p + pr + a;

        if (active >= 2) {
          if (p > pr + a) {
            stances.set(short.toUpperCase(), 'PAR');
          } else if (pr + a > p) {
            stances.set(short.toUpperCase(), 'PRET');
          }
        }
      });

      for (let i = 0; i < politicalFactions.length; i++) {
        for (let j = i + 1; j < politicalFactions.length; j++) {
          const f1 = politicalFactions[i];
          const f2 = politicalFactions[j];
          const key = `${f1.shortName}_${f2.shortName}`;
          const st1 = stances.get(f1.shortName.toUpperCase());
          const st2 = stances.get(f2.shortName.toUpperCase());

          if (st1 && st2) {
            const entry = pairStats.get(key)!;
            entry.total += 1;
            if (st1 === st2) {
              entry.agree += 1;
            }
          }
        }
      }
    });

    const minVotesThreshold = Math.min(5, Math.max(2, Math.floor(activeSectorVotes.length * 0.15)));

    const allPairs: PairwiseAgreement[] = [];
    pairStats.forEach(({ f1, f2, agree, total }) => {
      if (total >= minVotesThreshold) {
        allPairs.push({
          faction1: f1,
          faction2: f2,
          agreePct: Math.round((agree / total) * 100),
          agreeCount: agree,
          totalCount: total,
        });
      }
    });

    const highestPairs = [...allPairs]
      .sort((a, b) => b.agreePct - a.agreePct || b.totalCount - a.totalCount)
      .slice(0, 3);

    const lowestPairs = [...allPairs]
      .sort((a, b) => a.agreePct - b.agreePct || b.totalCount - a.totalCount)
      .slice(0, 3);

    return { highestPairs, lowestPairs };
  }, [selectedSectorId, activeSectorVotes, orderedFactions]);

  // Heatmap table cell color styling based on % PAR
  const getCellColorClass = (pct: number) => {
    if (pct >= 90) return 'bg-emerald-50/90 text-emerald-800 border-emerald-200/80 font-bold';
    if (pct >= 75) return 'bg-emerald-50/40 text-emerald-700 border-emerald-100 font-medium';
    if (pct >= 55) return 'bg-amber-50/70 text-amber-800 border-amber-200/80 font-medium';
    if (pct >= 35) return 'bg-rose-50/60 text-rose-800 border-rose-200/60 font-medium';
    return 'bg-rose-100/70 text-rose-900 border-rose-300 font-bold';
  };

  // =========================================================================
  // RENDER TIER 2: TOPIC DEEP DIVE (#radars/<sectorId>)
  // =========================================================================
  if (activeSector) {
    const sStats = domainStatsMap.get(activeSector.id);
    const Icon = activeSector.icon;
    const { placements, totalLanes } = spectrumPlacements;
    // Spectrum container height: each lane gets 36px plus bottom track clearance
    const spectrumBoxHeight = Math.max(totalLanes * 36 + 48, 140);

    return (
      <div className="space-y-4">
        {/* Navigation & Header */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <button
              type="button"
              onClick={handleBackToMacro}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-800 transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>← Atpakaļ uz visām nozarēm</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {activeSectorVotes.length} balsojumi
              </span>
              {sStats && (
                <>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${sStats.friction.badgeClass}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sStats.friction.dotColor}`} />
                    <span>{sStats.friction.label}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200">
                    Vienprātība zālē: {sStats.consensusPct}%
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="pt-3 flex items-start gap-3">
            <div className={`p-2.5 rounded-lg ${activeSector.iconBg} ${activeSector.iconColor} shrink-0`}>
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {activeSector.title}
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-3xl">
                {activeSector.description}
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 1: NOZARES POLITISKĀ ASS (THE ALIGNMENT SPECTRUM) */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 mb-2 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
                <span>Nozares politiskā ass</span>
              </h3>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Frakciju vidējais atbalsta līmenis nozarē (balsots "PAR" % no aktīvajām balsīm). Frakcijas izkārtotas nepārtrauktā skalā bez pārklāšanās.
              </p>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              Skala: 0% līdz 100% PAR
            </span>
          </div>

          {/* Continuous Track Container with Staggered Badges */}
          <div className="overflow-x-auto pt-2 pb-1">
            <div
              className="relative w-full min-w-[540px]"
              style={{ height: `${spectrumBoxHeight}px` }}
            >
              {/* Vertical Grid Guidelines at 0%, 25%, 50%, 75%, 100% */}
              {[0, 25, 50, 75, 100].map((tick) => (
                <div
                  key={tick}
                  className="absolute bottom-8 top-0 pointer-events-none border-l border-slate-100"
                  style={{ left: `${tick}%` }}
                />
              ))}

              {/* Horizontal Track Baseline */}
              <div className="absolute left-0 right-0 bottom-6 h-2 rounded-full bg-gradient-to-r from-rose-200 via-amber-100 to-emerald-200 border border-slate-200/80 shadow-2xs" />

              {/* Staggered Faction Badges and Connector Stems */}
              {placements.map(({ faction, pct, parVotes, totalVotes, lane }) => {
                const bottomOffset = lane * 36 + 28;
                const stemHeight = bottomOffset - 16;
                const tooltip = `${faction.name} (${faction.seats} mandāti): ${parVotes} no ${totalVotes} balsīm (${pct}%) PAR`;

                return (
                  <React.Fragment key={faction.id}>
                    {/* Vertical Connector Stem */}
                    <div
                      className="absolute w-px border-l border-dashed border-slate-300 pointer-events-none transition-all"
                      style={{
                        left: `clamp(36px, ${pct}%, calc(100% - 36px))`,
                        bottom: '24px',
                        height: `${stemHeight}px`,
                      }}
                    />

                    {/* Colored Dot on the Baseline Track */}
                    <div
                      className="absolute w-2.5 h-2.5 rounded-full border border-white shadow-xs pointer-events-none transform -translate-x-1/2"
                      style={{
                        left: `clamp(36px, ${pct}%, calc(100% - 36px))`,
                        bottom: '22px',
                        backgroundColor: faction.color,
                      }}
                    />

                    {/* Staggered Badge */}
                    <div
                      className="absolute transform -translate-x-1/2 z-10"
                      style={{
                        left: `clamp(36px, ${pct}%, calc(100% - 36px))`,
                        bottom: `${bottomOffset}px`,
                      }}
                    >
                      <div
                        title={tooltip}
                        className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-2xs hover:shadow-xs hover:border-slate-400 transition cursor-help whitespace-nowrap select-none"
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: faction.color }}
                        />
                        <span className="text-[11px] font-mono font-bold text-slate-800">
                          {faction.shortName}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 font-medium">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Axis Endpoint & Midpoint Labels */}
              <div className="absolute left-0 bottom-0 text-[10px] font-mono font-bold text-rose-800">
                0% (Pret / Atturas)
              </div>
              <div className="absolute left-1/2 transform -translate-x-1/2 bottom-0 text-[10px] font-mono text-slate-400">
                50% (Sadalīts)
              </div>
              <div className="absolute right-0 bottom-0 text-[10px] font-mono font-bold text-emerald-800 text-right">
                100% (Par)
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: IZŠĶIROŠIE LŪZUMA PUNKTI (FLASHPOINTS — MAX 2-3 VOTES) */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-rose-600" />
                <span>Izšķirošie lūzuma punkti</span>
              </h3>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Šīs nozares balsojumi ar asāko pretrunu un šaurāko balsu starpību (|Par − (Pret + Atturas)| ≤ 10). Noklikšķiniet uz kartītes, lai atvērtu zāles izvietojumu.
              </p>
            </div>
            {flashpointVotes.length > 0 && (
              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0 self-start sm:self-auto">
                {flashpointVotes.length} saspringti balsojumi
              </span>
            )}
          </div>

          {flashpointVotes.length === 0 ? (
            /* Consensual Sector Fallback Banner */
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                  Vienprātīga nozare
                </div>
                <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                  Šajā nozarē nav reģistrēti saspringti balsojumi — visi lēmumi pieņemti ar pārliecinošu vairākumu.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {flashpointVotes.map((vote) => (
                <VoteCard
                  key={vote.id}
                  vote={vote}
                  onSelect={onSelectVote}
                  showFactionStances={true}
                />
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: FRAKCIJU SASKAŅA NOZARĒ (PAIRWISE AGREEMENT — CURATED EXTREMES) */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <GitCompare className="h-3.5 w-3.5 text-blue-600" />
              <span>Frakciju saskaņa nozarē</span>
            </h3>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Ciešākā saskaņa un lielākā pretstāve balsojumos, kuros abas frakcijas pauda skaidru nostāju.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Column 1: Ciešākā saskaņa nozarē */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs uppercase tracking-wider pb-1.5 border-b border-emerald-100">
                <Handshake className="h-4 w-4 text-emerald-600" />
                <span>Ciešākā saskaņa nozarē</span>
              </div>

              {pairwiseExtremes.highestPairs.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">Nav pietiekami daudz salīdzināmu balsojumu</p>
              ) : (
                <div className="space-y-2">
                  {pairwiseExtremes.highestPairs.map(({ faction1, faction2, agreePct, agreeCount, totalCount }) => (
                    <div
                      key={`${faction1.id}_${faction2.id}`}
                      className="rounded-lg bg-white border border-emerald-100 p-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Factions */}
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: faction1.color }} />
                            <span className="text-xs font-mono font-bold text-slate-900">{faction1.shortName}</span>
                          </div>
                          <span className="text-xs text-slate-400 font-bold">↔</span>
                          <div className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: faction2.color }} />
                            <span className="text-xs font-mono font-bold text-slate-900">{faction2.shortName}</span>
                          </div>
                        </div>

                        {/* Agreement Metric */}
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            {agreePct}% vienoti
                          </span>
                        </div>
                      </div>

                      {/* Mini Bar & Counts */}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${agreePct}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {agreeCount} no {totalCount} balsojumiem
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Lielākā pretstāve */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/30 p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-rose-900 font-bold text-xs uppercase tracking-wider pb-1.5 border-b border-rose-100">
                <Flame className="h-4 w-4 text-rose-600" />
                <span>Lielākā pretstāve</span>
              </div>

              {pairwiseExtremes.lowestPairs.length === 0 ? (
                <p className="text-xs text-slate-500 py-3 text-center">Nav pietiekami daudz salīdzināmu balsojumu</p>
              ) : (
                <div className="space-y-2">
                  {pairwiseExtremes.lowestPairs.map(({ faction1, faction2, agreePct, agreeCount, totalCount }) => (
                    <div
                      key={`${faction1.id}_${faction2.id}`}
                      className="rounded-lg bg-white border border-rose-100 p-2.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Factions */}
                        <div className="flex items-center gap-2">
                          <div className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: faction1.color }} />
                            <span className="text-xs font-mono font-bold text-slate-900">{faction1.shortName}</span>
                          </div>
                          <span className="text-xs text-slate-400 font-bold">↔</span>
                          <div className="inline-flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: faction2.color }} />
                            <span className="text-xs font-mono font-bold text-slate-900">{faction2.shortName}</span>
                          </div>
                        </div>

                        {/* Agreement Metric */}
                        <div className="text-right">
                          <span className="text-xs font-mono font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                            {agreePct}% vienoti
                          </span>
                        </div>
                      </div>

                      {/* Mini Bar & Counts */}
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-rose-500 rounded-full" style={{ width: `${agreePct}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {agreeCount} no {totalCount} balsojumiem
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* SECTION 4: DEEP AUDIT CTA (OFF-RAMP TO RAW DATA) */}
        <section className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Vēlaties pētīt visus {activeSectorVotes.length} šīs nozares balsojumus atsevišķi?
              </h4>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                Pārejiet uz pilno balsojumu sarakstu ar jau atlasītu nozares filtru, lai meklētu konkrētus likumprojektus un skatītu stenogrammas.
              </p>
            </div>

            {onSelectCategory && (
              <button
                type="button"
                onClick={() => onSelectCategory(activeSector.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-2xs transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>➔ Pāriet uz Balsojumu sarakstu ar filtru "{activeSector.shortTitle}"</span>
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  // =========================================================================
  // RENDER TIER 1: MACRO VIEW (#radars)
  // =========================================================================
  return (
    <div className="space-y-4">
      {/* Hero Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-md bg-slate-900 text-white">
                <Layers className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                Tematiskais politikas radars
              </h2>
            </div>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Parlamentārās saskaņas un šķelšanās radars. Atklājiet, kurās nozarēs Saeimā valda vienprātība, kur veidojas asākās pretrunas, un izpētiet detalizēto nozares griezumu.
            </p>
          </div>
          <div className="text-right flex-shrink-0 self-start sm:self-auto">
            <span className="text-[11px] text-slate-500 font-mono font-medium">
              {votes.length} balsojumi · 6 nozares
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 1: NOZARU PĀRSKATA KARTĪTES (DOMAIN CARDS GRID) */}
      <SectorCardGrid
        domains={CIVIC_DOMAINS}
        domainStatsMap={domainStatsMap}
        onSelectSector={handleOpenSector}
      />

      {/* SECTION 2: FRAKCIJU DIVPUSĒJAIS SALĪDZINĀTĀJS (HEAD-TO-HEAD COMPARATOR) */}
      <FactionComparator
        votes={votes}
        factions={orderedFactions}
        onSelectVote={onSelectVote}
      />

      {/* SECTION 3: FRAKCIJU NOZARU MATRICA (CROSS-TOPIC AGREEMENT TABLE) */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <span>Frakciju nozaru matrica</span>
              <span className="text-[10px] text-slate-500 lowercase font-normal">
                (noklikšķiniet uz rindas, lai atvērtu nozari)
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
                  Nozare / Temats
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

                {/* Deep Dive Action Column */}
                <th scope="col" className="py-2.5 px-2 text-center w-12" aria-label="Atvērt nozari" />
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {CIVIC_DOMAINS.map((domain) => {
                const dStats = domainStatsMap.get(domain.id);
                const Icon = domain.icon;

                return (
                  <tr
                    key={domain.id}
                    onClick={() => handleOpenSector(domain.id)}
                    className="group hover:bg-blue-50/40 transition cursor-pointer"
                  >
                    {/* Domain Title with Icon and Count */}
                    <td className="py-2.5 px-3 align-middle">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-2 truncate">
                          <div className={`p-1 rounded ${domain.iconBg} ${domain.iconColor} shrink-0`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-slate-900 group-hover:text-blue-900 font-medium truncate">
                            {domain.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-1">
                          {dStats?.totalVotes || 0}
                        </span>
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

                    {/* Navigation arrow */}
                    <td className="py-2 px-2 text-center align-middle">
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all inline" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Methodology Footer */}
      <footer className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-start gap-3 text-xs text-slate-600">
        <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800">Par radara metodoloģiju:</strong> Matrica un nozaru kartītes aprēķina katras frakcijas aktīvo deputātu atbalsta īpatsvaru (balsots "PAR" %) konkrētajā nozarē. Frakcijas sakārtotas pēc mandātu skaita Saeimā. Politiskā ass, izšķirošie lūzuma punkti un frakciju saskaņas pāri ir pieejami katras nozares dziļajā griezumā. Visi dati balstīti uz oficiālajiem Saeimas sēžu protokoliem bez politiskiem pieņēmumiem.
        </div>
      </footer>
    </div>
  );
};
