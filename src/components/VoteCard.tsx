import React, { useState } from 'react';
import type { Vote } from '../types';
import { Check, Copy, ChevronRight, FileText, AlertTriangle, RefreshCw, Lock } from 'lucide-react';

interface VoteCardProps {
  vote: Vote;
  onSelect: (vote: Vote) => void;
}

export const VoteCard: React.FC<VoteCardProps> = ({ vote, onSelect }) => {
  const [copied, setCopied] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

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

  return (
    <article
      id={`balsojums-${vote.id}`}
      className="group relative rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800/90 dark:bg-slate-900/90"
    >
      {/* Revote Notice (Edge Case 6) */}
      {vote.isRevote && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-300 border border-amber-500/20">
          <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />
          <span>
            <strong>Pārbalsojums:</strong> {vote.revoteReason || 'Balsojums atkārtots saskaņā ar procedūras pieteikumu vai pults kļūdu.'}
          </span>
        </div>
      )}

      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/60">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded-md bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
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

          {/* Urgent / Final tag (Edge Case 3) */}
          {vote.isUrgent && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
              Steidzams{vote.reading === 2 ? ' (Galīgais)' : ''}
            </span>
          )}

          {/* Secret ballot indicator (Edge Case 5) */}
          {vote.isSecret && (
            <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-400 border border-purple-500/20">
              <Lock className="h-3 w-3" />
              Aizklāts
            </span>
          )}
        </div>

        {/* Outcome Badge (Edge Cases 1, 2) */}
        {isQuorumBreak ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold tracking-wide uppercase border border-amber-500/30 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            title="Nav kvoruma: balsoja mazāk nekā 50 deputāti (Satversmes 24. pants)"
          >
            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
            Nav Kvoruma
          </span>
        ) : (
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-semibold tracking-wide uppercase ${
              isApproved
                ? 'border border-emerald-500/20 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border border-rose-500/20 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
            }`}
          >
            {isApproved ? 'Pieņemts' : 'Noraidīts'}
          </span>
        )}
      </div>

      {/* Titles */}
      <div className="pt-3.5 space-y-1.5">
        <h3
          onClick={() => onSelect(vote)}
          className="text-lg font-bold leading-snug text-slate-900 group-hover:text-emerald-600 dark:text-slate-100 dark:group-hover:text-emerald-400 cursor-pointer transition"
        >
          {vote.simplifiedTitle}
        </h3>
        <div className="flex items-center gap-2">
          <p className="line-clamp-1 font-mono text-xs text-slate-500 dark:text-slate-400">
            {vote.officialTitle}
          </p>
        </div>
      </div>

      {/* Saeima Anotācija / Summary preview */}
      <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
            <FileText className="h-3.5 w-3.5 text-slate-400" />
            <span>Likumprojekta būtība (Saeimas anotācija):</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSummary(!showSummary)}
            className="text-[11px] text-emerald-600 hover:underline dark:text-emerald-400"
          >
            {showSummary ? 'Rādīt mazāk' : 'Lasīt visu'}
          </button>
        </div>
        <p className={`mt-1.5 ${showSummary ? '' : 'line-clamp-2'}`}>
          {vote.summary}
        </p>
      </div>

      {/* Aggregate Voting Bar with Quorum & Adoption Math (Edge Cases 1, 2) */}
      <div className="mt-5 space-y-2">
        <div className="flex justify-between font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            {vote.counts.par} Par
          </span>
          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            {vote.counts.pret} Pret
          </span>
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {vote.counts.atturas} Atturas
          </span>
          <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            {vote.counts.nebalso} Nebalsoja
          </span>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 shadow-inner dark:bg-slate-800">
          <div style={{ width: `${parPct}%` }} className="bg-emerald-500 transition-all duration-500" />
          <div style={{ width: `${pretPct}%` }} className="bg-rose-500 transition-all duration-500" />
          <div style={{ width: `${atturasPct}%` }} className="bg-amber-400 transition-all duration-500" />
          <div style={{ width: `${nebalsoPct}%` }} className="bg-slate-300 dark:bg-slate-600 transition-all duration-500" />
        </div>

        {/* Legal Calculation Hint */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Kvorums: {vote.counts.totalPresent} / 50 deputāti</span>
          <span>Nepieciešams pieņemšanai: Par &gt; Pret + Atturas ({vote.counts.pret + vote.counts.atturas})</span>
        </div>
      </div>

      {/* Faction Spectrum Breakdown (Edge Case 8: snapshot-based dynamic cohesion) */}
      {!vote.isSecret && vote.factionBreakdown && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80">
          <div className="mb-2 flex items-center justify-between text-[11px] text-slate-400">
            <span className="font-medium uppercase tracking-wider">Frakciju balsojuma disciplīna:</span>
            <span>Zaļš: Par · Sarkans: Pret</span>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-2 sm:grid-cols-4">
            {vote.factionBreakdown.map((f) => {
              const fTotal = f.votes.par + f.votes.pret + f.votes.atturas + f.votes.nebalso;
              const fParPct = fTotal ? (f.votes.par / fTotal) * 100 : 0;
              const fPretPct = fTotal ? (f.votes.pret / fTotal) * 100 : 0;
              const fAtturasPct = fTotal ? (f.votes.atturas / fTotal) * 100 : 0;

              return (
                <div key={f.factionId} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-slate-700 dark:text-slate-300" style={{ color: f.color }}>
                      {f.shortName}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {f.votes.par}P / {f.votes.pret}Pr
                    </span>
                  </div>
                  {/* Mini faction split-bar */}
                  <div className="flex h-1.5 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    <div style={{ width: `${fParPct}%` }} className="bg-emerald-500" />
                    <div style={{ width: `${fPretPct}%` }} className="bg-rose-500" />
                    <div style={{ width: `${fAtturasPct}%` }} className="bg-amber-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer Navigation & Actions */}
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Nokopēts!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Kopīgot saiti</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelect(vote)}
          className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition group/btn"
        >
          <span>{vote.isSecret ? 'Skatīt balsojuma detaļas' : 'Skatīt 100 deputātu balsis sēžu zālē'}</span>
          <ChevronRight className="h-4 w-4 transition transform group-hover/btn:translate-x-0.5" />
        </button>
      </div>
    </article>
  );
};
