import React, { useState, useRef, useEffect } from 'react';
import type { SaeimaTerm } from '../types';
import { Sun, Moon, Database, ShieldCheck, ChevronDown, Check } from 'lucide-react';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  totalVotesCount: number;
  terms: SaeimaTerm[];
  selectedTerm: number;
  onSelectTerm: (term: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  onToggleDarkMode,
  totalVotesCount,
  terms,
  selectedTerm,
  onSelectTerm,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentTermObj = terms.find((t) => t.term === selectedTerm) || terms[0];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90 transition-colors">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand & Term Selector */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-sm ring-1 ring-emerald-600/30">
            {/* Saeima hemicycle icon */}
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20ba9 9 0 0 1 18 0" />
              <path d="M7 20a5 5 0 0 1 10 0" />
              <circle cx="12" cy="11" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                kābalso<span className="text-emerald-500">saeima</span><span className="text-slate-400 font-mono text-sm font-normal">.lv</span>
              </span>

              {/* Term Selector Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition"
                  title="Izvēlēties Saeimas sasaukumu"
                >
                  {currentTermObj?.isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                  <span>{currentTermObj?.label || `${selectedTerm}. Saeima`}</span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 text-xs">
                    <div className="px-3 py-1.5 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                      Saeimas sasaukumi:
                    </div>
                    {terms.map((t) => {
                      const isSelected = t.term === selectedTerm;
                      return (
                        <button
                          key={t.term}
                          type="button"
                          onClick={() => {
                            onSelectTerm(t.term);
                            setIsDropdownOpen(false);
                          }}
                          className={`flex w-full items-start justify-between rounded-lg p-2 text-left transition ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-semibold">
                              <span>{t.label}</span>
                              {t.isActive ? (
                                <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[9px] text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  Aktuālā
                                </span>
                              ) : (
                                <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[9px] text-slate-500 dark:bg-slate-800">
                                  Nākamā
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {t.years} · {t.description}
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              Objektīvi dati par katru balsojumu Saeimā · Atvērts & Neitrāls
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5">
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 pr-3">
            <Database className="h-3.5 w-3.5 text-slate-400" />
            <span><strong className="font-mono text-slate-800 dark:text-slate-200">{totalVotesCount}</strong> balsojumi</span>
            <span>·</span>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>saeima.lv dati</span>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            title={darkMode ? "Ieslēgt gaišo motīvu" : "Ieslēgt tumšo motīvu"}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};
