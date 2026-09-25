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
  MessageSquare,
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

export const VoteCard: React.FC<VoteCardProps> = ({ vote, onSelect }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDebates, setShowDebates] = useState(false);

  const total = 100;
  const parPct = (vote.counts.par / total) * 100;
  const pretPct = (vote.counts.pret / total) * 100;
  const atturasPct = (vote.counts.atturas / total) * 100;
  const nebalsoPct = (vote.counts.nebalso / total) * 100;

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

      {/* Row 1: Title (1) + Result (2) in the exact same visual fixation */}
      <div className="flex items-start justify-between gap-3">
        <h3
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-base sm:text-lg font-bold leading-snug text-slate-900 hover:text-emerald-800 cursor-pointer transition flex-1"
        >
          {cleanedTitle}
        </h3>

        {/* 2. Verdict Badge Docked Directly to Title */}
        <div className="flex-shrink-0 pt-0.5">
          {isQuorumBreak ? (
            <span className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900 shadow-2xs whitespace-nowrap">
              Nav kvoruma
            </span>
          ) : (
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold shadow-2xs whitespace-nowrap ${
                isApproved
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-rose-300 bg-rose-50 text-rose-800'
              }`}
            >
              {isApproved ? 'Pieņemts' : 'Noraidīts'}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Vote Split (3) + Rebel count */}
      <div className="mt-2 flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-2 sm:gap-2.5 text-slate-600">
          <span>
            <strong className="tabular-nums font-bold text-slate-900">{vote.counts.par}</strong>{' '}
            <span className="font-sans text-[11px] text-slate-500">Par</span>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            <strong className="tabular-nums font-bold text-slate-900">{vote.counts.pret}</strong>{' '}
            <span className="font-sans text-[11px] text-slate-500">Pret</span>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            <strong className="tabular-nums font-bold text-slate-700">{vote.counts.atturas}</strong>{' '}
            <span className="font-sans text-[11px] text-slate-500">Atturas</span>
          </span>
          <span className="text-slate-300">·</span>
          <span>
            <strong className="tabular-nums font-bold text-slate-500">{vote.counts.nebalso}</strong>{' '}
            <span className="font-sans text-[11px] text-slate-400">Nebalsoja</span>
          </span>
        </div>

        {/* Discrete Rebel MPs indicator */}
        {allDeviations.length > 0 && (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {allDeviations.length} pret frakciju
          </span>
        )}
      </div>

      {/* Row 3: Subdued Supporting Context (Topic · Date · Stage · Bill Nr) sits quietly underneath */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 font-normal">
        <span className="text-slate-600 font-medium">{vote.category.label}</span>
        <span>·</span>
        <span className="font-mono text-slate-500">{vote.sittingDate}</span>

        {vote.readingStage ? (
          <>
            <span>·</span>
            <span className="text-slate-500">{vote.readingStage}</span>
          </>
        ) : vote.voteType === 'priekslikums' ? (
          <>
            <span>·</span>
            <span className="text-slate-500">Priekšlikums</span>
          </>
        ) : vote.voteType === 'procedura' ? (
          <>
            <span>·</span>
            <span className="text-slate-500">Procedūra</span>
          </>
        ) : null}

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

      {/* Row 4: Single Expand Action Trigger */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
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
      </div>

      {/* LEVEL 2: Progressive Disclosure (Accordion Drawer) */}
      {isExpanded && (
        <div className="mt-3.5 pt-3.5 border-t border-slate-200/80 space-y-4 text-xs">
          {/* Quick 100-Seat Hemicycle Launch Banner */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-700" />
              <span className="font-semibold text-slate-900">
                100 deputātu sēžu zāles shēma
              </span>
            </div>
            <button
              type="button"
              onClick={() => onSelect(vote)}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              <span>Atvērt zāli</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Ratio Progress Bar inside drawer */}
          <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span className="font-sans font-medium text-slate-700">Kopējā balsu proporcija:</span>
              <span>{parPct.toFixed(0)}% Par · {pretPct.toFixed(0)}% Pret</span>
            </div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div style={{ width: `${parPct}%` }} className="bg-emerald-600 transition-all duration-300" title={`${vote.counts.par} Par`} />
              <div style={{ width: `${pretPct}%` }} className="bg-rose-600 transition-all duration-300" title={`${vote.counts.pret} Pret`} />
              <div style={{ width: `${atturasPct}%` }} className="bg-amber-500 transition-all duration-300" title={`${vote.counts.atturas} Atturas`} />
              <div style={{ width: `${nebalsoPct}%` }} className="bg-slate-300 transition-all duration-300" title={`${vote.counts.nebalso} Nebalsoja`} />
            </div>
          </div>

          {/* Detailed Rebel MPs Breakdown (Tamed and cleanly placed inside drawer) */}
          {allDeviations.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="font-semibold text-slate-800 mb-1.5 flex items-center gap-1.5">
                <span>✦ Deputāti, kuri balsoja pretēji savas frakcijas vairākumam:</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {allDeviations.map((dev) => (
                  <span
                    key={dev.mpId}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] shadow-2xs"
                  >
                    <strong className="text-slate-900">{dev.name}</strong>
                    <span className="text-slate-400">({dev.factionShort})</span>:
                    <span className="font-bold text-slate-800">{dev.decision}</span>
                    <span className="text-slate-400">(frakcija: {dev.factionLine})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Saeimas Legal Annotation */}
          {vote.summary && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 leading-relaxed text-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-slate-900 mb-1">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>Saeimas juridiskā anotācija:</span>
              </div>
              <p className="text-slate-600 text-[11px] leading-normal">{vote.summary}</p>
              <div className="mt-2 font-mono text-[10px] text-slate-400">
                Oficiālais protokola nosaukums: {vote.officialTitle}
              </div>
            </div>
          )}

          {/* Core Debate Arguments (if recorded) */}
          {vote.debateArguments && (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setShowDebates(!showDebates)}
                className="flex w-full items-center justify-between p-2.5 text-left text-slate-700 hover:bg-slate-50 font-medium"
              >
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                  <span>Galvenie debašu argumenti stenogrammā</span>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showDebates ? 'rotate-180' : ''}`} />
              </button>

              {showDebates && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-2 text-[11px] leading-relaxed">
                  <div>
                    <span className="font-semibold text-slate-800 block mb-0.5">
                      ✦ Virzītāju argumenti ({vote.debateArguments.rapporteur || 'Atbildīgā komisija'}):
                    </span>
                    <p className="text-slate-600 pl-2.5 border-l-2 border-emerald-600">
                      {vote.debateArguments.proponents}
                    </p>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800 block mb-0.5">
                      ✦ Opozīcijas un debatētāju iebildumi:
                    </span>
                    <p className="text-slate-600 pl-2.5 border-l-2 border-rose-600">
                      {vote.debateArguments.opponents}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* The 8 Permanently Anchored Faction Ledger Bars */}
          {!vote.isSecret && sortedFactions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Frakciju balsojumu sadalījums:
                </span>
                <span className="text-[10px] text-slate-400">
                  Zaļš: Par · Sarkans: Pret · Dzeltens: Atturas · Pelēks: Nebalsoja
                </span>
              </div>

              {/* 8-Faction Responsive Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {sortedFactions.map((f) => {
                  const fTotal = f.votes.par + f.votes.pret + f.votes.atturas + f.votes.nebalso;
                  const fParPct = fTotal ? (f.votes.par / fTotal) * 100 : 0;
                  const fPretPct = fTotal ? (f.votes.pret / fTotal) * 100 : 0;
                  const fAtturasPct = fTotal ? (f.votes.atturas / fTotal) * 100 : 0;
                  const fNebalsoPct = fTotal ? (f.votes.nebalso / fTotal) * 100 : 0;

                  return (
                    <div
                      key={f.factionId}
                      className="rounded-lg border border-slate-200/80 bg-slate-50/60 p-2 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-800" style={{ color: f.color }}>
                          {f.shortName} <span className="text-[10px] text-slate-400 font-normal">({fTotal})</span>
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {f.votes.par}P · {f.votes.pret}Pr{f.votes.nebalso > 0 ? ` · ${f.votes.nebalso}Nb` : ''}
                        </span>
                      </div>

                      {/* 4-Color Proportional Bar */}
                      <div className="flex h-1.5 w-full overflow-hidden rounded bg-slate-200">
                        <div style={{ width: `${fParPct}%` }} className="bg-emerald-700" title={`${f.votes.par} Par`} />
                        <div style={{ width: `${fPretPct}%` }} className="bg-rose-700" title={`${f.votes.pret} Pret`} />
                        <div style={{ width: `${fAtturasPct}%` }} className="bg-amber-600" title={`${f.votes.atturas} Atturas`} />
                        <div style={{ width: `${fNebalsoPct}%` }} className="bg-slate-300" title={`${f.votes.nebalso} Nebalsoja`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Drawer Actions: Copy & Official saeima.lv protocol */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Nokopēts saites URL!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Kopīgot balsojuma saiti</span>
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
                <span>Oficiālais saeima.lv protokols</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </article>
  );
};
