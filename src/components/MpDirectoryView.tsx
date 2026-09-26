import React, { useState, useMemo } from 'react';
import type { MP, Faction, MpSummaryMap } from '../types';
import { normalizeLatvianSearch } from '../types';
import {
  Search,
  Users,
  X,
  Info,
  LayoutGrid,
  List,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight
} from 'lucide-react';

interface MpDirectoryViewProps {
  mps: MP[];
  factions: Faction[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedFaction: string;
  onFactionChange: (factionId: string) => void;
  activeOnly: boolean;
  onActiveOnlyToggle: (activeOnly: boolean) => void;
  onSelectMp?: (mp: MP) => void;
  mpSummaries?: MpSummaryMap;
}

type SortField = 'name' | 'faction' | 'seat' | 'present' | 'cohesion';
type SortDirection = 'asc' | 'desc';

export const MpDirectoryView: React.FC<MpDirectoryViewProps> = ({
  mps,
  factions,
  searchQuery,
  onSearchChange,
  selectedFaction,
  onFactionChange,
  activeOnly,
  onActiveOnlyToggle,
  onSelectMp,
  mpSummaries,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sortField, setSortField] = useState<SortField>('seat');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Map faction id to faction object for fast lookup
  const factionMap = useMemo(() => {
    const map = new Map<string, Faction>();
    factions.forEach((f) => map.set(f.id, f));
    return map;
  }, [factions]);

  // Compute active deputy counts per faction
  const activeFactionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    mps.filter((m) => m.isActive).forEach((m) => {
      counts.set(m.factionId, (counts.get(m.factionId) || 0) + 1);
    });
    return counts;
  }, [mps]);

  // Filter deputies based on search, faction, and active status
  const filteredMps = useMemo(() => {
    return mps.filter((mp) => {
      if (activeOnly && !mp.isActive) return false;
      if (selectedFaction !== 'ALL' && mp.factionId !== selectedFaction) return false;
      if (searchQuery.trim()) {
        const q = normalizeLatvianSearch(searchQuery.trim());
        const matchesName = normalizeLatvianSearch(mp.name).includes(q);
        const faction = factionMap.get(mp.factionId);
        const matchesFaction = normalizeLatvianSearch(faction?.name).includes(q) || normalizeLatvianSearch(faction?.shortName).includes(q);
        if (!matchesName && !matchesFaction) return false;
      }
      return true;
    });
  }, [mps, activeOnly, selectedFaction, searchQuery, factionMap]);

  // Sort deputies based on active column and direction
  const sortedMps = useMemo(() => {
    return [...filteredMps].sort((a, b) => {
      if (sortField === 'name') {
        const diff = a.name.localeCompare(b.name, 'lv');
        return sortDirection === 'asc' ? diff : -diff;
      }
      if (sortField === 'seat') {
        const diff = a.seatNumber - b.seatNumber;
        return sortDirection === 'asc' ? diff : -diff;
      }
      if (sortField === 'faction') {
        const fA = factionMap.get(a.factionId)?.shortName || a.factionId;
        const fB = factionMap.get(b.factionId)?.shortName || b.factionId;
        const diff = fA.localeCompare(fB, 'lv');
        return sortDirection === 'asc' ? diff : -diff;
      }
      if (sortField === 'present') {
        const pA = mpSummaries?.[a.id]?.presentPct;
        const pB = mpSummaries?.[b.id]?.presentPct;
        const aValid = pA !== undefined;
        const bValid = pB !== undefined;
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        const diff = pA - pB;
        return sortDirection === 'asc' ? diff : -diff;
      }
      if (sortField === 'cohesion') {
        const cA = mpSummaries?.[a.id]?.cohesionPct;
        const cB = mpSummaries?.[b.id]?.cohesionPct;
        const aValid = cA !== null && cA !== undefined;
        const bValid = cB !== null && cB !== undefined;
        if (!aValid && !bValid) return 0;
        if (!aValid) return 1;
        if (!bValid) return -1;
        const diff = cA - cB;
        return sortDirection === 'asc' ? diff : -diff;
      }
      return 0;
    });
  }, [filteredMps, sortField, sortDirection, factionMap, mpSummaries]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      // For numerical percentages, default to descending (highest first)
      if (field === 'present' || field === 'cohesion') {
        setSortDirection('desc');
      } else {
        setSortDirection('asc');
      }
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="h-3 w-3 text-slate-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      );
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-slate-800 shrink-0" />
    ) : (
      <ArrowDown className="h-3 w-3 text-slate-800 shrink-0" />
    );
  };

  // Generate initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Factions Overview Strip */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-700" />
            <h2 className="text-sm font-bold text-slate-900">Saeimas frakcijas un politiskie spēki</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">Kopā 100 deputātu mandāti</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {factions.map((faction) => {
            const count = activeFactionCounts.get(faction.id) || faction.seats;
            const isSelected = selectedFaction === faction.id;

            return (
              <button
                key={faction.id}
                type="button"
                onClick={() => onFactionChange(isSelected ? 'ALL' : faction.id)}
                className={`flex flex-col text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-xs ring-1 ring-slate-900'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-400 hover:shadow-2xs text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 w-full min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: faction.color }}
                  />
                  <span className="font-bold text-xs leading-snug truncate" title={faction.name}>
                    {faction.shortName}
                  </span>
                </div>
                <div className={`text-[11px] mt-1.5 font-mono font-medium ${
                  isSelected ? 'text-slate-300' : 'text-slate-500'
                }`}>
                  {count} {count === 1 ? 'mandāts' : 'mandāti'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Meklēt deputātu pēc vārda vai uzvārda..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Faction selector */}
          <select
            value={selectedFaction}
            onChange={(e) => onFactionChange(e.target.value)}
            style={{ colorScheme: 'light' }}
            aria-label="Filtrēt pēc frakcijas"
            className={`text-xs rounded-lg border py-1.5 px-2.5 font-medium cursor-pointer focus:outline-none transition ${
              selectedFaction !== 'ALL'
                ? 'border-slate-900 bg-slate-100 text-slate-900 font-semibold ring-1 ring-slate-900/20 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <option value="ALL">Visas frakcijas ({mps.filter(m => activeOnly ? m.isActive : true).length})</option>
            {factions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.shortName} – {f.name}
              </option>
            ))}
          </select>

          {/* Active Mandate Toggle */}
          <button
            type="button"
            onClick={() => onActiveOnlyToggle(!activeOnly)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
              activeOnly
                ? 'border-slate-300 bg-slate-100 text-slate-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            title="Pārslēgt starp šobrīd 100 aktīvajiem deputātiem un visiem 14. Saeimā reģistrētajiem deputātiem (ieskaitot ministrus ar noliktiem mandātiem)"
          >
            <span>{activeOnly ? 'Tikai aktīvie (100)' : 'Visi vēsturiskie (140)'}</span>
          </button>
        </div>
      </section>

      {/* Deputies View Header (Count & View Switcher) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-700">
              Atrasti <strong className="font-mono text-slate-900">{filteredMps.length}</strong> deputāti
            </span>
            {selectedFaction !== 'ALL' && (
              <button
                type="button"
                onClick={() => onFactionChange('ALL')}
                className="text-slate-500 hover:text-slate-900 hover:underline cursor-pointer"
              >
                (Noņemt filtru)
              </button>
            )}
          </div>

          {/* View mode toggle */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Kartīšu režīms"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Kartītes</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Tabulas / saraksta režīms"
            >
              <List className="h-3.5 w-3.5" />
              <span>Tabula</span>
            </button>
          </div>
        </div>

        {filteredMps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
            <Users className="mx-auto h-7 w-7 text-slate-300 mb-2" />
            <p className="text-sm font-semibold">Nav atrasts neviens deputāts</p>
            <p className="text-xs text-slate-400 mt-1">
              Pārbaudiet meklēto vārdu vai atiestatiet frakcijas filtru.
            </p>
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                onFactionChange('ALL');
                onActiveOnlyToggle(true);
              }}
              className="mt-3 rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
            >
              Atiestatīt meklēšanu
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE / LEDGER VIEW */
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 select-none">
                    <th
                      className="py-2.5 px-3.5 cursor-pointer hover:text-slate-900 group transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Deputāts</span>
                        {renderSortIcon('name')}
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 cursor-pointer hover:text-slate-900 group transition-colors"
                      onClick={() => handleSort('faction')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Frakcija</span>
                        {renderSortIcon('faction')}
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 text-center cursor-pointer hover:text-slate-900 group transition-colors"
                      onClick={() => handleSort('seat')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Vieta</span>
                        {renderSortIcon('seat')}
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-900 group transition-colors"
                      onClick={() => handleSort('present')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Klātbūtne</span>
                        {renderSortIcon('present')}
                      </div>
                    </th>
                    <th
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-slate-900 group transition-colors"
                      onClick={() => handleSort('cohesion')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Vienotība</span>
                        {renderSortIcon('cohesion')}
                      </div>
                    </th>
                    <th className="py-2.5 px-3 text-center">
                      <span>Statuss</span>
                    </th>
                    <th className="py-2.5 px-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedMps.map((mp) => {
                    const faction = factionMap.get(mp.factionId);
                    const initials = getInitials(mp.name);
                    const summary = mpSummaries?.[mp.id];

                    return (
                      <tr
                        key={mp.id}
                        onClick={() => onSelectMp?.(mp)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2.5 min-w-[180px]">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0 shadow-2xs"
                              style={{ backgroundColor: faction?.color || '#475569' }}
                            >
                              {initials}
                            </div>
                            <span className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">
                              {mp.name}
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 min-w-[80px]">
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                              style={{ backgroundColor: faction?.color || '#475569' }}
                            >
                              {faction?.shortName || mp.factionId.toUpperCase()}
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono text-slate-500 text-xs">
                            Nr. {mp.seatNumber}
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          {summary ? (
                            <span className={`font-mono font-bold text-xs ${
                              summary.presentPct >= 85 ? 'text-emerald-700' : summary.presentPct >= 70 ? 'text-slate-800' : 'text-rose-600'
                            }`}>
                              {summary.presentPct}%
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right">
                          {summary && !summary.isIndependent && summary.cohesionPct !== null ? (
                            <span className="font-mono font-bold text-slate-800 text-xs">
                              {summary.cohesionPct}%
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-medium">
                              {summary?.isIndependent ? 'Neatkarīgais' : '—'}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <div className="flex justify-center">
                            {mp.isSubstitute ? (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium"
                                title={mp.replacesMpName ? `Aizvieto: ${mp.replacesMpName}` : 'Aizvietotājs'}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Aizvietotājs
                              </span>
                            ) : !mp.isActive ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-medium">
                                Nolicis mandātu
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-medium">
                                Aktīvs
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-2 text-right">
                          <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 transition-colors ml-auto" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* CARD GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {sortedMps.map((mp) => {
              const faction = factionMap.get(mp.factionId);
              const initials = getInitials(mp.name);
              const summary = mpSummaries?.[mp.id];

              return (
                <div
                  key={mp.id}
                  onClick={() => onSelectMp?.(mp)}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col justify-between hover:border-slate-300 hover:shadow-md transition-all group text-left cursor-pointer"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      {/* Initials Avatar with faction colored indicator */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 text-white shadow-2xs"
                        style={{ backgroundColor: faction?.color || '#475569' }}
                      >
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div
                          className="text-xs font-bold text-slate-900 group-hover:text-slate-700 transition line-clamp-2 min-h-[34px] leading-snug"
                          title={mp.name}
                        >
                          {mp.name}
                        </div>

                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white"
                            style={{ backgroundColor: faction?.color || '#475569' }}
                          >
                            {faction?.shortName || mp.factionId.toUpperCase()}
                          </span>

                          <span className="text-[10px] text-slate-400 font-mono">
                            Nr. {mp.seatNumber}
                          </span>

                          {mp.isSubstitute && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-medium"
                              title={mp.replacesMpName ? `Aizvieto: ${mp.replacesMpName}` : 'Aizvietotājs (mīkstais mandāts)'}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              Aizvietotājs
                            </span>
                          )}

                          {!mp.isActive && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-medium">
                              Nolicis mandātu
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 2-column compact stat lockup */}
                    {summary ? (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-lg bg-slate-50/80 p-2 border border-slate-100">
                          <div className={`font-mono text-sm font-bold ${
                            summary.presentPct >= 85 ? 'text-emerald-700' : summary.presentPct >= 70 ? 'text-slate-800' : 'text-rose-600'
                          }`}>
                            {summary.presentPct}%
                          </div>
                          <div className="text-[9px] uppercase font-semibold tracking-wider text-slate-400 mt-0.5">
                            Klātbūtne
                          </div>
                        </div>

                        <div className="rounded-lg bg-slate-50/80 p-2 border border-slate-100">
                          {!summary.isIndependent && summary.cohesionPct !== null ? (
                            <>
                              <div className="font-mono text-sm font-bold text-slate-800">
                                {summary.cohesionPct}%
                              </div>
                              <div className="text-[9px] uppercase font-semibold tracking-wider text-slate-400 mt-0.5">
                                Vienotība
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="font-mono text-sm font-bold text-slate-400">
                                —
                              </div>
                              <div className="text-[9px] uppercase font-semibold tracking-wider text-slate-400 mt-0.5" title="Neatkarīgais deputāts">
                                Neatkarīgais
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 text-center py-2 text-[10px] text-slate-400">
                        Nav datu
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Edge-case Explainer Note */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-start gap-3 text-xs text-slate-600">
        <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800">Par mandātu aizvietošanu:</strong> Saskaņā ar Saeimas kārtības rulli, deputātam kļūstot par Ministru prezidentu vai ministru, viņa Saeimas mandāts tiek apturēts, un tā vietā nāk nākamais attiecīgā vēlēšanu saraksta kandidāts («mīkstais mandāts»). Šeit uzrādīti gan 100 šobrīd aktīvie deputāti, gan mandātu nolikušie locekļi.
        </div>
      </div>
    </div>
  );
};
