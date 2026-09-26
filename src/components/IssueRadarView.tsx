import React from 'react';
import type { Vote } from '../types';
import {
  Shield,
  Coins,
  Scale,
  Zap,
  HeartHandshake,
  Building2,
  ArrowRight,
  Info
} from 'lucide-react';

interface IssueRadarViewProps {
  votes: Vote[];
  onSelectCategory: (categoryId: string) => void;
}

interface CivicDomainConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  borderColor: string;
}

const CIVIC_DOMAINS: CivicDomainConfig[] = [
  {
    id: 'drosiba',
    title: 'Valsts drošība & Aizsardzība',
    description: 'Nacionālie bruņotie spēki, robežapsardzība, NATO integrācija, iekšlietu dienesti un civilā aizsardzība.',
    icon: Shield,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-700',
    borderColor: 'hover:border-blue-300',
  },
  {
    id: 'budzets',
    title: 'Budžets & Nodokļi',
    description: 'Valsts ikgadējais budžets, nodokļu un nodevu likmes, fiskālā disciplīna un valsts kases uzraudzība.',
    icon: Coins,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
    borderColor: 'hover:border-amber-300',
  },
  {
    id: 'tiesiskums',
    title: 'Tiesiskums & Korupcijas novēršana',
    description: 'Satversmes grozījumi, tiesu reformas, KNAB uzraudzība, administratīvā atbildība un cilvēktiesības.',
    icon: Scale,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-700',
    borderColor: 'hover:border-purple-300',
  },
  {
    id: 'ekonomika',
    title: 'Ekonomika & Enerģētika',
    description: 'Enerģētiskā neatkarība, elektroenerģijas tirgus, infrastruktūra, lauksaimniecība un tirdzniecība.',
    icon: Zap,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    borderColor: 'hover:border-emerald-300',
  },
  {
    id: 'socialie',
    title: 'Veselība & Labklājība',
    description: 'Veselības aprūpes finansējums, pensiju indeksācija, sociālie pabalsti un izglītības sistēmas reformas.',
    icon: HeartHandshake,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-700',
    borderColor: 'hover:border-rose-300',
  },
  {
    id: 'administracija',
    title: 'Valsts pārvalde',
    description: 'Pašvaldību pārraudzība, Saeimas kārtības rullis, vēlēšanu procedūras un publiskā sektora atvērtība.',
    icon: Building2,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    borderColor: 'hover:border-slate-400',
  },
];

export const IssueRadarView: React.FC<IssueRadarViewProps> = ({
  votes,
  onSelectCategory,
}) => {
  // Aggregate stats per domain
  const domainStats = React.useMemo(() => {
    const stats = new Map<string, { total: number; passed: number; rejected: number; noQuorum: number }>();

    CIVIC_DOMAINS.forEach((d) => {
      stats.set(d.id, { total: 0, passed: 0, rejected: 0, noQuorum: 0 });
    });

    votes.forEach((v) => {
      const catId = v.category?.id;
      if (catId && stats.has(catId)) {
        const item = stats.get(catId)!;
        item.total += 1;
        if (v.result === 'PIENEMTS') item.passed += 1;
        else if (v.result === 'NORAIDITS') item.rejected += 1;
        else if (v.result === 'NAV_KVORUMA') item.noQuorum += 1;
      }
    });

    return stats;
  }, [votes]);

  return (
    <div className="space-y-4">
      {/* Intro Banner */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Tematiskais balsojumu radars</h2>
          <p className="text-xs text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
            Objektīvs parlamenta lēmumu pārskats 6 nozīmīgākajos valsts politikas virzienos. Izvēlieties tēmu, lai atvērtu visus konkrētās jomas balsojumus un deputātu lēmumus.
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-mono font-bold text-slate-900">{votes.length} balsojumi</div>
          <div className="text-[10px] text-slate-500">6 tematiskie virzieni</div>
        </div>
      </section>

      {/* 6 Domains Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {CIVIC_DOMAINS.map((domain) => {
          const stats = domainStats.get(domain.id) || { total: 0, passed: 0, rejected: 0, noQuorum: 0 };
          const IconComponent = domain.icon;
          const passedPct = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
          const rejectedPct = stats.total > 0 ? Math.round((stats.rejected / stats.total) * 100) : 0;

          return (
            <div
              key={domain.id}
              className={`rounded-xl border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between transition group hover:shadow-xs ${domain.borderColor}`}
            >
              <div>
                {/* Header with Icon & Counts */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className={`p-2 rounded-lg ${domain.iconBg} ${domain.iconColor} flex-shrink-0`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold font-mono text-slate-900">{stats.total}</span>
                    <span className="block text-[10px] text-slate-500 font-medium">balsojumi</span>
                  </div>
                </div>

                {/* Title & Description */}
                <h3 className="text-xs font-bold text-slate-900 leading-snug group-hover:text-slate-800 transition">
                  {domain.title}
                </h3>
                <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                  {domain.description}
                </p>

                {/* Outcome Stats & Breakdown Bar */}
                {stats.total > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1 font-mono">
                      <span>Pieņemti: <strong className="text-emerald-700">{stats.passed}</strong> ({passedPct}%)</span>
                      <span>Noraidīti: <strong className="text-rose-700">{stats.rejected}</strong> ({rejectedPct}%)</span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${passedPct}%` }}
                        title={`Pieņemti: ${stats.passed}`}
                      />
                      <div
                        className="bg-rose-500 h-full"
                        style={{ width: `${rejectedPct}%` }}
                        title={`Noraidīti: ${stats.rejected}`}
                      />
                      {stats.noQuorum > 0 && (
                        <div
                          className="bg-amber-400 h-full"
                          style={{ width: `${Math.round((stats.noQuorum / stats.total) * 100)}%` }}
                          title={`Nav kvoruma: ${stats.noQuorum}`}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectCategory(domain.id)}
                  className="w-full inline-flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 text-xs font-semibold hover:bg-slate-900 hover:text-white hover:border-slate-900 transition cursor-pointer"
                >
                  <span>Skatīt visus balsojumus</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanatory footer */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-start gap-3 text-xs text-slate-600">
        <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-800">Par tēmu klasifikāciju:</strong> Katrs Saeimas likumprojekts un lēmums tiek kategorizēts atbilstoši atbildīgajai Saeimas komisijai un likuma saturam, balstoties uz Saeimas atvērtajiem metadatiem.
        </div>
      </div>
    </div>
  );
};
