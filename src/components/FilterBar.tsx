import React from 'react';
import { Search, X, ChevronDown, RotateCcw } from 'lucide-react';

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
  const isFiltered =
    searchQuery.trim() !== '' ||
    selectedCategory !== 'ALL' ||
    selectedVoteType !== 'ALL' ||
    selectedOutcome !== 'ALL' ||
    tier1Only;

  const handleReset = () => {
    onSearchChange('');
    onCategoryChange('ALL');
    onVoteTypeChange('ALL');
    onOutcomeChange('ALL');
    onTier1Toggle(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 1. Anchor with Search */}
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Meklēt likumu vai atslēgvārdu..."
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 2. Vote Type Dropdown */}
      <div className="relative">
        <select
          value={selectedVoteType}
          onChange={(e) => onVoteTypeChange(e.target.value as VoteTypeFilter)}
          className={`appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-xs font-medium focus:outline-none cursor-pointer transition ${
            selectedVoteType !== 'ALL'
              ? 'border-slate-800 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          }`}
        >
          <option value="ALL" className="bg-white text-slate-900">Visi balsojumi</option>
          <option value="likums" className="bg-white text-slate-900">Likumu pieņemšana</option>
          <option value="priekslikums" className="bg-white text-slate-900">Priekšlikumi & labojumi</option>
          <option value="procedura" className="bg-white text-slate-900">Procedūra & darba kārtība</option>
        </select>
        <ChevronDown
          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
            selectedVoteType !== 'ALL' ? 'text-slate-300' : 'text-slate-400'
          }`}
        />
      </div>

      {/* 3. Topic / Category Dropdown */}
      <div className="relative">
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={`appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-xs font-medium focus:outline-none cursor-pointer transition ${
            selectedCategory !== 'ALL'
              ? 'border-slate-800 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          }`}
        >
          <option value="ALL" className="bg-white text-slate-900">Visi temati</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id} className="bg-white text-slate-900">
              {c.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
            selectedCategory !== 'ALL' ? 'text-slate-300' : 'text-slate-400'
          }`}
        />
      </div>

      {/* 4. Outcome Dropdown */}
      <div className="relative">
        <select
          value={selectedOutcome}
          onChange={(e) => onOutcomeChange(e.target.value as any)}
          className={`appearance-none rounded-lg border py-1.5 pl-3 pr-7 text-xs font-medium focus:outline-none cursor-pointer transition ${
            selectedOutcome !== 'ALL'
              ? 'border-slate-800 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
          }`}
        >
          <option value="ALL" className="bg-white text-slate-900">Visi rezultāti</option>
          <option value="PIENEMTS" className="bg-white text-slate-900">Pieņemtie</option>
          <option value="NORAIDITS" className="bg-white text-slate-900">Noraidītie</option>
          <option value="NAV_KVORUMA" className="bg-white text-slate-900">Nav kvoruma</option>
        </select>
        <ChevronDown
          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
            selectedOutcome !== 'ALL' ? 'text-slate-300' : 'text-slate-400'
          }`}
        />
      </div>

      {/* 5. Quick Toggle: Tikai galīgie lēmumi */}
      <button
        type="button"
        onClick={() => onTier1Toggle(!tier1Only)}
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
          tier1Only
            ? 'border-slate-900 bg-slate-900 text-white shadow-2xs'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        Tikai gala lēmumi
      </button>

      {/* 6. Active Filter Reset */}
      {isFiltered && (
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200 transition"
          title="Atiestatīt filtrus"
        >
          <RotateCcw className="h-3 w-3 text-slate-500" />
          <span>Notīrīt ({totalFiltered})</span>
        </button>
      )}
    </div>
  );
};
