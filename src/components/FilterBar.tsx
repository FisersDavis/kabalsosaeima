import React, { useState } from 'react';
import { Search, X, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';

export type VoteTypeFilter = 'ALL' | 'likums' | 'priekslikums' | 'procedura';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedVoteType: VoteTypeFilter;
  onVoteTypeChange: (type: VoteTypeFilter) => void;
  selectedOutcome: 'ALL' | 'PIENEMTS' | 'NORAIDITS' | 'NAV_KVORUMA';
  onOutcomeChange: (outcome: 'ALL' | 'PIENEMTS' | 'NORAIDITS' | 'NAV_KVORUMA') => void;
  categories: { id: string; label: string }[];
  tier1Only: boolean;
  onTier1Toggle: (val: boolean) => void;
  totalFiltered: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedVoteType,
  onVoteTypeChange,
  selectedOutcome,
  onOutcomeChange,
  categories,
  tier1Only,
  onTier1Toggle,
  totalFiltered,
}) => {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const activeSecondaryFiltersCount =
    (selectedCategory !== 'ALL' ? 1 : 0) +
    (selectedVoteType !== 'ALL' ? 1 : 0) +
    (selectedOutcome !== 'ALL' ? 1 : 0);

  const isFiltered =
    searchQuery.trim() !== '' ||
    activeSecondaryFiltersCount > 0 ||
    tier1Only;

  const handleReset = () => {
    onSearchChange('');
    onCategoryChange('ALL');
    onVoteTypeChange('ALL');
    onOutcomeChange('ALL');
    onTier1Toggle(false);
  };

  return (
    <div className="space-y-2">
      {/* Row 1: Segmented Switch + Search Anchor + Mobile Filter Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* Segmented Mode Switch */}
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200 text-xs font-medium self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => onTier1Toggle(false)}
            className={`rounded-md px-3 py-1.5 transition cursor-pointer font-medium ${
              !tier1Only
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Visi balsojumi
          </button>
          <button
            type="button"
            onClick={() => onTier1Toggle(true)}
            className={`rounded-md px-3 py-1.5 transition cursor-pointer font-medium ${
              tier1Only
                ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Gala lēmumi <span className="hidden xs:inline text-[11px] opacity-80">(3. lasījums)</span>
          </button>
        </div>

        {/* Search Input + Mobile Filter Button */}
        <div className="flex items-center gap-2 flex-1 max-w-full sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Meklēt likumu vai atslēgvārdu..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-7 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Mobile Filter Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className={`md:hidden inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer whitespace-nowrap ${
              mobileDrawerOpen || activeSecondaryFiltersCount > 0
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filtri</span>
            {activeSecondaryFiltersCount > 0 && (
              <span className="ml-0.5 rounded-full bg-emerald-500 px-1.5 py-0.2 text-[10px] font-bold text-white leading-none">
                {activeSecondaryFiltersCount}
              </span>
            )}
          </button>

          {/* Inline Reset Button on desktop if filtered */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleReset}
              className="hidden md:inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition cursor-pointer whitespace-nowrap"
              title="Atiestatīt filtrus"
            >
              <RotateCcw className="h-3 w-3 text-slate-500" />
              <span>Notīrīt ({totalFiltered})</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2 (Desktop): Inline Secondary Filter Dropdowns */}
      <div className="hidden md:flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        {/* Vote Type Dropdown */}
        <div className="relative">
          <select
            value={selectedVoteType}
            onChange={(e) => onVoteTypeChange(e.target.value as VoteTypeFilter)}
            style={{ colorScheme: 'light' }}
            className={`appearance-none rounded-lg border py-1 pl-2.5 pr-7 text-xs font-medium focus:outline-none cursor-pointer transition ${
              selectedVoteType !== 'ALL'
                ? 'border-slate-900 bg-slate-100 text-slate-900 font-semibold ring-1 ring-slate-900/20 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <option value="ALL">Visi balsojumi</option>
            <option value="likums">Likumu pieņemšana</option>
            <option value="priekslikums">Priekšlikumi un grozījumi</option>
            <option value="procedura">Procedūra un darba kārtība</option>
          </select>
          <ChevronDown
            className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
              selectedVoteType !== 'ALL' ? 'text-slate-900' : 'text-slate-400'
            }`}
          />
        </div>

        {/* Topic / Category Dropdown */}
        <div className="relative">
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            style={{ colorScheme: 'light' }}
            className={`appearance-none rounded-lg border py-1 pl-2.5 pr-7 text-xs font-medium focus:outline-none cursor-pointer transition ${
              selectedCategory !== 'ALL'
                ? 'border-slate-900 bg-slate-100 text-slate-900 font-semibold ring-1 ring-slate-900/20 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <option value="ALL">Visi temati</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
              selectedCategory !== 'ALL' ? 'text-slate-900' : 'text-slate-400'
            }`}
          />
        </div>

        {/* Outcome Dropdown */}
        <div className="relative">
          <select
            value={selectedOutcome}
            onChange={(e) => onOutcomeChange(e.target.value as any)}
            style={{ colorScheme: 'light' }}
            className={`appearance-none rounded-lg border py-1 pl-2.5 pr-7 text-xs font-medium focus:outline-none cursor-pointer transition ${
              selectedOutcome !== 'ALL'
                ? 'border-slate-900 bg-slate-100 text-slate-900 font-semibold ring-1 ring-slate-900/20 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <option value="ALL">Visi rezultāti</option>
            <option value="PIENEMTS">Pieņemtie</option>
            <option value="NORAIDITS">Noraidītie</option>
            <option value="NAV_KVORUMA">Nav kvoruma</option>
          </select>
          <ChevronDown
            className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
              selectedOutcome !== 'ALL' ? 'text-slate-900' : 'text-slate-400'
            }`}
          />
        </div>

        <span className="text-[11px] text-slate-400 font-mono ml-auto">
          Atrasti {totalFiltered} {totalFiltered === 1 ? 'balsojums' : 'balsojumi'}
        </span>
      </div>

      {/* Row 2 (Mobile Drawer): Expandable Secondary Filters */}
      {mobileDrawerOpen && (
        <div className="md:hidden grid grid-cols-1 gap-2 pt-2 border-t border-slate-200 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Vote Type Dropdown */}
            <div className="relative">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Balsojuma veids
              </label>
              <select
                value={selectedVoteType}
                onChange={(e) => onVoteTypeChange(e.target.value as VoteTypeFilter)}
                style={{ colorScheme: 'light' }}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Visi balsojumi</option>
                <option value="likums">Likumu pieņemšana</option>
                <option value="priekslikums">Priekšlikumi un grozījumi</option>
                <option value="procedura">Procedūra un darba kārtība</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-7 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Topic / Category Dropdown */}
            <div className="relative">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Temats
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => onCategoryChange(e.target.value)}
                style={{ colorScheme: 'light' }}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Visi temati</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-7 h-3.5 w-3.5 text-slate-400" />
            </div>

            {/* Outcome Dropdown */}
            <div className="relative">
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Iznākums
              </label>
              <select
                value={selectedOutcome}
                onChange={(e) => onOutcomeChange(e.target.value as any)}
                style={{ colorScheme: 'light' }}
                className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="ALL">Visi rezultāti</option>
                <option value="PIENEMTS">Pieņemtie</option>
                <option value="NORAIDITS">Noraidītie</option>
                <option value="NAV_KVORUMA">Nav kvoruma</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-7 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* Action buttons inside mobile drawer */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 font-mono">
              Atrasti {totalFiltered}
            </span>
            {isFiltered && (
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition cursor-pointer"
              >
                <RotateCcw className="h-3 w-3 text-slate-500" />
                <span>Notīrīt visus filtrus</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
