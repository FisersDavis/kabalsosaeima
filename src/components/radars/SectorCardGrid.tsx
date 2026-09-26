import React from 'react';
import { SectorCard, type CivicDomainConfig } from './SectorCard';

interface DomainStat {
  totalVotes: number;
  consensusPct: number;
  tenseVotesCount?: number;
}

export interface SectorCardGridProps {
  domains: CivicDomainConfig[];
  domainStatsMap: Map<string, DomainStat>;
  onSelectSector: (sectorId: string) => void;
}

export const SectorCardGrid: React.FC<SectorCardGridProps> = ({
  domains,
  domainStatsMap,
  onSelectSector,
}) => {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
          <span>Nozaru pārskats un vienprātība</span>
        </h3>
        <span className="text-[10px] text-slate-500 lowercase font-normal">
          (noklikšķiniet uz kartītes, lai atvērtu nozares analīzi)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-stretch">
        {domains.map((domain) => {
          const dStat = domainStatsMap.get(domain.id) || {
            totalVotes: 0,
            consensusPct: 0,
            tenseVotesCount: 0,
          };

          return (
            <SectorCard
              key={domain.id}
              domain={domain}
              totalVotes={dStat.totalVotes}
              consensusPct={dStat.consensusPct}
              tenseVotesCount={dStat.tenseVotesCount ?? 0}
              onSelect={onSelectSector}
            />
          );
        })}
      </div>
    </section>
  );
};
