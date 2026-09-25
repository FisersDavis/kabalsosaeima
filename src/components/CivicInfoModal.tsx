import React, { useState } from 'react';
import { X, ShieldCheck, Scale, Database, BookOpen, ExternalLink, GitBranch } from 'lucide-react';

interface CivicInfoModalProps {
  initialTab?: 'about' | 'methodology' | 'data';
  onClose: () => void;
}

export const CivicInfoModal: React.FC<CivicInfoModalProps> = ({
  initialTab = 'about',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'about' | 'methodology' | 'data'>(initialTab);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Kā Balso Saeima</h2>
              <p className="text-xs text-slate-500">Pilsoniskās atbildības un atvērtā parlamenta reģistrs</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'about'
                ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Par projektu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('methodology')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'methodology'
                ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Metodoloģija
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
              activeTab === 'data'
                ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            Kods un atvērtie dati
          </button>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto px-6 py-5 text-xs text-slate-700 leading-relaxed space-y-4">
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Mērķis un neatkarība</h3>
                <p>
                  <strong>„Kā Balso Saeima”</strong> ir neatkarīgs pilsonisko tehnoloģiju projekts, kas veidots ar mērķi nodrošināt Latvijas sabiedrībai tūlītēju, nepastarpinātu un objektīvu piekļuvi Saeimas balsojumu rezultātiem.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                <h4 className="font-bold text-slate-900">Trīs galvenie principi:</h4>
                <ul className="list-disc pl-4 space-y-1.5 text-slate-600">
                  <li>
                    <strong>100% Neitralitāte un bez redakcionālas atlases:</strong> Netiek izmests neviens balsojums. Dati netiek mākslīgi dalīti „svarīgos” un „nesvarīgos” — lietotājs pats izvēlas skatīt visus balsojumus vai filtrēt pēc likumu pieņemšanas, priekšlikumiem un procedūras.
                  </li>
                  <li>
                    <strong>Patiesa frakciju atbildība:</strong> Frakciju bloki ir sakārtoti fiksētā formātā pēc vietu skaita bez mākslīgām interpretācijām par to, kas šodien ir koalīcijā vai opozīcijā.
                  </li>
                  <li>
                    <strong>Atklātība parlamentārajās taktikās:</strong> Atmaskota kvoruma noraušana (*Nebalsoja* taktika) un frakcijas disciplīnas pārkāpumi.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'methodology' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Satversmes 24. pants un kvoruma aprēķins</h3>
                <p>
                  Saskaņā ar Latvijas Republikas Satversmes 24. pantu Saeima var lemt, ja sēdē piedalās <strong>vismaz puse deputātu (50 deputāti)</strong>. Likums vai lēmums tiek pieņemts ar klātesošo balsu absolūto vairākumu:
                </p>
                <div className="mt-2 rounded-lg bg-slate-100 p-2.5 font-mono text-[11px] text-slate-800">
                  Pieņemts = Par &gt; (Pret + Atturas), pie nosacījuma: (Par + Pret + Atturas) ≥ 50
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Kvoruma noraušanas taktika („Nebalsoja”)</h4>
                <p>
                  Parlamentārajā praksē deputāti mēdz reģistrēties sēžu zālē, bet balsošanas brīdī nenospiež nevienu pogu. Tādējādi viņi netiek ieskaitīti kvorumā. Ja zālē balso mazāk par 50 deputātiem, balsojums tiek pasludināts par nenotikušu kvoruma trūkuma dēļ (*NAV KVORUMA*). Šī platforma skaidri fiksē un uzrāda <em>Nb</em> (Nebalsoja) rādītāju katrai frakcijai.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-1">Frakcijas disciplīnas novirzes</h4>
                <p>
                  Katrai frakcijai tiek aprēķināts vairākuma lēmums (Par, Pret vai Atturas). Ja kāds deputāts nobalso atšķirīgi no savas frakcijas vairākuma, viņa vārds tiek īpaši izcelts kā frakcijas disciplīnas novirze.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">Datu izcelsme un atvērtība</h3>
                <p>
                  Visi balsojumu dati tiek iegūti tieši no Latvijas atvērto datu portāla un Saeimas oficiālajiem serveriem:
                </p>
              </div>

              <div className="space-y-2">
                <a
                  href="https://data.gov.lv/dati/lv/dataset/saeimas-sedes"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition"
                >
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>data.gov.lv · Saeimas sēžu atvērtie dati</span>
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </div>
                    <div className="text-[11px] text-slate-500">CKAN API pakotne ar sēžu darba kārtībām un mašīnlasāmiem balsojumu XML</div>
                  </div>
                </a>

                <a
                  href="https://www.saeima.lv/lv/likumdosana/balsojumi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition"
                >
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>saeima.lv · Oficiālie balsojumu protokoli</span>
                      <ExternalLink className="h-3 w-3 text-slate-400" />
                    </div>
                    <div className="text-[11px] text-slate-500">Latvijas Republikas Saeimas oficiālais stenogrammu un protokolu arhīvs</div>
                  </div>
                </a>

                <a
                  href="https://github.com/FisersDavis/kabalsosaeima"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition"
                >
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Atvērtais pirmkods (GitHub)</span>
                      <GitBranch className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div className="text-[11px] text-slate-500">Pilns vietnes pirmkods, sinhronizācijas skripti un pārbaudes algoritmi</div>
                  </div>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 rounded-b-2xl text-[11px] text-slate-500">
          <span>Licence: Atvērts sabiedrībai · CC BY 4.0</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-1.5 font-semibold text-white hover:bg-slate-800 transition"
          >
            Aizvērt
          </button>
        </div>
      </div>
    </div>
  );
};
