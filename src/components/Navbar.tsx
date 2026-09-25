import React, { useState, useRef, useEffect } from 'react';
import type { SaeimaTerm } from '../types';
import { Database, ShieldCheck, ChevronDown, Check } from 'lucide-react';

interface NavbarProps {
  totalVotesCount: number;
  terms: SaeimaTerm[];
  selectedTerm: number;
  onSelectTerm: (term: number) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalVotesCount,
  terms,
  selectedTerm,
  onSelectTerm,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand & Term Selector */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-slate-900 text-white shadow-xs">
            {/* Saeima plenary room minimalist glyph */}
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 20a9 9 0 0 1 18 0" />
              <path d="M7 20a5 5 0 0 1 10 0" />
              <circle cx="12" cy="11" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-sans text-lg font-bold tracking-tight text-slate-900">
                kābalso<span className="font-extrabold">saeima</span><span className="text-slate-400 font-mono text-sm font-normal">.lv</span>
              </span>

              {/* Term Selector Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 transition"
                  title="Izvēlēties Saeimas sasaukumu"
                >
                  {currentTermObj?.isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  )}
                  <span>{currentTermObj?.label || `${selectedTerm}. Saeima`}</span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-lg border border-slate-300 bg-white p-1.5 shadow-lg z-50 text-xs">
                    <div className="px-3 py-1 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
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
                          className={`flex w-full items-start justify-between rounded p-2 text-left transition ${
                            isSelected
                              ? 'bg-slate-100 text-slate-900 font-semibold'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span>{t.label}</span>
                              {t.isActive ? (
                                <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-semibold text-emerald-800">
                                  Aktuālā
                                </span>
                              ) : (
                                <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] text-slate-500">
                                  Nākamā
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 font-normal">
                              {t.years} · {t.description}
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-slate-900 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <p className="hidden text-xs text-slate-500 sm:block">
              Objektīvi dati par katru balsojumu Saeimā · Atvērtā parlamenta reģistrs
            </p>
          </div>
        </div>

        {/* Right Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Database className="h-3.5 w-3.5 text-slate-400" />
            <span><strong className="font-mono text-slate-800">{totalVotesCount}</strong> balsojumi</span>
            <span>·</span>
            <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden sm:inline">saeima.lv protokoli</span>
          </div>
        </div>
      </div>
    </header>
  );
};
