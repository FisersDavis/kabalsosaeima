import React, { useState, useRef, useEffect } from 'react';
import type { SaeimaTerm } from '../types';
import { Database, ChevronDown, Check, ExternalLink } from 'lucide-react';

interface NavbarProps {
  totalVotesCount: number;
  terms: SaeimaTerm[];
  selectedTerm: number;
  onSelectTerm: (term: number) => void;
  latestSittingDate?: string;
  onOpenInfoModal: (tab: 'about' | 'methodology' | 'data') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  totalVotesCount,
  terms,
  selectedTerm,
  onSelectTerm,
  latestSittingDate,
  onOpenInfoModal,
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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-2.5 px-4 py-3 sm:px-6 lg:px-8">
        {/* Main Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand + Term Selector */}
          <div className="flex items-center gap-3">
            {/* Logo with proper breathing room (15% padding) */}
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-slate-900 text-white shadow-xs">
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 20a9 9 0 0 1 18 0" />
                <path d="M7 20a5 5 0 0 1 10 0" />
                <circle cx="12" cy="11" r="1.5" fill="currentColor" />
              </svg>
            </div>

            {/* Authoritative Title & Term Badge */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                Kā Balso Saeima
              </span>

              {/* Term Selector Dropdown with enriched dates directly */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 transition shadow-2xs"
                  title="Izvēlēties Saeimas sasaukumu"
                >
                  {currentTermObj?.isActive ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-2xs" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-slate-400" />
                  )}
                  <span>{currentTermObj?.label} ({currentTermObj?.years})</span>
                  <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-slate-300 bg-white p-1.5 shadow-xl z-50 text-xs">
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
                          className={`flex w-full items-start justify-between rounded-lg p-2 text-left transition ${
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
          </div>

          {/* Right Provenance & Civic Links */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-600">
            {/* Provenance strip with tabular numbers */}
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
              <span className="hidden md:inline text-slate-400">
                Atjaunots: <strong className="text-slate-700 font-medium">{latestSittingDate || '25.09.2026'}</strong>
              </span>
              <span className="hidden md:inline text-slate-300">·</span>
              <div className="flex items-center gap-1">
                <Database className="h-3 w-3 text-slate-400" />
                <span className="tabular-nums font-mono font-bold text-slate-900">{totalVotesCount}</span>
                <span className="text-slate-500">balsojumi</span>
              </div>
              <span className="text-slate-300">·</span>
              <a
                href="https://www.saeima.lv/lv/likumdosana/balsojumi"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium text-slate-700 hover:text-slate-900 hover:underline"
                title="Pārbaudīt Saeimas oficiālos protokolus"
              >
                <span>saeima.lv</span>
                <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
              </a>
            </div>

            {/* Institutional Meta-Navigation */}
            <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
              <button
                type="button"
                onClick={() => onOpenInfoModal('about')}
                className="rounded px-2 py-1 text-slate-600 hover:text-slate-900 hover:underline font-medium transition"
              >
                Par projektu
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => onOpenInfoModal('methodology')}
                className="rounded px-2 py-1 text-slate-600 hover:text-slate-900 hover:underline font-medium transition"
              >
                Metodoloģija
              </button>
              <span className="hidden sm:inline text-slate-300">·</span>
              <button
                type="button"
                onClick={() => onOpenInfoModal('data')}
                className="hidden sm:inline-block rounded px-2 py-1 text-slate-600 hover:text-slate-900 hover:underline font-medium transition"
              >
                Kods un dati
              </button>
            </div>
          </div>
        </div>

        {/* Subtitle / Civic Mission */}
        <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-1.5">
          <span>Objektīvi dati par katru balsojumu Saeimā · Atvērtā parlamenta reģistrs</span>
        </div>
      </div>
    </header>
  );
};
