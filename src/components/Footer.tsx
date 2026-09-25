import React from 'react';
import { ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white/50 py-10 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md space-y-2">
            <span className="font-sans text-base font-bold tracking-tight text-slate-900 dark:text-white">
              kābalso<span className="text-emerald-500">saeima</span><span className="text-slate-400 font-mono text-sm font-normal">.lv</span>
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Neitrāls un atvērts Latvijas Republikas Saeimas balsojumu un lēmumu pārlūks.
              Mērķis ir sniegt skaidru, faktos balstītu informāciju ikvienam pilsonim un vēlētājam.
            </p>
          </div>

          <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
            <div className="font-semibold text-slate-900 dark:text-slate-200">Oficiālie datu avoti:</div>
            <ul className="space-y-1">
              <li>
                <a
                  href="https://www.saeima.lv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400"
                >
                  <span>Saeimas sēžu stenogrammas un protokoli (saeima.lv)</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://data.gov.lv"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-emerald-600 dark:hover:text-emerald-400"
                >
                  <span>Latvijas Atvērto datu portāls (data.gov.lv)</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Civic transparency note */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-[11px] text-slate-500 dark:border-slate-800/80 dark:bg-slate-900/60 leading-relaxed">
          <strong className="text-slate-700 dark:text-slate-300">Metodoloģiskā piezīme:</strong> Saeimas procedūrā statusā <em>Nebalsoja</em> tiek iekļauti deputāti, kuri ir reģistrējušies sēžu zālē, bet nav nospieduši nevienu no balsošanas pogām (bieži izmantota taktika kvoruma noraušanai), kā arī deputāti, kuri balsojuma brīdī nebija klātesoši. Visi dati tiek atjaunoti automātiski pēc katras kārtējās ceturtdienas sēdes.
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} kābalsosaeima.lv · Zero-Maintenance Civic Tech</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              Veidots sabiedrības informēšanai un atklātībai
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
