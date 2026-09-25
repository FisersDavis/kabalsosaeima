import React from 'react';
import { Search, X, CheckCircle2, XCircle, AlertTriangle, Layers, FileText, SlidersHorizontal, Scale } from 'lucide-react';

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
  return (
    <div className="space-y-4">
      {/* Primary Vote Type Tabs (100% Objective Parliamentary Typology) */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => onVoteTypeChange('ALL')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            selectedVoteType === 'ALL'
              ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Visi balsojumi
        </button>

        <button
          type="button"
          onClick={() => onVoteTypeChange('likums')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            selectedVoteType === 'likums'
              ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-600'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Scale className="h-3.5 w-3.5 text-indigo-500 group-hover:text-indigo-600" />
          Likumu pieņemšana
        </button>

        <button
          type="button"
          onClick={() => onVoteTypeChange('priekslikums')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            selectedVoteType === 'priekslikums'
              ? 'bg-sky-600 text-white shadow-sm ring-1 ring-sky-600'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <FileText className="h-3.5 w-3.5 text-sky-500 group-hover:text-sky-600" />
          Priekšlikumi & labojumi
        </button>

        <button
          type="button"
          onClick={() => onVoteTypeChange('procedura')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
            selectedVoteType === 'procedura'
              ? 'bg-slate-700 text-white shadow-sm ring-1 ring-slate-700'
              : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
          Procedūra & darba kārtība
        </button>
      </div>
      {/* Search Bar + Result Type Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Meklēt pēc likuma nosaukuma, numura (piem. Nr. 482) vai atslēgvārda..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Outcome Toggle (with NAV_KVORUMA) */}
        <div className="flex flex-wrap items-center gap-1 self-start sm:self-auto rounded-lg border border-slate-200 bg-slate-100/80 p-1">
          <button
            type="button"
            onClick={() => onOutcomeChange('ALL')}
            className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              selectedOutcome === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Visi
          </button>
          <button
            type="button"
            onClick={() => onOutcomeChange('PIENEMTS')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              selectedOutcome === 'PIENEMTS'
                ? 'bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-500/30'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Pieņemtie
          </button>
          <button
            type="button"
            onClick={() => onOutcomeChange('NORAIDITS')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              selectedOutcome === 'NORAIDITS'
                ? 'bg-rose-50 text-rose-800 shadow-sm ring-1 ring-rose-500/30'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <XCircle className="h-3 w-3 text-rose-500" />
            Noraidītie
          </button>
          <button
            type="button"
            onClick={() => onOutcomeChange('NAV_KVORUMA')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              selectedOutcome === 'NAV_KVORUMA'
                ? 'bg-amber-50 text-amber-800 shadow-sm ring-1 ring-amber-500/30'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Nav kvoruma
          </button>
        </div>
      </div>

      {/* Categories & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onCategoryChange('ALL')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedCategory === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            Visi temati
          </button>

          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onCategoryChange(cat.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Significance Toggle & Counter */}
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
            <input
              type="checkbox"
              checked={tier1Only}
              onChange={(e) => onTier1Toggle(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="font-medium">Tikai gala lēmumi</span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">(3. lasījumi & steidzamie)</span>
          </label>

          <span className="font-mono text-slate-400">
            Atrasti: <strong className="text-slate-800">{totalFiltered}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
