import React, { useState } from 'react';
import type { Vote, FactionBreakdown } from '../types';
import {
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FileText,
  RefreshCw,
  Lock,
  ExternalLink,
  Users
} from 'lucide-react';

interface VoteCardProps {
  vote: Vote;
  onSelect: (vote: Vote) => void;
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

export const VoteCard: React.FC<VoteCardProps> = ({ vote, onSelect }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAnnotation, setShowAnnotation] = useState(false);

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
  const allDeviations = sortedFactions.flatMap((f) =>
    (f.deviatingMps || []).map((dev) => ({ ...dev, factionShort: f.shortName, factionColor: f.color }))
  );

  const cleanedTitle = cleanVoteTitle(vote.simplifiedTitle || vote.officialTitle);
  const cleanBillNr = vote.billNumber ? vote.billNumber.replace(/^(Nr\.\s*|#)/, '') : '';

  return (
    <article
      id={`balsojums-${vote.id}`}
      className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-slate-300 hover:shadow-xs"
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

      {/* Row 3: Subdued Supporting Context (Topic · Date · Stage · Bill Nr) sits quietly underneath */}
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

      {/* Row 4: Single Expand Action Trigger + Rebel MPs indicator */}
      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-slate-900 transition text-xs cursor-pointer"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              <span>Aizvērt balsojuma detaļas</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              <span>Deputātu balsojumi un sēžu zāle</span>
            </>
          )}
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
        <div className="mt-3 pt-3 border-t border-slate-200/90 space-y-3 text-xs">
          {/* TIER 1: The 8 Faction Ledger Bars (Front and Center) */}
          {!vote.isSecret && sortedFactions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                  Frakciju balsojums
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Zaļš: Par · Sarkans: Pret · Dzeltens: Att · Pelēks: Nebalsoja
                </span>
              </div>

              {/* 8-Faction Clean 2-Column Grid directly on card canvas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                {sortedFactions.map((f) => {
                  const fTotal = f.votes.par + f.votes.pret + f.votes.atturas + f.votes.nebalso;
                  const fParPct = fTotal ? (f.votes.par / fTotal) * 100 : 0;
                  const fPretPct = fTotal ? (f.votes.pret / fTotal) * 100 : 0;
                  const fAtturasPct = fTotal ? (f.votes.atturas / fTotal) * 100 : 0;
                  const fNebalsoPct = fTotal ? (f.votes.nebalso / fTotal) * 100 : 0;

                  return (
                    <div key={f.factionId} className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-bold text-slate-800">
                          {f.shortName} <span className="text-[11px] text-slate-400 font-normal">({fTotal})</span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {formatFactionTally(f.votes)}
                        </span>
                      </div>

                      {/* 4-Color Proportional Bar */}
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        {fParPct > 0 && <div style={{ width: `${fParPct}%` }} className="bg-emerald-600" title={`${f.votes.par} Par`} />}
                        {fPretPct > 0 && <div style={{ width: `${fPretPct}%` }} className="bg-rose-600" title={`${f.votes.pret} Pret`} />}
                        {fAtturasPct > 0 && <div style={{ width: `${fAtturasPct}%` }} className="bg-amber-500" title={`${f.votes.atturas} Atturas`} />}
                        {fNebalsoPct > 0 && <div style={{ width: `${fNebalsoPct}%` }} className="bg-slate-300" title={`${f.votes.nebalso} Nebalsoja`} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TIER 2: The Rebels & Context (Secondary Signals) */}
          {allDeviations.length > 0 && (
            <div className="border-t border-slate-100 pt-2.5 flex flex-col sm:flex-row sm:items-baseline gap-1.5 text-xs">
              <span className="font-semibold text-slate-700 flex-shrink-0">
                ✦ Pretēji frakcijai balsoja:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {allDeviations.map((dev) => (
                  <span
                    key={dev.mpId}
                    className="inline-flex items-center gap-1 rounded bg-slate-50 border border-slate-200/80 px-2 py-0.5 text-[11px] text-slate-700"
                  >
                    <strong className="text-slate-900 font-semibold">{dev.name}</strong>
                    <span className="text-slate-400">({dev.factionShort})</span>
                    <span className="text-slate-300">·</span>
                    <span className={dev.decision === 'PAR' ? 'text-emerald-700 font-bold' : dev.decision === 'PRET' ? 'text-rose-700 font-bold' : dev.decision === 'ATTURAS' ? 'text-amber-700 font-bold' : 'text-slate-400 font-bold'}>
                      {dev.decision === 'PAR' ? 'Par' : dev.decision === 'PRET' ? 'Pret' : dev.decision === 'ATTURAS' ? 'Atturējās' : 'Nebalsoja'}
                    </span>
                    <span className="text-slate-400 text-[10px]">(frakcija: {dev.factionLine === 'PAR' ? 'Par' : dev.factionLine === 'PRET' ? 'Pret' : 'Atturas'})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Saeimas Juridiskā anotācija (Collapsible toggle if available) */}
          {vote.summary && (
            <div className="border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => setShowAnnotation(!showAnnotation)}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition cursor-pointer"
              >
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                <span>Juridiskā anotācija un atbildīgā komisija</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showAnnotation ? 'rotate-180' : ''}`} />
              </button>
              {showAnnotation && (
                <div className="mt-1.5 text-[11px] leading-relaxed text-slate-600 pl-3 border-l-2 border-slate-200">
                  <p>{vote.summary}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">
                    Oficiālais protokols: {vote.officialTitle}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TIER 3: Interactive Exploration & Official Proof */}
          <div className="border-t border-slate-100 pt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <button
              type="button"
              onClick={() => onSelect(vote)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 hover:border-slate-300 transition cursor-pointer shadow-2xs"
            >
              <Users className="h-3.5 w-3.5 text-emerald-700" />
              <span>Atvērt 100 deputātu sēžu zāli</span>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            </button>

            <div className="flex items-center gap-3.5 text-slate-500">
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
                    <span>Kopīgot saiti</span>
                  </>
                )}
              </button>

              {vote.protocolUrl && (
                <a
                  href={vote.protocolUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition"
                >
                  <span>Oficiālais protokols</span>
                  <ExternalLink className="h-3 w-3 text-slate-400" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
};
