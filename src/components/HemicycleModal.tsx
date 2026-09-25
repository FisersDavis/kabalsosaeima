import React, { useState, useMemo, useEffect } from 'react';
import type { Vote, MP, Faction, VoteDecision } from '../types';
import { X, Search, Lock, AlertTriangle } from 'lucide-react';

interface HemicycleModalProps {
  vote: Vote;
  mps: MP[];
  factions: Faction[];
  onClose: () => void;
}

export const HemicycleModal: React.FC<HemicycleModalProps> = ({
  vote,
  mps,
  factions,
  onClose,
}) => {
  const [hoveredMp, setHoveredMp] = useState<{
    mp: MP;
    decision: VoteDecision;
    faction?: Faction;
    x: number;
    y: number;
    isSubstitute?: boolean;
    replacesMpName?: string;
  } | null>(null);

  const [filterDecision, setFilterDecision] = useState<string>('ALL');
  const [filterFaction, setFilterFaction] = useState<string>('ALL');
  const [searchMp, setSearchMp] = useState<string>('');

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const factionLookup = useMemo(() => {
    const map = new Map<string, Faction>();
    factions.forEach((f) => map.set(f.id, f));
    return map;
  }, [factions]);

  // Lookup MP vote and substitute status snapshot
  const mpVoteRecordMap = useMemo(() => {
    const map = new Map<string, { decision: VoteDecision; isSubstitute?: boolean; replacesMpName?: string }>();
    vote.mpVotes?.forEach((mv) => map.set(mv.mpId, {
      decision: mv.decision,
      isSubstitute: mv.isSubstitute,
      replacesMpName: mv.replacesMpName
    }));
    return map;
  }, [vote]);

  // Generate 100 hemicycle seat coordinates in 4 concentric semi-circular arcs
  const seatPositions = useMemo(() => {
    if (vote.isSecret || !vote.mpVotes || vote.mpVotes.length === 0) return [];

    const seats: { mp: MP; x: number; y: number; decision: VoteDecision; isSubstitute?: boolean; replacesMpName?: string }[] = [];
    
    // Rows distribution for 100 seats: [18, 24, 28, 30] = 100 seats
    const rows = [
      { radius: 120, count: 18 },
      { radius: 170, count: 24 },
      { radius: 220, count: 28 },
      { radius: 270, count: 30 },
    ];

    let mpIdx = 0;
    const centerX = 320;
    const centerY = 300;

    rows.forEach((row) => {
      const angleStep = Math.PI / (row.count + 1);
      for (let i = 1; i <= row.count; i++) {
        if (mpIdx >= mps.length) break;
        const angle = Math.PI - i * angleStep; // Left to right semicircle
        const x = centerX + row.radius * Math.cos(angle);
        const y = centerY - row.radius * Math.sin(angle);
        const mp = mps[mpIdx];
        const record = mpVoteRecordMap.get(mp.id);
        const decision = record?.decision || 'NEBALSO';

        seats.push({
          mp,
          x,
          y,
          decision,
          isSubstitute: record?.isSubstitute || mp.isSubstitute,
          replacesMpName: record?.replacesMpName || mp.replacesMpName
        });
        mpIdx++;
      }
    });

    return seats;
  }, [mps, mpVoteRecordMap, vote]);

  // Sober Pine / Brick / Ochre / Slate color mapping
  const getDecisionColor = (decision: VoteDecision) => {
    switch (decision) {
      case 'PAR':
        return '#15803D'; // Pine Forest Green
      case 'PRET':
        return '#991B1B'; // Muted Brick
      case 'ATTURAS':
        return '#B45309'; // Amber Ochre
      case 'NEBALSO':
      default:
        return '#64748B'; // Fog Slate
    }
  };

  const getDecisionBadge = (decision: VoteDecision) => {
    switch (decision) {
      case 'PAR':
        return <span className="text-emerald-800 font-bold">PAR</span>;
      case 'PRET':
        return <span className="text-red-800 font-bold">PRET</span>;
      case 'ATTURAS':
        return <span className="text-amber-800 font-bold">ATTURAS</span>;
      case 'NEBALSO':
      default:
        return <span className="text-slate-400 font-medium">NEBALSOJA</span>;
    }
  };

  const filteredSeats = useMemo(() => {
    return seatPositions.filter(({ mp, decision }) => {
      if (filterDecision !== 'ALL' && decision !== filterDecision) return false;
      if (filterFaction !== 'ALL' && mp.factionId !== filterFaction) return false;
      if (searchMp && !mp.name.toLowerCase().includes(searchMp.toLowerCase())) return false;
      return true;
    });
  }, [seatPositions, filterDecision, filterFaction, searchMp]);

  const hasQuorum = vote.counts.totalPresent >= 50;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-xl border border-slate-300 bg-white shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
                {vote.billNumber}
              </span>
              <span className="font-mono text-xs text-slate-500">
                {vote.sittingDate} · {vote.sittingTime}
              </span>

              {/* Status Outcome Badge */}
              {vote.result === 'NAV_KVORUMA' ? (
                <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold border border-amber-300 bg-amber-50 text-amber-900">
                  <AlertTriangle className="h-3 w-3" />
                  NAV KVORUMA (&lt; 50)
                </span>
              ) : (
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-bold border ${
                    vote.result === 'PIENEMTS'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  {vote.result === 'PIENEMTS' ? 'PIEŅEMTS' : 'NORAIDĪTS'}
                </span>
              )}

              {vote.isSecret && (
                <span className="rounded px-2 py-0.5 text-[11px] font-bold bg-slate-200 text-slate-800">
                  AIZKLĀTS BALSOJUMS
                </span>
              )}
            </div>
            <h2 className="mt-1 text-base sm:text-lg font-bold text-slate-900 line-clamp-1">
              {vote.simplifiedTitle}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {vote.isSecret ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-8 text-center space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-slate-700">
                <Lock className="h-6 w-6" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-base font-bold text-slate-900">
                  Aizklāts balsojums (Satversmes un Kārtības ruļļa procedūra)
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Saskaņā ar Satversmi un Saeimas kārtības rulli amatpersonu vēlēšanās individuālie deputātu balsojumi netiek fiksēti un nav publiski pieejami.
                </p>
              </div>

              {/* Tally Box */}
              <div className="inline-flex items-center gap-6 rounded border border-slate-300 bg-white px-6 py-3 shadow-sm font-mono text-sm">
                <span className="text-emerald-700 font-bold">{vote.counts.par} Par</span>
                <span className="text-red-700 font-bold">{vote.counts.pret} Pret</span>
                <span className="text-amber-700 font-bold">{vote.counts.atturas} Atturas</span>
                <span className="text-slate-500 font-bold">{vote.counts.nebalso} Nebalsoja</span>
              </div>
            </div>
          ) : (
            <>
              {/* Main Visual: Plenary Hemicycle */}
              <div className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex flex-col items-center">
                <div className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 mb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700">
                      Saeimas Sēžu zāles balsojuma karte (100 vietas):
                    </span>
                    {!hasQuorum && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
                        Nav kvoruma (&lt; 50)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 font-mono font-medium">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <span className="h-2 w-2 rounded-sm bg-emerald-700" />
                      {vote.counts.par} Par
                    </span>
                    <span className="flex items-center gap-1.5 text-red-700">
                      <span className="h-2 w-2 rounded-sm bg-red-700" />
                      {vote.counts.pret} Pret
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-700">
                      <span className="h-2 w-2 rounded-sm bg-amber-600" />
                      {vote.counts.atturas} Atturas
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <span className="h-2 w-2 rounded-sm bg-slate-400" />
                      {vote.counts.nebalso} Nebalsoja
                    </span>
                  </div>
                </div>

                {/* SVG Hemicycle */}
                <div className="relative w-full max-w-2xl aspect-[640/340]">
                  <svg viewBox="0 0 640 330" className="w-full h-full select-none">
                    <path
                      d="M260 300 Q320 280 380 300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-slate-300"
                    />
                    <text
                      x="320"
                      y="320"
                      textAnchor="middle"
                      className="fill-slate-400 text-[10px] uppercase font-mono tracking-widest"
                    >
                      Prezidija tribīne
                    </text>

                    {seatPositions.map(({ mp, x, y, decision, isSubstitute, replacesMpName }) => {
                      const isHovered = hoveredMp?.mp.id === mp.id;
                      const faction = factionLookup.get(mp.factionId);
                      const isMatchFilter =
                        (filterDecision === 'ALL' || decision === filterDecision) &&
                        (filterFaction === 'ALL' || mp.factionId === filterFaction) &&
                        (!searchMp || mp.name.toLowerCase().includes(searchMp.toLowerCase()));

                      return (
                        <g key={mp.id}>
                          <circle
                            cx={x}
                            cy={y}
                            r={isHovered ? 7.5 : 6}
                            fill={getDecisionColor(decision)}
                            opacity={isMatchFilter ? 1 : 0.2}
                            className="cursor-pointer transition-all duration-100 hover:stroke-white"
                            strokeWidth={isHovered ? 2.5 : 1}
                            stroke={isHovered ? '#ffffff' : 'rgba(0,0,0,0.15)'}
                            onMouseEnter={() =>
                              setHoveredMp({ mp, decision, faction, x, y, isSubstitute, replacesMpName })
                            }
                            onMouseLeave={() => setHoveredMp(null)}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Tooltip Card */}
                  {hoveredMp && (
                    <div
                      className="absolute pointer-events-none z-30 rounded border border-slate-300 bg-white p-2.5 shadow-lg text-xs transform -translate-x-1/2 -translate-y-full mb-3"
                      style={{
                        left: `${(hoveredMp.x / 640) * 100}%`,
                        top: `${(hoveredMp.y / 330) * 100}%`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-bold text-slate-900">
                          {hoveredMp.mp.name}
                        </span>
                        <span
                          className="rounded px-1.5 py-0.2 text-[10px] font-mono font-bold text-white"
                          style={{ backgroundColor: hoveredMp.faction?.color || '#64748B' }}
                        >
                          {hoveredMp.faction?.shortName}
                        </span>
                      </div>

                      {hoveredMp.isSubstitute && (
                        <div className="mb-1 text-[10px] text-amber-700 font-medium">
                          ✦ Mīkstais mandāts {hoveredMp.replacesMpName ? `(${hoveredMp.replacesMpName})` : ''}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-4 text-slate-500 text-[11px] font-mono">
                        <span>Vieta #{hoveredMp.mp.seatNumber}</span>
                        <div>Balsojums: {getDecisionBadge(hoveredMp.decision)}</div>
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Uzbrauciet ar kursoru uz jebkura apļa, lai redzētu deputāta vārdu un individuālo lēmumu.
                </p>
              </div>

              {/* Filtering Controls */}
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Decision filter */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterDecision('ALL')}
                      className={`rounded px-2.5 py-1 font-medium transition ${
                        filterDecision === 'ALL'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Visi ({vote.counts.par + vote.counts.pret + vote.counts.atturas + vote.counts.nebalso})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterDecision('PAR')}
                      className={`rounded px-2.5 py-1 font-medium transition ${
                        filterDecision === 'PAR'
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Par ({vote.counts.par})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterDecision('PRET')}
                      className={`rounded px-2.5 py-1 font-medium transition ${
                        filterDecision === 'PRET'
                          ? 'bg-red-700 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Pret ({vote.counts.pret})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterDecision('ATTURAS')}
                      className={`rounded px-2.5 py-1 font-medium transition ${
                        filterDecision === 'ATTURAS'
                          ? 'bg-amber-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Atturas ({vote.counts.atturas})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterDecision('NEBALSO')}
                      className={`rounded px-2.5 py-1 font-medium transition ${
                        filterDecision === 'NEBALSO'
                          ? 'bg-slate-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Nebalsoja ({vote.counts.nebalso})
                    </button>
                  </div>

                  {/* MP Search */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchMp}
                      onChange={(e) => setSearchMp(e.target.value)}
                      placeholder="Meklēt deputātu..."
                      className="w-full rounded border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-slate-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Faction Filter buttons */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setFilterFaction('ALL')}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium transition ${
                      filterFaction === 'ALL'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    Visas frakcijas
                  </button>
                  {factions.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilterFaction(f.id)}
                      className={`rounded px-2 py-0.5 text-[11px] font-mono font-medium transition ${
                        filterFaction === f.id
                          ? 'text-white shadow-sm ring-1 ring-white/20'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                      style={{
                        backgroundColor: filterFaction === f.id ? f.color : 'transparent',
                        border: `1px solid ${filterFaction === f.id ? f.color : '#cbd5e1'}`,
                      }}
                    >
                      {f.shortName}
                    </button>
                  ))}
                </div>
              </div>

              {/* 100 MPs List Grid */}
              <div className="border rounded border-slate-200 overflow-hidden">
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-600">
                      <tr>
                        <th className="py-2 px-3 font-semibold">Deputāts</th>
                        <th className="py-2 px-3 font-semibold">Frakcija</th>
                        <th className="py-2 px-3 font-semibold text-right">Lēmums</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans">
                      {filteredSeats.map(({ mp, decision, isSubstitute, replacesMpName }) => {
                        const faction = factionLookup.get(mp.factionId);
                        return (
                          <tr
                            key={mp.id}
                            className="hover:bg-slate-50 transition"
                          >
                            <td className="py-2 px-3 font-medium text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>{mp.name}</span>
                                {isSubstitute && (
                                  <span className="rounded bg-amber-100 px-1 text-[9px] font-medium text-amber-800" title={`Aizvieto ${replacesMpName || 'ministru'}`}>
                                    Mīkstais mandāts
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className="inline-flex rounded px-1.5 py-0.2 font-mono text-[10px] font-bold text-white"
                                style={{ backgroundColor: faction?.color || '#64748B' }}
                              >
                                {faction?.shortName}
                              </span>
                              <span className="ml-1.5 text-slate-500 text-[11px] hidden sm:inline">
                                {faction?.name}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right">
                              {getDecisionBadge(decision)}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredSeats.length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-400">
                            Nav atrasts neviens deputāts ar izvēlētajiem filtriem.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
