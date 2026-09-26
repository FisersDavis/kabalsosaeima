import React from 'react';
import {
  Shield,
  Coins,
  Scale,
  Zap,
  HeartHandshake,
  Building2,
} from 'lucide-react';

export interface CivicDomainConfig {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  badgeBg: string;
  borderHover?: string;
}

export const CIVIC_DOMAINS: CivicDomainConfig[] = [
  {
    id: 'drosiba',
    title: 'Valsts drošība un aizsardzība',
    shortTitle: 'Drošība',
    description: 'Nacionālie bruņotie spēki, robežapsardzība, NATO integrācija un civilā aizsardzība.',
    icon: Shield,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-700',
    badgeBg: 'bg-blue-100 text-blue-800',
    borderHover: 'hover:border-blue-400',
  },
  {
    id: 'budzets',
    title: 'Budžets un nodokļi',
    shortTitle: 'Budžets',
    description: 'Valsts ikgadējais budžets, nodokļu likmes, fiskālā disciplīna un valsts kases uzraudzība.',
    icon: Coins,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
    badgeBg: 'bg-amber-100 text-amber-800',
    borderHover: 'hover:border-amber-400',
  },
  {
    id: 'tiesiskums',
    title: 'Tiesiskums un korupcijas novēršana',
    shortTitle: 'Tiesiskums',
    description: 'Satversmes grozījumi, tiesu reformas, KNAB uzraudzība un administratīvā atbildība.',
    icon: Scale,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-700',
    badgeBg: 'bg-purple-100 text-purple-800',
    borderHover: 'hover:border-purple-400',
  },
  {
    id: 'ekonomika',
    title: 'Ekonomika un enerģētika',
    shortTitle: 'Ekonomika',
    description: 'Enerģētiskā neatkarība, elektroenerģijas tirgus, infrastruktūra un lauksaimniecība.',
    icon: Zap,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    badgeBg: 'bg-emerald-100 text-emerald-800',
    borderHover: 'hover:border-emerald-400',
  },
  {
    id: 'socialie',
    title: 'Veselība un labklājība',
    shortTitle: 'Labklājība',
    description: 'Veselības aprūpes finansējums, pensiju indeksācija, sociālie pabalsti un izglītība.',
    icon: HeartHandshake,
    iconBg: 'bg-rose-50',
    iconColor: 'text-rose-700',
    badgeBg: 'bg-rose-100 text-rose-800',
    borderHover: 'hover:border-rose-400',
  },
  {
    id: 'administracija',
    title: 'Valsts pārvalde',
    shortTitle: 'Pārvalde',
    description: 'Pašvaldību pārraudzība, Saeimas kārtības rullis, vēlēšanu procedūras un atvērtība.',
    icon: Building2,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    badgeBg: 'bg-slate-200 text-slate-800',
    borderHover: 'hover:border-slate-400',
  },
];

export const INSTITUTIONAL_ORDER = ['JV', 'ZZS', 'AS', 'NA', 'PRO', 'LPV', 'S!', 'PIEFR'];

export interface FrictionBadgeInfo {
  status: 'HIGH_CONSENSUS' | 'MODERATE_FRICTION' | 'HIGH_TENSION';
  label: string;
  dotColor: string;
  badgeClass: string;
}

export function getFrictionBadge(consensusPct: number, tightVotesCount: number): FrictionBadgeInfo {
  if (consensusPct > 85) {
    return {
      status: 'HIGH_CONSENSUS',
      label: 'Augsta vienprātība',
      dotColor: 'bg-emerald-500',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }
  if (consensusPct >= 70 && tightVotesCount < 3) {
    return {
      status: 'MODERATE_FRICTION',
      label: 'Mērena berze',
      dotColor: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }
  return {
    status: 'HIGH_TENSION',
    label: 'Augsta spriedze',
    dotColor: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  };
}
