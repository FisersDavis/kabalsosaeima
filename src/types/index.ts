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
  isCoalition: boolean;
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
}

export interface Vote {
  id: string;
  saeimaTerm: number;
  sessionId?: string; // e.g., "14-sede-48" (handles overnight/multi-day sittings)
  sessionDate: string; // Official sitting date
  sittingDate: string;
  sittingTime: string;
  sittingType: string;
  reading?: 1 | 2 | 3 | null;
  isUrgent?: boolean;
  isTier1: boolean; // True for final votes and high-impact policy decisions
  isSecret?: boolean; // Aizklāts balsojums (Satversme)
  isRevote?: boolean; // Pārbalsošana (pults kļūda vai procedūra)
  revoteReason?: string;
  officialTitle: string;
  billNumber: string;
  simplifiedTitle: string;
  summary: string;
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

// Constitutional helper to determine if a vote is the final decision on a law
export function isFinalDecisionVote(vote: Vote): boolean {
  // Urgent bills finish on 2nd reading (Satversme 75. p.)
  if (vote.isUrgent && vote.reading === 2) return true;
  // Standard bills finish on 3rd reading
  if (vote.reading === 3) return true;
  return vote.isTier1;
}

// Constitutional helper to check quorum (Satversme 24. p. - at least 50 MPs must cast Par/Pret/Atturas)
export function checkSaeimaQuorum(counts: { par: number; pret: number; atturas: number }): boolean {
  return (counts.par + counts.pret + counts.atturas) >= 50;
}
