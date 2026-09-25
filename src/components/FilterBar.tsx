import React from 'react';
import { Search, X, CheckCircle2, XCircle } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedOutcome: 'ALL' | 'PIENEMTS' | 'NORAIDITS';
  onOutcomeChange: (outcome: 'ALL' | 'PIENEMTS' | 'NORAIDITS') => void;
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
  selectedOutcome,
  onOutcomeChange,
  categories,
  tier1Only,
  onTier1Toggle,
  totalFiltered,
}) => {
  return (
    <div className="space-y-4">
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
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Outcome Toggle */}
        <div className="flex items-center gap-1 self-start sm:self-auto rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => onOutcomeChange('ALL')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              selectedOutcome === 'ALL'
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Visi
          </button>
          <button
            type="button"
            onClick={() => onOutcomeChange('PIENEMTS')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              selectedOutcome === 'PIENEMTS'
                ? 'bg-emerald-50 text-emerald-800 shadow-sm dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-emerald-500/30'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Pieņemtie
          </button>
          <button
            type="button"
            onClick={() => onOutcomeChange('NORAIDITS')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              selectedOutcome === 'NORAIDITS'
                ? 'bg-rose-50 text-rose-800 shadow-sm dark:bg-rose-950/60 dark:text-rose-300 ring-1 ring-rose-500/30'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <XCircle className="h-3 w-3 text-rose-500" />
            Noraidītie
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
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:border-slate-700'
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
                    ? 'bg-emerald-600 text-white shadow-sm dark:bg-emerald-500'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800 dark:hover:border-slate-700'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Significance Toggle & Counter */}
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={tier1Only}
              onChange={(e) => onTier1Toggle(e.target.checked)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <span className="font-medium">Tikai gala lēmumi</span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">(slēpj procedūru)</span>
          </label>

          <span className="font-mono text-slate-400 dark:text-slate-500">
            Atrasti: <strong className="text-slate-800 dark:text-slate-200">{totalFiltered}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
