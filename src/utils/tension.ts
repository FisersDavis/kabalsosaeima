import type { Vote } from '../types';

/**
 * Determines whether an individual vote was tense / contentious:
 * - Tight margin: |Par - (Pret + Atturas)| <= 5 (with active participation >= 20)
 * - Or low unity: par / (par + pret + atturas) < 0.75
 */
export function isVoteTense(vote: Vote): boolean {
  const par = vote.counts.par || 0;
  const pret = vote.counts.pret || 0;
  const atturas = vote.counts.atturas || 0;
  const active = par + pret + atturas;
  if (active < 20) return false;

  const margin = Math.abs(par - (pret + atturas));
  if (margin <= 5) return true;

  const unity = par / active;
  if (unity < 0.75) return true;

  return false;
}

/**
 * Counts the number of tense votes in a collection of votes.
 */
export function countTenseVotes(votes: Vote[]): number {
  return votes.filter(isVoteTense).length;
}
