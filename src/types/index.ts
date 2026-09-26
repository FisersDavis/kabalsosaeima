export type VoteDecision = 'PAR' | 'PRET' | 'ATTURAS' | 'NEBALSO' | 'NAV_REGISTRETS';
export type ActiveNavTab = 'votes' | 'mps' | 'issues';

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
  isActive?: boolean;
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

export interface MpAttendance {
  presentCount: number;
  presentPct: number;
  withheldCount: number;
  withheldPct: number;
  absentCount: number;
  absentPct: number;
}

export interface MpVotesBreakdown {
  par: number;
  pret: number;
  atturas: number;
  nebalso: number;
  navRegistrets: number;
}

export interface MpDeviation {
  voteId: string;
  title: string;
  sittingDate: string;
  decision: VoteDecision;
  factionLine: VoteDecision;
  result: string;
  category?: string;
  deviationType: 'OPPOSITE' | 'NUANCE';
  parentBillTitle?: string;
  readingStage?: string;
  voteType?: string;
  isAmendment?: boolean;
}

export interface MpCohesion {
  isIndependent: boolean;
  cohesionPct: number | null;
  activeTotalCount: number;
  activeAlignedCount: number;
  deviationsCount: number;
  oppositeCount: number;
  nuanceCount: number;
  deviations: MpDeviation[];
}

export interface MpVoteHistoryItem {
  voteId: string;
  title: string;
  sittingDate: string;
  decision: VoteDecision;
  result: string;
  category?: string;
  categoryId?: string;
  parentBillTitle?: string;
  readingStage?: string;
  voteType?: string;
  isAmendment?: boolean;
}

export interface MpDossier {
  mp: MP;
  faction: Faction;
  totalVotes: number;
  attendance: MpAttendance;
  votesBreakdown: MpVotesBreakdown;
  cohesion: MpCohesion;
  votingHistory: MpVoteHistoryItem[];
}

export interface MpSummary {
  presentPct: number;
  withheldPct: number;
  absentPct: number;
  cohesionPct: number | null;
  deviationsCount: number;
  oppositeCount?: number;
  nuanceCount?: number;
  isIndependent: boolean;
}

export type MpSummaryMap = Record<string, MpSummary>;

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
  voteType?: 'likums' | 'priekslikums' | 'procedura';
  readingStage?: string;
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

export interface SiteMetadata {
  lastSync?: string;
  formattedSyncDate?: string;
  totalVotes?: number;
  latestSittingDate?: string;
  saeimaTerm?: number;
  status?: string;
}

export function parseLatvianDate(dateStr?: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.trim().split('.');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day).getTime();
  }
  return 0;
}

export function normalizeLatvianSearch(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}


