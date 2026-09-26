import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { MP, Faction, MpDossier, VoteDecision } from '../types';
import { normalizeLatvianSearch } from '../types';
import {
  X,
  UserCheck,
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  Search,
  ShieldAlert,
  ChevronRight,
  Info,
  ArrowRight
} from 'lucide-react';

interface MpProfileModalProps {
  mp: MP;
  faction?: Faction;
  initialTab?: 'attendance' | 'cohesion' | 'history';
  onClose: () => void;
  onSelectVote?: (voteId: string, currentTab: 'attendance' | 'cohesion' | 'history') => void;
}

// Latvian grammar plural agreement helpers
function formatOppositeCount(count: number): string {
  if (count === 1 || (count % 10 === 1 && count % 100 !== 11)) {
    return 'pretēja balss';
  }
  if (count === 0 || (count % 100 >= 11 && count % 100 <= 19) || count % 10 === 0) {
    return 'pretēju balsu';
  }
  return 'pretējas balsis';
}

function formatNuanceCount(count: number): string {
  if (count === 1 || (count % 10 === 1 && count % 100 !== 11)) {
    return 'toņa nianse';
  }
  if (count === 0 || (count % 100 >= 11 && count % 100 <= 19) || count % 10 === 0) {
    return 'toņa nianšu';
  }
  return 'toņa nianses';
}

function formatAlignedCount(count: number): string {
  if (count === 1 || (count % 10 === 1 && count % 100 !== 11)) {
    return 'vienots balsojums';
  }
  if (count === 0 || (count % 100 >= 11 && count % 100 <= 19) || count % 10 === 0) {
    return 'vienotu balsojumu';
  }
  return 'vienoti balsojumi';
}

export const MpProfileModal: React.FC<MpProfileModalProps> = ({
  mp,
  faction,
  initialTab = 'attendance',
  onClose,
  onSelectVote,
}) => {
  const [dossier, setDossier] = useState<MpDossier | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab inside modal
  const [activeTab, setActiveTab] = useState<'attendance' | 'cohesion' | 'history'>(initialTab);

  // Sync tab if initialTab or mp changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, mp.id]);

  // History search & filters
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyDecision, setHistoryDecision] = useState<string>('ALL');

  // Progressive pagination for voting history
  const [historyVisibleCount, setHistoryVisibleCount] = useState<number>(50);

  // Scroll ref for modal body to reset scroll on tab switch
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Reset scroll to top and reset history pagination count on tab or filter switch
  useEffect(() => {
    modalBodyRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [activeTab]);

  useEffect(() => {
    setHistoryVisibleCount(50);
  }, [historySearch, historyDecision, mp.id]);

  // Fetch individual dossier JSON
  useEffect(() => {
    let isMounted = true;
    async function loadDossier() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`./data/mp_dossiers/${mp.id}.json?v=${Date.now()}`);
        if (!res.ok) {
          throw new Error('Neizdevās ielādēt deputāta analītiku');
        }
        const data: MpDossier = await res.json();
        if (isMounted) {
          setDossier(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Kļūda datu ielādē');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadDossier();
    return () => {
      isMounted = false;
    };
  }, [mp.id]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Initials generator
  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Filtered voting history
  const filteredHistory = useMemo(() => {
    if (!dossier?.votingHistory) return [];
    return dossier.votingHistory.filter((item) => {
      if (historyDecision !== 'ALL' && item.decision !== historyDecision) {
        return false;
      }
      if (historySearch.trim()) {
        const q = normalizeLatvianSearch(historySearch.trim());
        const matchTitle = normalizeLatvianSearch(item.title).includes(q);
        const matchCat = normalizeLatvianSearch(item.category).includes(q);
        if (!matchTitle && !matchCat) return false;
      }
      return true;
    });
  }, [dossier?.votingHistory, historyDecision, historySearch]);

  // Split deviations into Opposite (rebels) and Nuance (Pret vs Atturas)
  const oppositeDeviations = useMemo(() => {
    return dossier?.cohesion?.deviations?.filter((d) => d.deviationType === 'OPPOSITE') || [];
  }, [dossier?.cohesion?.deviations]);

  const nuanceDeviations = useMemo(() => {
    return dossier?.cohesion?.deviations?.filter((d) => d.deviationType === 'NUANCE') || [];
  }, [dossier?.cohesion?.deviations]);

  const getDecisionBadge = (decision: VoteDecision) => {
    switch (decision) {
      case 'PAR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="h-3 w-3" />
            PAR
          </span>
        );
      case 'PRET':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
            <XCircle className="h-3 w-3" />
            PRET
          </span>
        );
      case 'ATTURAS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800">
            <MinusCircle className="h-3 w-3" />
            ATTURAS
          </span>
        );
      case 'NEBALSO':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-700">
            <HelpCircle className="h-3 w-3" />
            NEBALSOJA
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-500">
            NAV REĢISTRĒTS
          </span>
        );
    }
  };

  const mpFaction = dossier?.faction || faction;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh] max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mp-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER: Identity & Mandate (Card 1) */}
        <div className="p-4 sm:p-6 bg-slate-50/90 border-b border-slate-200 flex items-start justify-between gap-4 shrink-0">
          <div className="flex items-start gap-3.5 sm:gap-4">
            {/* Avatar circle */}
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-bold text-base sm:text-lg flex-shrink-0 text-white shadow-xs border-2 border-white"
              style={{ backgroundColor: mpFaction?.color || '#475569' }}
            >
              {getInitials(mp.name)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="mp-modal-title" className="text-base sm:text-lg font-bold text-slate-900">
                  {mp.name}
                </h2>
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white shadow-2xs"
                  style={{ backgroundColor: mpFaction?.color || '#475569' }}
                >
                  {mpFaction?.shortName || mp.factionId.toUpperCase()}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                <span>{mpFaction?.name || 'Saeimas frakcija'}</span>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-slate-500">Sēdvieta Nr. {mp.seatNumber}</span>
              </div>

              {/* Mandate status badge */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {mp.isSubstitute ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Aizvietotājs (mīkstais mandāts) — {mp.replacesMpName || 'aizvieto ministru'}</span>
                  </span>
                ) : !mp.isActive ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-medium">
                    <span>Nolicis mandātu (Ministru kabineta loceklis)</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Aktīvs 14. Saeimas deputāta mandāts</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Aizvērt profilu"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex border-b border-slate-200 bg-white px-4 sm:px-6 gap-2 sm:gap-4 overflow-x-auto scrollbar-none shrink-0 sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setActiveTab('attendance')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'attendance'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Klātbūtne un kvorums
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cohesion')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'cohesion'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Frakcijas vienotība un šķelšanās
            {dossier?.cohesion?.deviationsCount !== undefined && dossier.cohesion.deviationsCount > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-100 text-amber-800">
                {dossier.cohesion.deviationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 text-xs sm:text-sm font-semibold border-b-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Balsojumu vēsture
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600">
              {dossier?.totalVotes || 400}
            </span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div ref={modalBodyRef} className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading && (
            <div className="py-16 text-center text-slate-400">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              <p className="mt-3 text-xs">Apkopo deputāta balsojumu analītiku...</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
              <ShieldAlert className="mx-auto h-7 w-7 mb-2" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}

          {!loading && !error && dossier && (
            <>
              {/* TAB 1: ATTENDANCE & QUORUM TACTICS (Card 2) */}
              {activeTab === 'attendance' && (
                <div className="space-y-6">
                  {/* 3-Segment Stacked Activity Bar */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-900">
                        Parlamentārās aktivitātes kopsavilkums (Satversmes 24. pants)
                      </h3>
                      <span className="text-xs font-mono text-slate-500">
                        Kopā {dossier.totalVotes} balsojumi
                      </span>
                    </div>

                    {/* Stacked bar */}
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${dossier.attendance.presentPct}%` }}
                        title={`Aktīvi balsojis: ${dossier.attendance.presentPct}% (${dossier.attendance.presentCount})`}
                      />
                      <div
                        className="bg-amber-400 h-full transition-all"
                        style={{ width: `${dossier.attendance.withheldPct}%` }}
                        title={`Zālē, bet nebalsoja: ${dossier.attendance.withheldPct}% (${dossier.attendance.withheldCount})`}
                      />
                      <div
                        className="bg-slate-300 h-full transition-all"
                        style={{ width: `${dossier.attendance.absentPct}%` }}
                        title={`Nav reģistrēts zālē: ${dossier.attendance.absentPct}% (${dossier.attendance.absentCount})`}
                      />
                    </div>

                    {/* Legend */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-emerald-950 font-mono">
                            {dossier.attendance.presentPct} %
                          </div>
                          <div className="text-[11px] font-semibold text-emerald-800">Aktīvi balsojis</div>
                          <div className="text-[10px] text-emerald-700/80">
                            {dossier.attendance.presentCount} no {dossier.totalVotes} balsojumiem
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/60 border border-amber-100">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-amber-950 font-mono">
                            {dossier.attendance.withheldPct} %
                          </div>
                          <div className="text-[11px] font-semibold text-amber-800">Zālē, bet nebalsoja</div>
                          <div className="text-[10px] text-amber-700/80">
                            {dossier.attendance.withheldCount} kvoruma manevri
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300 mt-1 flex-shrink-0" />
                        <div>
                          <div className="text-xs font-bold text-slate-800 font-mono">
                            {dossier.attendance.absentPct} %
                          </div>
                          <div className="text-[11px] font-semibold text-slate-700">Nav reģistrēts zālē</div>
                          <div className="text-[10px] text-slate-500">
                            {dossier.attendance.absentCount} prombūtnes reizes
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Individual Votes Breakdown Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">PAR</div>
                      <div className="text-lg font-bold text-emerald-600 font-mono mt-0.5">
                        {dossier.votesBreakdown.par}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {Math.round((dossier.votesBreakdown.par / dossier.totalVotes) * 100)} %
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">PRET</div>
                      <div className="text-lg font-bold text-rose-600 font-mono mt-0.5">
                        {dossier.votesBreakdown.pret}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {Math.round((dossier.votesBreakdown.pret / dossier.totalVotes) * 100)} %
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">ATTURAS</div>
                      <div className="text-lg font-bold text-amber-600 font-mono mt-0.5">
                        {dossier.votesBreakdown.atturas}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {Math.round((dossier.votesBreakdown.atturas / dossier.totalVotes) * 100)} %
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200 bg-white text-center">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">NEBALSOJA</div>
                      <div className="text-lg font-bold text-slate-700 font-mono mt-0.5">
                        {dossier.votesBreakdown.nebalso}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {Math.round((dossier.votesBreakdown.nebalso / dossier.totalVotes) * 100)} %
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200 bg-white text-center col-span-2 sm:col-span-1">
                      <div className="text-[10px] uppercase font-semibold text-slate-400">PROMBŪTNĒ</div>
                      <div className="text-lg font-bold text-slate-400 font-mono mt-0.5">
                        {dossier.votesBreakdown.navRegistrets}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {Math.round((dossier.votesBreakdown.navRegistrets / dossier.totalVotes) * 100)} %
                      </div>
                    </div>
                  </div>

                  {/* Constitutional Education Note */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
                    <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-800">Kāpēc deputāti dažkārt nebalso?</strong> Saskaņā ar Satversmes 24. pantu, Saeima var lemt, ja sēdē piedalās vismaz 50 deputāti (kvorums). Deputātu reģistrēšanās zālē, bet apzināta atturēšanās nospiest pogu ir leģitīms parlamentārais instruments, ko frakcijas izmanto, lai norautu kvorumu un nepieļautu nevēlama lēmuma pieņemšanu.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: FACTION COHESION & DEVIATIONS (Card 3) */}
              {activeTab === 'cohesion' && (
                <div className="space-y-6">
                  {dossier.cohesion.isIndependent ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
                      <UserCheck className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                      <h4 className="text-sm font-bold text-slate-900">Neatkarīgais deputāts</h4>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Deputāts nepieder pie nevienas Saeimas frakcijas. Frakcijas vienotības rādītājs attiecas tikai uz frakciju locekļiem.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Cohesion Score Card */}
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase font-semibold text-slate-400">
                            Vienotības rādītājs ar frakciju
                          </div>
                          <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-3xl font-extrabold text-slate-900 font-mono">
                              {dossier.cohesion.cohesionPct} %
                            </span>
                            <span className="text-xs text-slate-500">
                              (saskaņā ar frakcijas vairākumu)
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-lg">
                            Aprēķināts tikai no tiem balsojumiem, kuros deputāts aktīvi paudis viedokli (Par, Pret vai Atturas). Prombūtne vai kvoruma ieturēšana netiek uzskatīta par šķelšanos.
                          </p>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-auto border-t sm:border-t-0 sm:border-l border-slate-100 pt-3 sm:pt-0 sm:pl-6 text-right flex-wrap sm:flex-nowrap">
                          <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-50/60 border border-emerald-100 min-w-[96px] text-center">
                            <div className="text-sm sm:text-base font-mono font-bold text-emerald-700">
                              {dossier.cohesion.activeAlignedCount}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {formatAlignedCount(dossier.cohesion.activeAlignedCount)}
                            </div>
                          </div>

                          <div className="p-2 sm:p-2.5 rounded-lg bg-rose-50/60 border border-rose-100 min-w-[96px] text-center">
                            <div className="text-sm sm:text-base font-mono font-bold text-rose-700">
                              {dossier.cohesion.oppositeCount ?? 0}
                            </div>
                            <div className="text-[10px] text-rose-700 font-medium">
                              {formatOppositeCount(dossier.cohesion.oppositeCount ?? 0)}
                            </div>
                          </div>

                          <div className="p-2 sm:p-2.5 rounded-lg bg-amber-50/60 border border-amber-100 min-w-[96px] text-center">
                            <div className="text-sm sm:text-base font-mono font-bold text-amber-700">
                              {dossier.cohesion.nuanceCount ?? 0}
                            </div>
                            <div className="text-[10px] text-amber-700 font-medium">
                              {formatNuanceCount(dossier.cohesion.nuanceCount ?? 0)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* DEVIATIONS SECTIONS */}
                      {dossier.cohesion.deviations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500 mb-2" />
                          <p className="text-sm font-semibold">100% frakcijas vienotība</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Šis deputāts visos reģistrētajos balsojumos ir balsojis saskaņā ar savas frakcijas vairākuma lēmumu.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {/* SECTION A: ATKLĀTA PRETRUNA AR FRAKCIJU (Rebel / Opposing votes) */}
                          {oppositeDeviations.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 px-1">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                <h4 className="text-xs font-bold text-slate-900">
                                  Atklāta pretruna ar frakciju ({oppositeDeviations.length})
                                </h4>
                              </div>

                              <div className="rounded-xl border border-rose-200/80 bg-white overflow-hidden shadow-2xs divide-y divide-slate-100">
                                {/* Table header */}
                                <div className="flex items-center justify-between px-3.5 py-1.5 bg-rose-50/50 border-b border-rose-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  <span>Likumprojekts vai priekšlikums</span>
                                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    <span className="w-[100px] text-center">Deputāts</span>
                                    <span className="w-[100px] text-center">Frakcija</span>
                                    <span className="w-[20px]" />
                                  </div>
                                </div>

                                {oppositeDeviations.map((dev) => (
                                  <div
                                    key={dev.voteId}
                                    onClick={() => onSelectVote?.(dev.voteId, activeTab)}
                                    className={`p-3.5 transition-colors flex items-center justify-between gap-3 text-xs ${
                                      onSelectVote ? 'hover:bg-slate-50 cursor-pointer group' : ''
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1 pr-2">
                                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mb-0.5 truncate">
                                        {dev.parentBillTitle ? (
                                          <>
                                            <span className="font-semibold text-slate-600 truncate max-w-[280px] sm:max-w-md" title={dev.parentBillTitle}>
                                              {dev.parentBillTitle}
                                            </span>
                                            <span>·</span>
                                            <span>{dev.sittingDate}</span>
                                          </>
                                        ) : (
                                          <>
                                            <span>{dev.sittingDate}</span>
                                            <span>·</span>
                                            <span>{dev.category || 'Likumprojekts'}</span>
                                          </>
                                        )}
                                      </div>
                                      <div className="font-semibold text-slate-900 leading-snug line-clamp-2" title={dev.title}>
                                        {dev.title}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                      <div className="w-[100px] flex justify-center">
                                        {getDecisionBadge(dev.decision)}
                                      </div>
                                      <div className="w-[100px] flex justify-center">
                                        {getDecisionBadge(dev.factionLine)}
                                      </div>
                                      <div className="w-[20px] flex justify-center">
                                        {onSelectVote && (
                                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 transition-colors" />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* SECTION B: BALSOJUMA TOŅA ATŠĶIRĪBAS (Nuance: Pret vs Atturas) */}
                          {nuanceDeviations.length > 0 && (
                            <div className="space-y-2">
                              <div className="px-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                  <h4 className="text-xs font-bold text-slate-900">
                                    Balsojuma toņa atšķirības ({nuanceDeviations.length})
                                  </h4>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                  Satversmes 24. panta izpratnē abas balsis panāca to pašu iznākumu (likuma noraidīšanu), bet atšķīrās balsojuma veids (Pret vai Atturas).
                                </p>
                              </div>

                              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs divide-y divide-slate-100">
                                {/* Table header */}
                                <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  <span>Likumprojekts vai priekšlikums</span>
                                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    <span className="w-[100px] text-center">Deputāts</span>
                                    <span className="w-[100px] text-center">Frakcija</span>
                                    <span className="w-[20px]" />
                                  </div>
                                </div>

                                {nuanceDeviations.map((dev) => (
                                  <div
                                    key={dev.voteId}
                                    onClick={() => onSelectVote?.(dev.voteId, activeTab)}
                                    className={`p-3.5 transition-colors flex items-center justify-between gap-3 text-xs ${
                                      onSelectVote ? 'hover:bg-slate-50 cursor-pointer group' : ''
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1 pr-2">
                                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mb-0.5 truncate">
                                        {dev.parentBillTitle ? (
                                          <>
                                            <span className="font-semibold text-slate-600 truncate max-w-[280px] sm:max-w-md" title={dev.parentBillTitle}>
                                              {dev.parentBillTitle}
                                            </span>
                                            <span>·</span>
                                            <span>{dev.sittingDate}</span>
                                          </>
                                        ) : (
                                          <>
                                            <span>{dev.sittingDate}</span>
                                            <span>·</span>
                                            <span>{dev.category || 'Likumprojekts'}</span>
                                          </>
                                        )}
                                      </div>
                                      <div className="font-semibold text-slate-900 leading-snug line-clamp-2" title={dev.title}>
                                        {dev.title}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                      <div className="w-[100px] flex justify-center">
                                        {getDecisionBadge(dev.decision)}
                                      </div>
                                      <div className="w-[100px] flex justify-center">
                                        {getDecisionBadge(dev.factionLine)}
                                      </div>
                                      <div className="w-[20px] flex justify-center">
                                        {onSelectVote && (
                                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 transition-colors" />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: VOTING HISTORY (Card 4) */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {/* Search and decision filter */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                        placeholder="Meklēt starp deputāta balsojumiem..."
                        className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                      {['ALL', 'PAR', 'PRET', 'ATTURAS', 'NEBALSO'].map((dec) => (
                        <button
                          key={dec}
                          type="button"
                          onClick={() => setHistoryDecision(dec)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                            historyDecision === dec
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
                          }`}
                        >
                          {dec === 'ALL' ? 'Visi' : dec}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* History items count */}
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>
                      Atrasti {filteredHistory.length} balsojumi
                      {filteredHistory.length > historyVisibleCount && (
                        <span className="text-slate-400 ml-1">
                          (parādīti pirmie {historyVisibleCount})
                        </span>
                      )}
                    </span>

                    {filteredHistory.length > historyVisibleCount && (
                      <button
                        type="button"
                        onClick={() => setHistoryVisibleCount(filteredHistory.length)}
                        className="text-slate-600 hover:text-slate-900 font-medium underline text-xs cursor-pointer"
                      >
                        Rādīt visus ({filteredHistory.length})
                      </button>
                    )}
                  </div>

                  {/* History list */}
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    {filteredHistory.slice(0, historyVisibleCount).map((item) => (
                      <div
                        key={item.voteId}
                        onClick={() => onSelectVote?.(item.voteId, activeTab)}
                        className={`p-3.5 transition-colors flex items-center justify-between gap-3 text-xs ${
                          onSelectVote ? 'hover:bg-slate-50 cursor-pointer group' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mb-0.5 truncate">
                            {item.parentBillTitle ? (
                              <>
                                <span className="font-semibold text-slate-600 truncate max-w-[280px] sm:max-w-md" title={item.parentBillTitle}>
                                  {item.parentBillTitle}
                                </span>
                                <span>·</span>
                                <span>{item.sittingDate}</span>
                              </>
                            ) : (
                              <>
                                <span>{item.sittingDate}</span>
                                <span>·</span>
                                <span>{item.category || 'Likumprojekts'}</span>
                              </>
                            )}
                          </div>
                          <div className="font-semibold text-slate-900 leading-snug line-clamp-1" title={item.title}>
                            {item.title}
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          {getDecisionBadge(item.decision)}

                          {onSelectVote && (
                            <div className="w-5 flex justify-center">
                              <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-900 transition-colors" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredHistory.length > historyVisibleCount && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 pb-1">
                      <button
                        type="button"
                        onClick={() => setHistoryVisibleCount((prev) => Math.min(prev + 50, filteredHistory.length))}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-xs hover:border-slate-400 transition cursor-pointer"
                      >
                        Rādīt vēl 50 balsojumus (atlikuši {filteredHistory.length - historyVisibleCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryVisibleCount(filteredHistory.length)}
                        className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer py-1"
                      >
                        Ielādēt visus {filteredHistory.length} balsojumus uzreiz
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center text-[11px] text-slate-500 shrink-0">
          <span>Objektīvi dati no Saeimas oficiālajiem sēžu protokoliem · Atvērtā parlamenta reģistrs</span>
        </div>
      </div>
    </div>
  );
};
