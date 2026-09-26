import React from 'react';
import type { MP, Faction } from '../types';
import { Search, Users, X, Info } from 'lucide-react';

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
}

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
}) => {
  // Map faction id to faction object for fast lookup
  const factionMap = React.useMemo(() => {
    const map = new Map<string, Faction>();
    factions.forEach((f) => map.set(f.id, f));
    return map;
  }, [factions]);

  // Compute active deputy counts per faction
  const activeFactionCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    mps.filter((m) => m.isActive).forEach((m) => {
      counts.set(m.factionId, (counts.get(m.factionId) || 0) + 1);
    });
    return counts;
  }, [mps]);

  // Filter deputies based on search, faction, and active status
  const filteredMps = React.useMemo(() => {
    return mps.filter((mp) => {
      if (activeOnly && !mp.isActive) return false;
      if (selectedFaction !== 'ALL' && mp.factionId !== selectedFaction) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = mp.name.toLowerCase().includes(q);
        const faction = factionMap.get(mp.factionId);
        const matchesFaction = faction?.name.toLowerCase().includes(q) || faction?.shortName.toLowerCase().includes(q);
        if (!matchesName && !matchesFaction) return false;
      }
      return true;
    });
  }, [mps, activeOnly, selectedFaction, searchQuery, factionMap]);

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
                className={`flex flex-col text-left p-2.5 rounded-lg border transition cursor-pointer ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80 hover:border-slate-300 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-1 w-full">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: faction.color }}
                  />
                  <span className={`text-[10px] font-mono px-1 rounded ${
                    isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-200/80 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </div>
                <div className="mt-1.5 font-bold text-xs leading-snug truncate w-full" title={faction.name}>
                  {faction.shortName}
                </div>
                <div className={`text-[10px] mt-0.5 truncate w-full font-medium ${
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
            aria-label="Filtrēt pēc frakcijas"
            className="text-xs rounded-lg border border-slate-200 bg-white py-1.5 px-2.5 font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:border-slate-400 cursor-pointer"
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

      {/* Deputies Grid */}
      <section className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Atrasti {filteredMps.length} deputāti</span>
          {selectedFaction !== 'ALL' && (
            <button
              type="button"
              onClick={() => onFactionChange('ALL')}
              className="text-slate-600 hover:text-slate-900 hover:underline"
            >
              Noņemt frakcijas filtru
            </button>
          )}
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
              className="mt-3 rounded border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
            >
              Atiestatīt meklēšanu
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredMps.map((mp) => {
              const faction = factionMap.get(mp.factionId);
              const initials = getInitials(mp.name);

              return (
                <div
                  key={mp.id}
                  onClick={() => onSelectMp?.(mp)}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-col justify-between hover:border-slate-300 hover:shadow-xs transition group text-left cursor-default"
                >
                  <div className="flex items-start gap-3">
                    {/* Initials Avatar with faction colored indicator */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 text-white shadow-2xs"
                      style={{ backgroundColor: faction?.color || '#475569' }}
                    >
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-slate-800 transition line-clamp-1" title={mp.name}>
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
                      </div>
                    </div>
                  </div>

                  {/* Status & tags */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    {mp.isSubstitute ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium"
                        title={mp.replacesMpName ? `Aizvieto: ${mp.replacesMpName}` : 'Aizvietotājs (mīkstais mandāts)'}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Aizvietotājs
                      </span>
                    ) : !mp.isActive ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                        Nolicis mandātu
                      </span>
                    ) : (
                      <span className="text-slate-500">
                        {faction?.name || 'Frakcija'}
                      </span>
                    )}

                    <span className="text-slate-400 text-[9px] group-hover:text-slate-600 transition flex items-center gap-0.5">
                      Sēdvieta Nr. {mp.seatNumber}
                    </span>
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
