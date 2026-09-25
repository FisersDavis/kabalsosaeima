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
}

export interface MPVoteRecord {
  mpId: string;
  name: string;
  factionId: string;
  decision: VoteDecision;
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
  sittingDate: string;
  sittingTime: string;
  sittingType: string;
  reading?: 1 | 2 | 3 | null;
  isUrgent?: boolean;
  isTier1: boolean; // True for final votes and high-impact policy decisions
  officialTitle: string;
  billNumber: string;
  simplifiedTitle: string;
  summary: string;
  category: {
    id: string;
    label: string;
  };
  result: 'PIENEMTS' | 'NORAIDITS';
  counts: {
    par: number;
    pret: number;
    atturas: number;
    nebalso: number;
    totalPresent: number;
  };
  factionBreakdown: FactionBreakdown[];
  mpVotes: MPVoteRecord[];
}
