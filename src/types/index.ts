export type VoteDecision = 'PAR' | 'PRET' | 'ATTURAS' | 'NEBALSO' | 'NAV_REGISTRETS';

export interface SaeimaTerm {
  term: number;
  label: string;
  years: string;
  isActive: boolean;
  description: string;
}

export interface Faction {
  id: string;
  name: string;
  shortName: string;
  color: string;
  seats: number;
}

export interface MP {
  id: string;
  name: string;
  factionId: string;
  seatNumber: number;
  row: number;
  col: number;
  isSubstitute?: boolean; // Mīkstais mandāts
  replacesMpName?: string; // e.g. "Aizvieto Eviku Siliņu"
}

export interface MPVoteRecord {
  mpId: string;
  name: string;
  factionId: string;
  decision: VoteDecision;
  isSubstitute?: boolean;
  replacesMpName?: string;
}

export interface DeviatingMP {
  mpId: string;
  name: string;
  decision: VoteDecision;
  factionLine: VoteDecision;
}

export interface FactionBreakdown {
  factionId: string;
  name: string;
  shortName: string;
  color: string;
  votes: {
    par: number;
    pret: number;
    atturas: number;
    nebalso: number;
  };
  deviatingMps?: DeviatingMP[];
}

export interface DebateArguments {
  proponents: string; // Sponsor / Rapporteur perspective
  opponents: string;  // Lead opposition debate thesis
  rapporteur?: string; // Ziņotājs / Atbildīgā komisija
}

export interface Vote {
  id: string;
  saeimaTerm: number;
  sessionId?: string;
  sessionDate: string;
  sittingDate: string;
  sittingTime: string;
  sittingType: string;
  reading?: 1 | 2 | 3 | null;
  isUrgent?: boolean;
  isTier1: boolean;
  isSecret?: boolean;
  isRevote?: boolean;
  revoteReason?: string;
  officialTitle: string;
  billNumber: string;
  simplifiedTitle: string;
  summary: string;
  debateArguments?: DebateArguments;
  protocolUrl?: string;
  category: {
    id: string;
    label: string;
  };
  result: 'PIENEMTS' | 'NORAIDITS' | 'NAV_KVORUMA';
  counts: {
    par: number;
    pret: number;
    atturas: number;
    nebalso: number;
    totalPresent: number; // par + pret + atturas
  };
  factionBreakdown: FactionBreakdown[];
  mpVotes: MPVoteRecord[];
}

export function isFinalDecisionVote(vote: Vote): boolean {
  if (vote.isUrgent && vote.reading === 2) return true;
  if (vote.reading === 3) return true;
  return vote.isTier1;
}

export function checkSaeimaQuorum(counts: { par: number; pret: number; atturas: number }): boolean {
  return (counts.par + counts.pret + counts.atturas) >= 50;
}
