import React, { useState, useMemo, useEffect } from 'react';
import type { Vote, MP, Faction, VoteDecision } from '../types';
import { X, Search, Lock, AlertTriangle } from 'lucide-react';

interface HemicycleModalProps {
  vote: Vote;
  mps: MP[];
  factions: Faction[];
  onClose: () => void;
}

// Strips redundant Latvian parliamentary preamble filler from titles
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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

// Political seating sector order from parliamentary left to right
const FACTION_SECTOR_ORDER = ['pro', 'jv', 'zzs', 'as', 'na', 'lpv', 'st', 'ind'];

export const HemicycleModal: React.FC<HemicycleModalProps> = ({
  vote,
  mps,
  factions,
  onClose,
}) => {
  const [hoveredMpId, setHoveredMpId] = useState<string | null>(null);
  const [selectedMpId, setSelectedMpId] = useState<string | null>(null);
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
    vote.mpVotes?.forEach((mv) =>
      map.set(mv.mpId, {
        decision: mv.decision,
        isSubstitute: mv.isSubstitute,
        replacesMpName: mv.replacesMpName,
      })
    );
    return map;
  }, [vote]);

  // Exactly 100 active voting deputies (excluding inactive ministers with paused mandates)
  const activeMps = useMemo(() => {
    const active = mps.filter((m) => m.isActive !== false);
    // Sort into parliamentary seating blocks: by faction sector order, then seat number
    return active.sort((a, b) => {
      const idxA = FACTION_SECTOR_ORDER.indexOf(a.factionId);
      const idxB = FACTION_SECTOR_ORDER.indexOf(b.factionId);
      const orderA = idxA === -1 ? 99 : idxA;
      const orderB = idxB === -1 ? 99 : idxB;
      if (orderA !== orderB) return orderA - orderB;
      return a.seatNumber - b.seatNumber;
    });
  }, [mps]);

  // Generate 100 hemicycle seat coordinates in 4 concentric semi-circular arcs
  const seatPositions = useMemo(() => {
    if (vote.isSecret || !vote.mpVotes || vote.mpVotes.length === 0) return [];

    // Rows distribution for 100 seats: [18, 24, 28, 30] = 100 seats
    const rows = [
      { radius: 130, count: 18 },
      { radius: 180, count: 24 },
      { radius: 230, count: 28 },
      { radius: 280, count: 30 },
    ];

    const centerX = 320;
    const centerY = 295;
    const rawSeats: { angle: number; rowIdx: number; radius: number; x: number; y: number }[] = [];

    rows.forEach((row, rowIdx) => {
      const angleStep = Math.PI / (row.count + 1);
      for (let i = 1; i <= row.count; i++) {
        const angle = Math.PI - i * angleStep;
        rawSeats.push({
          angle,
          rowIdx,
          radius: row.radius,
          x: Math.round((centerX + row.radius * Math.cos(angle)) * 10) / 10,
          y: Math.round((centerY - row.radius * Math.sin(angle)) * 10) / 10,
        });
      }
    });

    // Sort polar angles descending so MPs flow sector-by-sector from left to right of the chamber
    rawSeats.sort((a, b) => b.angle - a.angle || a.rowIdx - b.rowIdx);

    return rawSeats.map((pos, idx) => {
      const mp = activeMps[idx] || mps[idx];
      const record = mp ? mpVoteRecordMap.get(mp.id) : undefined;
      const decision: VoteDecision = record?.decision || 'NEBALSO';

      return {
        mp,
        x: pos.x,
        y: pos.y,
        decision,
        isSubstitute: record?.isSubstitute || mp?.isSubstitute,
        replacesMpName: record?.replacesMpName || mp?.replacesMpName,
      };
    });
  }, [activeMps, mps, mpVoteRecordMap, vote]);

  const getDecisionColor = (decision: VoteDecision) => {
    switch (decision) {
      case 'PAR':
        return '#059669'; // Emerald 600
      case 'PRET':
        return '#e11d48'; // Rose 600
      case 'ATTURAS':
        return '#d97706'; // Amber 600
      case 'NEBALSO':
      default:
        return '#94a3b8'; // Slate 400
    }
  };

  const getDecisionBadge = (decision: VoteDecision) => {
    switch (decision) {
      case 'PAR':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            PAR
          </span>
        );
      case 'PRET':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            PRET
          </span>
        );
      case 'ATTURAS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            ATTURAS
          </span>
        );
      case 'NEBALSO':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
            NEBALSOJA
          </span>
        );
    }
  };

  // Filtered seat list for the audit table
  const filteredSeats = useMemo(() => {
    return seatPositions.filter(({ mp, decision }) => {
      if (filterDecision !== 'ALL' && decision !== filterDecision) return false;
      if (filterFaction !== 'ALL' && mp.factionId !== filterFaction) return false;
      if (searchMp.trim() && !mp.name.toLowerCase().includes(searchMp.toLowerCase().trim())) return false;
      return true;
    });
  }, [seatPositions, filterDecision, filterFaction, searchMp]);

  // Current active MP for the inspector card (hovered or clicked)
  const activeSeat = useMemo(() => {
    const targetId = hoveredMpId || selectedMpId;
    if (!targetId) return null;
    return seatPositions.find((s) => s.mp.id === targetId) || null;
  }, [hoveredMpId, selectedMpId, seatPositions]);

  // Intentional click on seat: highlights and scrolls table directly to that deputy
  const handleSeatClick = (mpId: string) => {
    setSelectedMpId(mpId);
    setHoveredMpId(mpId);
    const rowEl = document.getElementById(`mp-row-${mpId}`);
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const hasQuorum = vote.counts.totalPresent >= 50;
  const cleanedTitle = cleanVoteTitle(vote.simplifiedTitle || vote.officialTitle);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Locked modal frame with rigid height to prevent layout shifts on filtering */}
      <div
        className="relative flex flex-col w-full max-w-6xl h-[85vh] min-h-[580px] max-h-[760px] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/80 gap-3 shrink-0">
          <div className="min-w-0 pr-2">
            <div className="flex flex-wrap items-center gap-2">
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

            <h2 className="mt-1 text-sm sm:text-base font-bold text-slate-900 truncate" title={vote.simplifiedTitle}>
              {cleanedTitle}
            </h2>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Top Search Bar */}
            {!vote.isSecret && (
              <div className="relative w-44 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchMp}
                  onChange={(e) => setSearchMp(e.target.value)}
                  placeholder="Meklēt deputātu..."
                  className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none transition shadow-2xs"
                />
                {searchMp && (
                  <button
                    type="button"
                    onClick={() => setSearchMp('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition cursor-pointer"
              aria-label="Aizvērt"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Side-by-side desktop layout, locked vertical height */}
        {vote.isSecret ? (
          <div className="flex-1 p-8 sm:p-12 text-center space-y-5 flex flex-col items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 border border-slate-200">
              <Lock className="h-7 w-7" />
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
            <div className="inline-flex items-center gap-6 rounded-lg border border-slate-200 bg-slate-50 px-6 py-3 font-mono text-xs sm:text-sm">
              <span className="text-emerald-700 font-bold">{vote.counts.par} Par</span>
              <span className="text-rose-700 font-bold">{vote.counts.pret} Pret</span>
              <span className="text-amber-700 font-bold">{vote.counts.atturas} Atturas</span>
              <span className="text-slate-500 font-bold">{vote.counts.nebalso} Nebalsoja</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col lg:flex-row min-h-0">
            {/* Left Pane: Plenary Hemicycle Diagram */}
            <div className="lg:w-[48%] xl:w-[50%] p-4 sm:p-5 bg-slate-50/60 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col min-h-0 overflow-y-auto gap-3">
              {/* Consolidate Header Tally into a single clean line */}
              <div className="flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-slate-800">Sēžu zāle</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-medium text-emerald-700">{vote.counts.par} Par</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-medium text-rose-700">{vote.counts.pret} Pret</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-medium text-amber-700">{vote.counts.atturas} Atturas</span>
                  <span className="text-slate-400">·</span>
                  <span className="font-medium text-slate-500">{vote.counts.nebalso} Nebalsoja</span>
                  {!hasQuorum && (
                    <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                      Nav kvoruma (&lt; 50)
                    </span>
                  )}
                </div>
              </div>

              {/* SVG Hemicycle Diagram: Scaled up to fill column width and target comfortably */}
              <div className="relative w-full aspect-[640/310] max-w-xl mx-auto shrink-0 my-1">
                <svg viewBox="0 0 640 310" className="w-full h-full select-none">
                  {/* 100 Active Voting Seats */}
                  {seatPositions.map(({ mp, x, y, decision }) => {
                    const isHoveredOrSelected = hoveredMpId === mp.id || selectedMpId === mp.id;
                    const isMatchFilter =
                      (filterDecision === 'ALL' || decision === filterDecision) &&
                      (filterFaction === 'ALL' || mp.factionId === filterFaction) &&
                      (!searchMp.trim() || mp.name.toLowerCase().includes(searchMp.toLowerCase().trim()));

                    return (
                      <g key={mp.id}>
                        {/* Clear Focus Halo on Hover / Click */}
                        {isHoveredOrSelected && (
                          <>
                            <circle
                              cx={x}
                              cy={y}
                              r={15}
                              fill="none"
                              stroke="#0284c7"
                              strokeWidth="2.5"
                              opacity="0.6"
                              className="pointer-events-none"
                            />
                            <circle
                              cx={x}
                              cy={y}
                              r={12}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="2"
                              className="pointer-events-none"
                            />
                          </>
                        )}
                        <circle
                          cx={x}
                          cy={y}
                          r={isHoveredOrSelected ? 10.5 : 7.5}
                          fill={getDecisionColor(decision)}
                          opacity={isMatchFilter ? 1 : 0.15}
                          className="cursor-pointer transition-all duration-100"
                          strokeWidth={isHoveredOrSelected ? 2.5 : 1}
                          stroke={isHoveredOrSelected ? '#0f172a' : '#ffffff'}
                          onMouseEnter={() => setHoveredMpId(mp.id)}
                          onMouseLeave={() => setHoveredMpId(null)}
                          onClick={() => handleSeatClick(mp.id)}
                        />
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* Active Inspector Card: Locked fixed height to eliminate hover layout shifts */}
              <div className="h-[76px] shrink-0 pt-2 border-t border-slate-200/80">
                {activeSeat ? (
                  <div className="h-full flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-xs animate-in fade-in duration-100">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      {/* Initials Avatar Badge */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 select-none border"
                        style={{
                          backgroundColor: (factionLookup.get(activeSeat.mp.factionId)?.color || '#64748B') + '18',
                          borderColor: (factionLookup.get(activeSeat.mp.factionId)?.color || '#64748B') + '40',
                          color: factionLookup.get(activeSeat.mp.factionId)?.color || '#0f172a',
                        }}
                      >
                        {getInitials(activeSeat.mp.name)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm truncate">
                            {activeSeat.mp.name}
                          </span>
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-white shrink-0"
                            style={{
                              backgroundColor: factionLookup.get(activeSeat.mp.factionId)?.color || '#64748B',
                            }}
                          >
                            {factionLookup.get(activeSeat.mp.factionId)?.shortName ||
                              activeSeat.mp.factionId.toUpperCase()}
                          </span>
                          {activeSeat.isSubstitute && (
                            <span className="inline-flex rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-medium text-amber-800 border border-amber-200 shrink-0">
                              ✦ Mīkstais mandāts
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                          {factionLookup.get(activeSeat.mp.factionId)?.name}
                          {activeSeat.replacesMpName && (
                            <span className="ml-1 text-slate-400">· {activeSeat.replacesMpName}</span>
                          )}
                          <span className="ml-1 text-slate-400">· Vieta #{activeSeat.mp.seatNumber}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[10px] uppercase font-mono text-slate-400 mb-0.5">
                        Balsojums
                      </div>
                      {getDecisionBadge(activeSeat.decision)}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/70 px-3 text-center text-xs text-slate-400 select-none">
                    Uzbrauciet vai uzklikšķiniet uz deputāta vietas, lai redzētu balsojumu.
                  </div>
                )}
              </div>
            </div>

            {/* Right Pane: Filterable Audit Table (Isolated scroll area) */}
            <div className="lg:w-[52%] xl:w-[50%] flex flex-col min-h-0 bg-white">
              {/* Controls bar: Outcome pills + Clean standalone Faction dropdown */}
              <div className="p-3 sm:p-4 border-b border-slate-200 bg-white space-y-2.5 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Decision filter pills */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterDecision('ALL')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        filterDecision === 'ALL'
                          ? 'bg-slate-800 text-white shadow-2xs font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Visi (100)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterDecision('PAR')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        filterDecision === 'PAR'
                          ? 'bg-emerald-700 text-white shadow-2xs font-semibold'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                      }`}
                    >
                      Par ({vote.counts.par})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterDecision('PRET')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        filterDecision === 'PRET'
                          ? 'bg-rose-700 text-white shadow-2xs font-semibold'
                          : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                      }`}
                    >
                      Pret ({vote.counts.pret})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterDecision('ATTURAS')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        filterDecision === 'ATTURAS'
                          ? 'bg-amber-600 text-white shadow-2xs font-semibold'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                      }`}
                    >
                      Atturas ({vote.counts.atturas})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterDecision('NEBALSO')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        filterDecision === 'NEBALSO'
                          ? 'bg-slate-600 text-white shadow-2xs font-semibold'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Nebalsoja ({vote.counts.nebalso})
                    </button>
                  </div>

                  {/* Clean Faction selector dropdown without loose text label */}
                  <select
                    id="faction-select"
                    value={filterFaction}
                    onChange={(e) => setFilterFaction(e.target.value)}
                    aria-label="Filtrēt pēc frakcijas"
                    className="rounded-lg border border-slate-300 bg-white py-1 px-2.5 text-xs text-slate-800 font-medium focus:border-slate-500 focus:outline-none transition shadow-2xs cursor-pointer hover:border-slate-400"
                  >
                    <option value="ALL">Visas frakcijas (100)</option>
                    {factions.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.shortName} · {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Scrollable Audit Table: fills 100% vertical space without shrinking */}
              <div className="flex-1 overflow-y-auto min-h-0 bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm text-slate-600 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 text-left">Deputāts</th>
                      <th className="py-2.5 px-2 text-center w-24">Frakcija</th>
                      <th className="py-2.5 px-4 text-right w-28">Lēmums</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {filteredSeats.map(({ mp, decision, isSubstitute, replacesMpName }) => {
                      const faction = factionLookup.get(mp.factionId);
                      const isHoveredOrSelected = hoveredMpId === mp.id || selectedMpId === mp.id;

                      return (
                        <tr
                          id={`mp-row-${mp.id}`}
                          key={mp.id}
                          onMouseEnter={() => setHoveredMpId(mp.id)}
                          onMouseLeave={() => setHoveredMpId(null)}
                          onClick={() => setSelectedMpId(mp.id)}
                          className={`transition-colors cursor-pointer ${
                            isHoveredOrSelected
                              ? 'bg-sky-50 ring-1 ring-inset ring-sky-300'
                              : 'hover:bg-slate-50/80'
                          }`}
                        >
                          {/* Deputy name with discreet asterisk for substitute MPs */}
                          <td className="py-2.5 px-4 font-medium text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>{mp.name}</span>
                              {isSubstitute && (
                                <span
                                  className="text-amber-600 font-bold text-xs cursor-help select-none"
                                  title={replacesMpName ? `Mīkstais mandāts (${replacesMpName})` : 'Mīkstais mandāts'}
                                >
                                  *
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Abbreviated Faction badge centered with uniform width for razor-sharp column scanning */}
                          <td className="py-2.5 px-2 text-center w-24">
                            <span
                              className="inline-flex items-center justify-center min-w-[42px] rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white shadow-2xs"
                              style={{ backgroundColor: faction?.color || '#64748B' }}
                            >
                              {faction?.shortName || mp.factionId.toUpperCase()}
                            </span>
                          </td>

                          {/* Decision badge */}
                          <td className="py-2.5 px-4 text-right w-28">
                            {getDecisionBadge(decision)}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredSeats.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-slate-400">
                          Nav atrasts neviens deputāts ar izvēlētajiem filtriem.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Safe bottom spacer so the last row is never cut off or flush against the footer border */}
                <div className="h-4" />
              </div>

              {/* Table Footer status: locked to bottom */}
              <div className="px-4 py-2.5 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between shrink-0 z-10 shadow-[0_-2px_6px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-2">
                  <span>Rāda: {filteredSeats.length} no 100 deputātiem</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">* Mīkstais mandāts</span>
                </div>
                {filterDecision !== 'ALL' || filterFaction !== 'ALL' || searchMp ? (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDecision('ALL');
                      setFilterFaction('ALL');
                      setSearchMp('');
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                  >
                    Notīrīt filtrus
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
