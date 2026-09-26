import React from 'react';
import { ArrowRight } from 'lucide-react';

export interface CivicDomainConfig {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  borderHover?: string;
}

export interface SectorCardProps {
  domain: CivicDomainConfig;
  totalVotes: number;
  consensusPct: number;
  tenseVotesCount: number;
  onSelect: (domainId: string) => void;
}

export const SectorCard: React.FC<SectorCardProps> = ({
  domain,
  totalVotes,
  consensusPct,
  tenseVotesCount,
  onSelect,
}) => {
  const Icon = domain.icon;

  let summaryText = 'Visi lēmumi pieņemti ar pārliecinošu vairākumu';
  if (tenseVotesCount > 0) {
    if (tenseVotesCount % 100 >= 11 && tenseVotesCount % 100 <= 19) {
      summaryText = `${tenseVotesCount} balsojumu ar minimālu pārsvaru`;
    } else if (tenseVotesCount % 10 === 1) {
      summaryText = `${tenseVotesCount} balsojums ar minimālu pārsvaru`;
    } else {
      summaryText = `${tenseVotesCount} balsojumi ar minimālu pārsvaru`;
    }
  }

  return (
    <div
      onClick={() => onSelect(domain.id)}
      className="group rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs transition hover:border-slate-300 hover:shadow-xs cursor-pointer flex flex-col justify-between h-full"
    >
      <div>
        {/* Top: Sector Icon + Title (Left) and Alignment % (Right) */}
        <div className="flex items-start justify-between gap-3">
          {/* Sector Anchor */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-lg ${domain.iconBg} ${domain.iconColor} shrink-0`}>
              <Icon className="h-4 w-4" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-900 transition-colors leading-snug">
              {domain.title}
            </h4>
          </div>

          {/* Metric Takeaway */}
          <div className="text-right shrink-0 pl-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium block">
              Vienprātība
            </span>
            <span className="text-base font-mono font-bold text-slate-900 leading-tight">
              {consensusPct}%
            </span>
          </div>
        </div>

        {/* Progress Bar anchored directly below the header */}
        <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-700 rounded-full transition-all duration-500"
            style={{ width: `${consensusPct}%` }}
          />
        </div>

        {/* Factual Conflict / Consensus Volume Summary (Subtle secondary text) */}
        <div className="mt-2.5 min-h-[32px] flex items-center">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-normal">
            {summaryText}
          </p>
        </div>
      </div>

      {/* Bottom Footer: Total Vote Count (Left) and "Atvērt analīzi →" (Right) */}
      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-[11px] font-mono text-slate-400 font-normal">
          {totalVotes} balsojumi
        </span>
        <span className="inline-flex items-center gap-1 text-slate-600 group-hover:text-slate-900 font-medium transition-colors">
          <span>Atvērt analīzi</span>
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform text-slate-400 group-hover:text-slate-700" />
        </span>
      </div>
    </div>
  );
};
