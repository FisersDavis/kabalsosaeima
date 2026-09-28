import React, { useState, useEffect, useMemo } from 'react';
import type { Vote, FactionBreakdown } from '../types';
import {
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Lock,
  ExternalLink,
  Users,
  FileText
} from 'lucide-react';

interface VoteCardProps {
  vote: Vote;
  onSelect: (vote: Vote) => void;
  showFactionStances?: boolean;
  isTargeted?: boolean;
}

const SEAT_ORDER = ['JV', 'ZZS', 'AS', 'NA', 'PRO', 'LPV', 'S!', 'PIEFR'];

interface GroupedFaction {
  shortName: string;
  name: string;
  color: string;
  tooltip: string;
}

interface GroupedFactionBlocs {
  par: GroupedFaction[];
  pret: GroupedFaction[];
  cits: GroupedFaction[];
}

function getGroupedFactionBlocs(factionBreakdown: FactionBreakdown[] | undefined): GroupedFactionBlocs {
  const result: GroupedFactionBlocs = {
    par: [],
    pret: [],
    cits: [],
  };

  if (!factionBreakdown) return result;

  const fbMap = new Map<string, FactionBreakdown>();
  factionBreakdown.forEach((fb) => {
    fbMap.set(fb.shortName.toUpperCase(), fb);
    fbMap.set(fb.factionId.toUpperCase(), fb);
  });

  SEAT_ORDER.forEach((short) => {
    const fb = fbMap.get(short) || fbMap.get(short === 'S!' ? 'ST' : short === 'PIEFR' ? 'IND' : short);
    if (!fb) return;

    const fid = fb.factionId.toLowerCase();
    const isIndependent = short === 'PIEFR' || fid === 'piefr' || fid === 'ind';

    const p = fb.votes.par || 0;
    const pr = fb.votes.pret || 0;
    const a = fb.votes.atturas || 0;
    const nb = fb.votes.nebalso || 0;
    const active = p + pr + a;
    const block = pr + a;

    const tallyStr = `${p} Par · ${pr} Pret · ${a} Atturas · ${nb} Nebalsoja`;

    if (isIndependent) {
      result.cits.push({
        shortName: short,
        name: fb.name,
        color: fb.color || '#64748B',
        tooltip: `${short} (neatkarīgie deputāti): ${tallyStr}`,
      });
      return;
    }

    if (active === 0 || nb > active) {
      result.cits.push({
        shortName: short,
        name: fb.name,
        color: fb.color || '#64748B',
        tooltip: `${short}: ${tallyStr} (vairākums nebalsoja)`,
      });
    } else if (p > block) {
      result.par.push({
        shortName: short,
        name: fb.name,
        color: fb.color || '#10B981',
        tooltip: `${short}: ${tallyStr} (atbalstīja)`,
      });
    } else if (block > p) {
      result.pret.push({
        shortName: short,
        name: fb.name,
        color: fb.color || '#EF4444',
        tooltip: `${short}: ${tallyStr} (noraidīja)`,
      });
    } else {
      result.cits.push({
        shortName: short,
        name: fb.name,
        color: fb.color || '#64748B',
        tooltip: `${short}: ${tallyStr} (balsis sadalījās vienādi)`,
      });
    }
  });

  return result;
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

function formatFactionTally(votes: { par: number; pret: number; atturas: number; nebalso: number }): string {
  const parts: string[] = [];
  if (votes.par > 0) parts.push(`${votes.par} Par`);
  if (votes.pret > 0) parts.push(`${votes.pret} Pret`);
  if (votes.atturas > 0) parts.push(`${votes.atturas} Atturas`);
  if (votes.nebalso > 0) parts.push(`${votes.nebalso} Nebalsoja`);
  return parts.length > 0 ? parts.join(' · ') : '0 balsoja';
}

function getEffectiveVoteCategory(decision: string): 'SUPPORT' | 'BLOCK' | 'ABSENT' {
  if (decision === 'PAR') return 'SUPPORT';
  if (decision === 'PRET' || decision === 'ATTURAS') return 'BLOCK';
  return 'ABSENT';
}

function getResponsibleCommittee(summary?: string): string | null {
  if (!summary) return null;
  const match = summary.match(/Atbildīgā komisija:\s*([^.]+)/i);
  if (match && match[1]) {
    const text = match[1].trim();
    if (text.toLowerCase().includes('komisija')) {
      return text;
    }
  }
  return null;
}

export const VoteCard: React.FC<VoteCardProps> = ({ vote, onSelect, showFactionStances, isTargeted }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(isTargeted || false);
  const [showFullSummary, setShowFullSummary] = useState(false);

  useEffect(() => {
    if (isTargeted) {
      setIsExpanded(true);
    }
  }, [isTargeted]);

  const groupedBlocs = useMemo(() => {
    return showFactionStances ? getGroupedFactionBlocs(vote.factionBreakdown) : { par: [], pret: [], cits: [] };
  }, [showFactionStances, vote.factionBreakdown]);

  const isApproved = vote.result === 'PIENEMTS';
  const isQuorumBreak = vote.result === 'NAV_KVORUMA';

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/#balsojums-${vote.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Permanently sort factions by seat size (largest to smallest) for visual anchoring
  const sortedFactions: FactionBreakdown[] = [...(vote.factionBreakdown || [])].sort((a, b) => {
    const totalA = a.votes.par + a.votes.pret + a.votes.atturas + a.votes.nebalso;
    const totalB = b.votes.par + b.votes.pret + b.votes.atturas + b.votes.nebalso;
    return totalB - totalA;
  });

  // Collect all MPs who broke faction discipline
  // Under Satversme Art. 24, PAR is SUPPORT, whereas PRET + ATTURAS is BLOCK.
  // Independent MPs (PIEFR/IND) have no whip and are excluded.
  const allDeviations = sortedFactions
    .filter((f) => f.shortName.toUpperCase() !== 'PIEFR' && f.factionId.toLowerCase() !== 'piefr' && f.shortName.toUpperCase() !== 'IND' && f.factionId.toLowerCase() !== 'ind')
    .flatMap((f) => {
      const support = f.votes.par;
      const block = f.votes.pret + f.votes.atturas;
      if (support === block || (support === 0 && block === 0)) return [];
      const dominantBloc = support > block ? 'SUPPORT' : 'BLOCK';

      return (f.deviatingMps || []).filter((dev) => {
        const mpBloc = getEffectiveVoteCategory(dev.decision);
        return mpBloc !== 'ABSENT' && mpBloc !== dominantBloc;
      }).map((dev) => ({
        ...dev,
        factionShort: f.shortName,
        factionColor: f.color
      }));
    });

  const committee = getResponsibleCommittee(vote.summary);
  const cleanedTitle = cleanVoteTitle(vote.simplifiedTitle || vote.officialTitle);
  const cleanBillNr = vote.billNumber ? vote.billNumber.replace(/^(Nr\.\s*|#)/, '') : '';
  const cleanSummary = vote.summary?.trim() || null;
  const dossierUrl = cleanBillNr
    ? `https://titania.saeima.lv/LIVS14/SaeimaLIVS14_Content.nsf/webAll?SearchView&Query=([Title]=*${encodeURIComponent(cleanBillNr)}*)`
    : null;
  const stenogramUrl = 'https://www.saeima.lv/lv/transcripts';
  const protocolUrl = vote.protocolUrl || 'https://www.saeima.lv/lv/likumdosana/balsojumi';

  return (
    <article
      id={`balsojums-${vote.id}`}
      className={`rounded-xl border bg-white p-4 shadow-2xs transition hover:border-slate-300 hover:shadow-xs ${
        isTargeted
          ? 'ring-2 ring-emerald-500/50 border-emerald-400 bg-emerald-50/15'
          : 'border-slate-200/90'
      }`}
    >
      {/* Revote Notice (if applicable) */}
      {vote.isRevote && (
        <div className="mb-2.5 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
          <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" />
          <span><strong>Pārbalsojums:</strong> {vote.revoteReason || 'Balsojums atkārtots saskaņā ar procedūras pieteikumu.'}</span>
        </div>
      )}

      {/* LEVEL 1: Immediately Visible (Scanning) */}

      {/* Row 1: Title (1) + Result (2) tucked directly after the final word */}
      <h3
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-base sm:text-lg font-bold leading-snug text-slate-900 hover:text-emerald-800 cursor-pointer transition"
      >
        <span>{cleanedTitle}</span>
        {isQuorumBreak ? (
          <span className="inline-flex items-center align-middle rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 shadow-2xs whitespace-nowrap ml-2 -translate-y-px">
            Nav kvoruma
          </span>
        ) : (
          <span
            className={`inline-flex items-center align-middle rounded-md border px-2.5 py-0.5 text-xs font-semibold shadow-2xs whitespace-nowrap ml-2 -translate-y-px ${
              isApproved
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-rose-300 bg-rose-50 text-rose-800'
            }`}
          >
            {isApproved ? 'Pieņemts' : 'Noraidīts'}
          </span>
        )}
      </h3>

      {/* Row 2: Vote Split (3) with chromatic typography */}
      <div className="mt-1.5 flex items-center text-xs font-mono">
        <div className="flex items-center gap-2 sm:gap-2.5 text-slate-600">
          <span>
            <strong className="tabular-nums font-bold text-emerald-700">{vote.counts.par}</strong>{' '}
            <span className="font-sans text-[11px] text-slate-500">Par</span>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            <strong className="tabular-nums font-bold text-rose-700">{vote.counts.pret}</strong>{' '}
            <span className="font-sans text-[11px] text-slate-500">Pret</span>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            <strong className="tabular-nums font-bold text-amber-700">{vote.counts.atturas}</strong>{' '}
            <span className="font-sans text-[11px] text-slate-500">Atturas</span>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            <strong className="tabular-nums font-bold text-slate-400">{vote.counts.nebalso}</strong>{' '}
            <span className="font-sans text-[11px] text-slate-400">Nebalsoja</span>
          </span>
        </div>
      </div>

      {/* Row 3: Subdued Supporting Context (Topic · Date · Stage · Bill Nr · Commission) */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-normal">
        <span className="text-slate-600 font-medium">{vote.category.label}</span>
        <span>·</span>
        <span className="font-mono text-slate-500">{vote.sittingDate}</span>

        {vote.readingStage && vote.readingStage !== 'Darba kārtība' && vote.readingStage !== 'Procedūra' && (
          <>
            <span>·</span>
            <span className="text-slate-500">{vote.readingStage}</span>
          </>
        )}

        {cleanBillNr && (
          <>
            <span>·</span>
            <span className="font-mono text-slate-400">Nr. {cleanBillNr}</span>
          </>
        )}

        {committee && (
          <>
            <span>·</span>
            <span className="text-slate-500">{committee}</span>
          </>
        )}

        {vote.isUrgent && (
          <>
            <span>·</span>
            <span className="font-semibold text-amber-700">Steidzams</span>
          </>
        )}

        {vote.isSecret && (
          <>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5 text-slate-500">
              <Lock className="h-3 w-3" /> Aizklāts
            </span>
          </>
        )}
      </div>

      {/* Row 3.2: Plain-Language Summary Preview */}
      {cleanSummary && (
        <div className="mt-2 text-xs text-slate-600 leading-relaxed bg-slate-50/90 rounded-lg px-3 py-2 border border-slate-100">
          <p className={showFullSummary ? '' : 'line-clamp-2'}>
            <span className="font-semibold text-slate-800 mr-1.5">Būtība:</span>
            {cleanSummary}
          </p>
          {cleanSummary.length > 140 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFullSummary(!showFullSummary);
              }}
              className="mt-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              {showFullSummary ? 'Rādīt mazāk ↑' : 'Lasīt visu skaidrojumu ↓'}
            </button>
          )}
        </div>
      )}

      {/* Row 3.5: Grouped Faction Blocs (Par / Pret / Cits) */}
      {showFactionStances && (groupedBlocs.par.length > 0 || groupedBlocs.pret.length > 0 || groupedBlocs.cits.length > 0) && (
        <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs">
          {/* Par Bloc */}
          {groupedBlocs.par.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-emerald-700 tracking-wide select-none">
                Par:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {groupedBlocs.par.map((f) => (
                  <span
                    key={f.shortName}
                    title={f.tooltip}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 bg-white text-slate-800 text-[11px] font-mono font-semibold shadow-2xs hover:bg-slate-50 transition cursor-default"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: f.color }}
                    />
                    <span>{f.shortName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pret Bloc */}
          {groupedBlocs.pret.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-rose-700 tracking-wide select-none">
                Pret:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {groupedBlocs.pret.map((f) => (
                  <span
                    key={f.shortName}
                    title={f.tooltip}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 bg-white text-slate-800 text-[11px] font-mono font-semibold shadow-2xs hover:bg-slate-50 transition cursor-default"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: f.color }}
                    />
                    <span>{f.shortName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Cits Bloc */}
          {groupedBlocs.cits.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 tracking-wide select-none">
                Cits:
              </span>
              <div className="flex flex-wrap items-center gap-1">
                {groupedBlocs.cits.map((f) => (
                  <span
                    key={f.shortName}
                    title={f.tooltip}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-mono font-medium shadow-2xs hover:bg-slate-100 transition cursor-default"
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: f.color }}
                    />
                    <span>{f.shortName}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Row 4: Single Expand Action Trigger + Rebel MPs indicator */}
      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition text-xs cursor-pointer"
        >
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          )}
          <span>Deputātu balsojumi un sēžu zāle</span>
        </button>

        {allDeviations.length > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            title="Skatīt deputātus, kuri balsoja pretēji frakcijas vairākumam"
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 transition cursor-pointer"
          >
            <span>{allDeviations.length} pret frakciju</span>
          </button>
        )}
      </div>

      {/* LEVEL 2: Progressive Disclosure (Accordion Drawer) */}
      {isExpanded && (
        <div className="mt-2.5 pt-3.5 border-t border-slate-100 space-y-3 text-xs">
          {/* TIER 1: The 8 Faction Ledger Bars (Clean 2-Column Table, Tight Row Gap, No Legend) */}
          {!vote.isSecret && sortedFactions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2.5">
              {sortedFactions.map((f) => {
                const fTotal = f.votes.par + f.votes.pret + f.votes.atturas + f.votes.nebalso;
                const fParPct = fTotal ? (f.votes.par / fTotal) * 100 : 0;
                const fPretPct = fTotal ? (f.votes.pret / fTotal) * 100 : 0;
                const fAtturasPct = fTotal ? (f.votes.atturas / fTotal) * 100 : 0;
                const fNebalsoPct = fTotal ? (f.votes.nebalso / fTotal) * 100 : 0;

                return (
                  <div key={f.factionId} className="w-full flex flex-col justify-start">
                    <div className="flex items-baseline gap-2.5 text-xs">
                      <span className="font-bold text-slate-800 w-16 sm:w-20 flex-shrink-0">
                        {f.shortName} <span className="text-[11px] text-slate-400 font-normal">({fTotal})</span>
                      </span>
                      <span className="font-mono text-[11px] text-slate-600 truncate">
                        {formatFactionTally(f.votes)}
                      </span>
                    </div>

                    {/* Uniform Full-Width 4px Bar Track */}
                    <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden flex mt-1">
                      {fParPct > 0 && <div style={{ width: `${fParPct}%` }} className="bg-emerald-600 h-full" title={`${f.votes.par} Par`} />}
                      {fPretPct > 0 && <div style={{ width: `${fPretPct}%` }} className="bg-rose-600 h-full" title={`${f.votes.pret} Pret`} />}
                      {fAtturasPct > 0 && <div style={{ width: `${fAtturasPct}%` }} className="bg-amber-500 h-full" title={`${f.votes.atturas} Atturas`} />}
                      {fNebalsoPct > 0 && <div style={{ width: `${fNebalsoPct}%` }} className="bg-slate-300 h-full" title={`${f.votes.nebalso} Nebalsoja`} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TIER 2: Novirzes no frakcijas (Pure Text, No Bulky Tags, No Border Tick) */}
          {allDeviations.length > 0 && (
            <div className="border-t border-slate-100 pt-2 text-xs text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800 mr-1.5">
                ✦ {allDeviations.length === 1 ? 'Novirze no frakcijas' : `Novirzes no frakcijas (${allDeviations.length})`}:
              </span>
              <span>
                {allDeviations.map((dev, idx) => {
                  const verb =
                    dev.decision === 'PAR'
                      ? 'balsoja par'
                      : dev.decision === 'PRET'
                      ? 'balsoja pret'
                      : dev.decision === 'ATTURAS'
                      ? 'atturējās'
                      : 'nebalsoja';
                  const verbColor =
                    dev.decision === 'PAR'
                      ? 'text-emerald-700'
                      : dev.decision === 'PRET'
                      ? 'text-rose-700'
                      : dev.decision === 'ATTURAS'
                      ? 'text-amber-700'
                      : 'text-slate-500';

                  return (
                    <React.Fragment key={dev.mpId}>
                      {idx > 0 && <span className="text-slate-300 mx-2">·</span>}
                      <span className="inline">
                        <strong className="font-semibold text-slate-900">{dev.name}</strong>{' '}
                        <span className="text-slate-400">({dev.factionShort})</span>{' '}
                        <span className={`font-medium ${verbColor}`}>{verb}</span>
                      </span>
                    </React.Fragment>
                  );
                })}
              </span>
            </div>
          )}

          {/* TIER 3: Interactive Exploration & Official Proof */}
          <div className="border-t border-slate-100 pt-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            {/* Left: Primary interactive drill-down & Saeima Dossier */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(vote)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition cursor-pointer shadow-2xs"
              >
                <Users className="h-3.5 w-3.5 text-emerald-700" />
                <span>Kā balsoja katrs deputāts</span>
              </button>

              {dossierUrl && (
                <a
                  href={dossierUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/90 hover:border-emerald-300 transition shadow-2xs"
                  title="Atvērt likumprojekta gaitas karti un visus grozījumus Saeimas mājaslapā"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Saeimas titullapa</span>
                  <ExternalLink className="h-3 w-3 text-emerald-600/70" />
                </a>
              )}
            </div>

            {/* Right: Clean secondary link list */}
            <div className="flex flex-wrap items-center gap-2 text-slate-500 text-[11px]">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 transition cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Nokopēts!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    <span>Kopīgot</span>
                  </>
                )}
              </button>

              <span className="text-slate-300">·</span>

              <a
                href={stenogramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition"
                title="Skatīt sēdes debašu stenogrammas Saeimas portālā"
              >
                <span>Stenogramma</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>

              {protocolUrl && (
                <>
                  <span className="text-slate-300">·</span>
                  <a
                    href={protocolUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition"
                    title="Skatīt oficiālo Saeimas balsojuma protokolu"
                  >
                    <span>Protokols</span>
                    <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                </>
              )}

              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <span>Aizvērt ↑</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
