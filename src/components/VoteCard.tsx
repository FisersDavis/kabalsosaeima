import React, { useState } from 'react';
import type { Vote, FactionBreakdown } from '../types';
import { Check, Copy, ChevronRight, FileText, AlertTriangle, RefreshCw, Lock, ExternalLink, MessageSquare, ChevronDown, UserX } from 'lucide-react';

interface VoteCardProps {
  vote: Vote;
  onSelect: (vote: Vote) => void;
}

export const VoteCard: React.FC<VoteCardProps> = ({ vote, onSelect }) => {
  const [copied, setCopied] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
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

  return (
    <article
      id={`balsojums-${vote.id}`}
      className="group relative rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-800/90 dark:bg-slate-900/90"
    >
      {/* Revote Notice (Edge Case 6) */}
      {vote.isRevote && (
        <div className="mb-3 flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            <strong>Pārbalsojums:</strong> {vote.revoteReason || 'Balsojums atkārtots saskaņā ar procedūras pieteikumu vai pults kļūdu.'}
          </span>
        </div>
      )}

      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/70">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {vote.category.label}
          </span>
          <span>·</span>
          <span className="font-mono">{vote.sittingDate}</span>
          <span>·</span>
          <span className="font-mono">{vote.sittingTime}</span>
          <span>·</span>
          <span>{vote.saeimaTerm}. Saeima</span>
          {vote.reading && (
            <>
              <span>·</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {vote.reading}. lasījums
              </span>
            </>
          )}

          {/* Urgent tag */}
          {vote.isUrgent && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Steidzams{vote.reading === 2 ? ' (Galīgais)' : ''}
            </span>
          )}

          {/* Secret ballot */}
          {vote.isSecret && (
            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
              <Lock className="h-3 w-3" />
              Aizklāts balsojums
            </span>
          )}
        </div>

        {/* Outcome Badge */}
        {isQuorumBreak ? (
          <span
            className="inline-flex items-center gap-1 rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/40 dark:text-amber-300"
            title="Nav kvoruma: balsoja mazāk nekā 50 deputāti (Satversmes 24. pants)"
          >
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            Nav Kvoruma
          </span>
        ) : (
          <span
            className={`rounded px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider border ${
              isApproved
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300'
            }`}
          >
            {isApproved ? 'Pieņemts' : 'Noraidīts'}
          </span>
        )}
      </div>

      {/* Titles */}
      <div className="pt-3.5 space-y-1">
        <h3
          onClick={() => onSelect(vote)}
          className="text-base sm:text-lg font-bold leading-snug text-slate-900 group-hover:text-emerald-800 dark:text-slate-100 dark:group-hover:text-emerald-400 cursor-pointer transition"
        >
          {vote.simplifiedTitle}
        </h3>
        <p className="line-clamp-1 font-mono text-xs text-slate-500 dark:text-slate-400">
          {vote.officialTitle}
        </p>
      </div>

      {/* Saeima Anotācija / Summary preview */}
      <div className="mt-3 rounded border border-slate-200/70 bg-slate-50/60 p-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800/70 dark:bg-slate-800/40 dark:text-slate-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
            <FileText className="h-3.5 w-3.5 text-slate-500" />
            <span>Likumprojekta būtība (Saeimas juridiskā anotācija):</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSummary(!showSummary)}
            className="text-[11px] font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {showSummary ? 'Rādīt mazāk' : 'Lasīt pilno anotāciju'}
          </button>
        </div>
        <p className={`mt-1.5 ${showSummary ? '' : 'line-clamp-2'}`}>
          {vote.summary}
        </p>
      </div>

      {/* Debate / Core Arguments Collapsible */}
      {vote.debateArguments && (
        <div className="mt-2.5 rounded border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setShowDebates(!showDebates)}
            className="flex w-full items-center justify-between p-2.5 text-left text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50 transition font-medium"
          >
            <div className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
              <span>Galvenie debašu argumenti (Sēdes stenogramma)</span>
            </div>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${showDebates ? 'rotate-180' : ''}`} />
          </button>

          {showDebates && (
            <div className="border-t border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800/70 dark:bg-slate-950/40 space-y-2.5 text-[11px] leading-relaxed">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
                  ✦ Virzītāju argumenti ({vote.debateArguments.rapporteur || 'Atbildīgā komisija'}):
                </span>
                <p className="text-slate-600 dark:text-slate-400 pl-3 border-l-2 border-emerald-600 dark:border-emerald-500">
                  {vote.debateArguments.proponents}
                </p>
              </div>

              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block mb-0.5">
                  ✦ Opozīcijas un debatētāju iebildumi:
                </span>
                <p className="text-slate-600 dark:text-slate-400 pl-3 border-l-2 border-red-600 dark:border-red-500">
                  {vote.debateArguments.opponents}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Aggregate Voting Bar: Pine / Brick / Ochre / Slate */}
      <div className="mt-4 space-y-2">
        <div className="flex justify-between font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-sm bg-emerald-700 dark:bg-emerald-500" />
            {vote.counts.par} Par
          </span>
          <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
            <span className="h-2 w-2 rounded-sm bg-red-700 dark:bg-red-500" />
            {vote.counts.pret} Pret
          </span>
          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <span className="h-2 w-2 rounded-sm bg-amber-600" />
            {vote.counts.atturas} Atturas
          </span>
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-sm bg-slate-400" />
            {vote.counts.nebalso} Nebalsoja
          </span>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="flex h-2 w-full overflow-hidden rounded bg-slate-100 shadow-inner dark:bg-slate-800">
          <div style={{ width: `${parPct}%` }} className="bg-emerald-700 dark:bg-emerald-600 transition-all duration-300" />
          <div style={{ width: `${pretPct}%` }} className="bg-red-700 dark:bg-red-600 transition-all duration-300" />
          <div style={{ width: `${atturasPct}%` }} className="bg-amber-600 transition-all duration-300" />
          <div style={{ width: `${nebalsoPct}%` }} className="bg-slate-300 dark:bg-slate-600 transition-all duration-300" />
        </div>

        {/* Legal Calculation & Quorum Status */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Kvorums: {vote.counts.totalPresent} / 50 deputāti</span>
          <span>Pieņemšanai: Par &gt; Pret + Atturas ({vote.counts.pret + vote.counts.atturas})</span>
        </div>
      </div>

      {/* MP Deviations Callout */}
      {allDeviations.length > 0 && (
        <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <UserX className="h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold">
            {allDeviations.length} deputāts balsoja pretēji frakcijas vairākumam:
          </span>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            {allDeviations.map((dev) => (
              <span
                key={dev.mpId}
                className="rounded bg-white px-1.5 py-0.5 shadow-xs border border-amber-200 dark:bg-slate-900 dark:border-amber-800"
              >
                <strong>{dev.name}</strong> ({dev.factionShort}) balsoja <strong>{dev.decision}</strong> (frakcija: {dev.factionLine})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* The Pure Option 1: Permanently Anchored Faction Ledger Bars */}
      {!vote.isSecret && sortedFactions.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-medium uppercase tracking-wider">Frakciju balsojumi (sakārtoti pēc vietu skaita):</span>
            <span>Zaļš: Par · Sarkans: Pret · Dzeltens: Atturas · Pelēks: Nebalsoja</span>
          </div>

          {/* 8-Faction Responsive Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
            {sortedFactions.map((f) => {
              const fTotal = f.votes.par + f.votes.pret + f.votes.atturas + f.votes.nebalso;
              const fParPct = fTotal ? (f.votes.par / fTotal) * 100 : 0;
              const fPretPct = fTotal ? (f.votes.pret / fTotal) * 100 : 0;
              const fAtturasPct = fTotal ? (f.votes.atturas / fTotal) * 100 : 0;
              const fNebalsoPct = fTotal ? (f.votes.nebalso / fTotal) * 100 : 0;

              return (
                <div
                  key={f.factionId}
                  className="rounded border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800/70 dark:bg-slate-950/40 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200" style={{ color: f.color }}>
                      {f.shortName} <span className="text-[10px] text-slate-400 font-normal">({fTotal})</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                      {f.votes.par}P · {f.votes.pret}Pr{f.votes.nebalso > 0 ? ` · ${f.votes.nebalso}Nb` : ''}
                    </span>
                  </div>

                  {/* 4-Color Proportional Faction Discipline Bar */}
                  <div className="flex h-1.5 w-full overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
                    <div style={{ width: `${fParPct}%` }} className="bg-emerald-700 dark:bg-emerald-600" title={`${f.votes.par} Par`} />
                    <div style={{ width: `${fPretPct}%` }} className="bg-red-700 dark:bg-red-600" title={`${f.votes.pret} Pret`} />
                    <div style={{ width: `${fAtturasPct}%` }} className="bg-amber-600" title={`${f.votes.atturas} Atturas`} />
                    <div style={{ width: `${fNebalsoPct}%` }} className="bg-slate-300 dark:bg-slate-600" title={`${f.votes.nebalso} Nebalsoja`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Navigation & Provenance Link */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-100 pt-3 gap-2 text-xs dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">Nokopēts!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Kopīgot</span>
              </>
            )}
          </button>

          {vote.protocolUrl && (
            <a
              href={vote.protocolUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
              title="Oficiālais Saeimas sēdes protokols un stenogramma"
            >
              <span>Avots (saeima.lv)</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelect(vote)}
          className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-300 transition group/btn self-end sm:self-auto"
        >
          <span>{vote.isSecret ? 'Skatīt balsojuma detaļas' : 'Skatīt 100 deputātu balsis sēžu zālē'}</span>
          <ChevronRight className="h-4 w-4 transition transform group-hover/btn:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
};
