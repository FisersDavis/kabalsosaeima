package stats

import (
	"github.com/FisersDavis/kabalsosaeima/internal/data"
)

// DeviationType categorizes how an MP differed from the faction majority.
type DeviationType string

const (
	DeviationOpposite DeviationType = "OPPOSITE" // e.g., MP voted PAR while faction majority voted PRET/ATTURAS (or vice versa)
	DeviationNuance   DeviationType = "NUANCE"   // e.g., MP voted ATTURAS while faction majority voted PRET (or vice versa)
)

// VoteDeviation records a vote where the MP voted against their faction majority line.
type VoteDeviation struct {
	VoteID        string        `json:"voteId"`
	SittingDate   string        `json:"sittingDate"`
	Decision      string        `json:"decision"`
	FactionLine   string        `json:"factionLine"`
	DeviationType DeviationType `json:"deviationType"`
}

// CohesionStats holds faction discipline and deviation metrics.
type CohesionStats struct {
	IsIndependent      bool            `json:"isIndependent"`
	CohesionPct        *float64        `json:"cohesionPct"` // nil if independent or 0 active votes
	ActiveTotalCount   int             `json:"activeTotalCount"`
	ActiveAlignedCount int             `json:"activeAlignedCount"`
	DeviationsCount    int             `json:"deviationsCount"`
	OppositeCount      int             `json:"oppositeCount"`
	NuanceCount        int             `json:"nuanceCount"`
	Deviations         []VoteDeviation `json:"deviations"`
}

// ComputeVoteFactionMajority determines the majority active vote decision ("PAR", "PRET", "ATTURAS")
// for each faction on a given vote. Returns map: factionID -> majority decision.
// If the vote has factionBreakdown, it uses that; otherwise it aggregates from rollcall records.
func ComputeVoteFactionMajority(v *data.Vote, rollcalls []data.RollcallRecord) map[string]string {
	majority := make(map[string]string)

	if len(v.FactionBreakdown) > 0 {
		for _, fb := range v.FactionBreakdown {
			par := fb.Votes.Par
			pret := fb.Votes.Pret
			att := fb.Votes.Atturas

			best := ""
			bestCount := 0

			// Faction majority order: PAR, PRET, ATTURAS
			if par > bestCount {
				best = "PAR"
				bestCount = par
			}
			if pret > bestCount {
				best = "PRET"
				bestCount = pret
			}
			if att > bestCount {
				best = "ATTURAS"
				bestCount = att
			}

			if bestCount > 0 {
				majority[fb.FactionID] = best
			}
		}
		return majority
	}

	// Fallback to rollcall aggregation if FactionBreakdown not present on vote
	counts := make(map[string]map[string]int)
	for _, rec := range rollcalls {
		if rec.FactionID == "" || rec.FactionID == "ind" {
			continue
		}
		if _, ok := counts[rec.FactionID]; !ok {
			counts[rec.FactionID] = make(map[string]int)
		}
		if rec.Decision == "PAR" || rec.Decision == "PRET" || rec.Decision == "ATTURAS" {
			counts[rec.FactionID][rec.Decision]++
		}
	}

	for fid, decs := range counts {
		par := decs["PAR"]
		pret := decs["PRET"]
		att := decs["ATTURAS"]

		best := ""
		bestCount := 0
		if par > bestCount {
			best = "PAR"
			bestCount = par
		}
		if pret > bestCount {
			best = "PRET"
			bestCount = pret
		}
		if att > bestCount {
			best = "ATTURAS"
			bestCount = att
		}
		if bestCount > 0 {
			majority[fid] = best
		}
	}

	return majority
}

// ComputeStoreFactionLines precomputes majority decision lines for all votes:
// voteID -> factionID -> majority decision ("PAR"|"PRET"|"ATTURAS").
func ComputeStoreFactionLines(store *data.Store) map[string]map[string]string {
	res := make(map[string]map[string]string, len(store.Votes))
	for i := range store.Votes {
		v := &store.Votes[i]
		res[v.ID] = ComputeVoteFactionMajority(v, store.Rollcalls[v.ID])
	}
	return res
}

// ComputeMPCohesion computes cohesion using the MP's historical faction from the rollcall for each vote.
// For votes where the MP was independent ("ind") or had no faction, cohesion is skipped.
// If the MP is permanently independent (no faction membership in any vote), IsIndependent is true and CohesionPct is nil.
func ComputeMPCohesion(store *data.Store, mpID string, voteFactionLines map[string]map[string]string) CohesionStats {
	mp := store.MPByID[mpID]
	if voteFactionLines == nil {
		voteFactionLines = ComputeStoreFactionLines(store)
	}

	var stats CohesionStats
	hasAnyFactionVote := false

	for _, vote := range store.Votes {
		// MP's vote in this rollcall
		voteMap, ok := store.RollcallByVoteAndMP[vote.ID]
		if !ok {
			continue
		}
		rec, found := voteMap[mpID]
		if !found {
			continue
		}

		// Historical faction comes from the rollcall record!
		currentFaction := rec.FactionID
		if currentFaction == "" && mp != nil {
			currentFaction = mp.FactionID
		}

		if currentFaction == "" || currentFaction == "ind" {
			continue
		}

		hasAnyFactionVote = true

		// Check active participation: PAR, PRET, ATTURAS
		decision := rec.Decision
		if decision != "PAR" && decision != "PRET" && decision != "ATTURAS" {
			continue
		}

		factionLines, hasVote := voteFactionLines[vote.ID]
		if !hasVote {
			continue
		}
		factionLine, hasLine := factionLines[currentFaction]
		if !hasLine || factionLine == "" {
			continue
		}

		stats.ActiveTotalCount++
		if decision == factionLine {
			stats.ActiveAlignedCount++
		} else {
			isOpposite := (decision == "PAR" && (factionLine == "PRET" || factionLine == "ATTURAS")) ||
				(factionLine == "PAR" && (decision == "PRET" || decision == "ATTURAS"))

			devType := DeviationNuance
			if isOpposite {
				devType = DeviationOpposite
				stats.OppositeCount++
			} else {
				stats.NuanceCount++
			}

			stats.Deviations = append(stats.Deviations, VoteDeviation{
				VoteID:        vote.ID,
				SittingDate:   vote.SittingDate,
				Decision:      decision,
				FactionLine:   factionLine,
				DeviationType: devType,
			})
		}
	}

	stats.DeviationsCount = len(stats.Deviations)

	// If MP was never in a faction during any recorded active vote, mark as independent
	if !hasAnyFactionVote && (mp == nil || mp.FactionID == "ind" || mp.FactionID == "") {
		stats.IsIndependent = true
		stats.CohesionPct = nil
		return stats
	}

	if stats.ActiveTotalCount > 0 {
		pct := round1dp(float64(stats.ActiveAlignedCount) / float64(stats.ActiveTotalCount) * 100)
		stats.CohesionPct = &pct
	} else {
		// In active faction but 0 active votes cast (e.g. absent ministers)
		val := 100.0
		stats.CohesionPct = &val
	}

	return stats
}

// ComputeMPCohesionLegacy calculates cohesion using the static MP faction in mps.json.
// Used for exact 100% equivalence testing against legacy mp_summaries.json.
func ComputeMPCohesionLegacy(store *data.Store, mpID string, voteFactionLines map[string]map[string]string) CohesionStats {
	mp := store.MPByID[mpID]
	fid := "ind"
	if mp != nil && mp.FactionID != "" {
		fid = mp.FactionID
	}
	isIndependent := (fid == "ind")

	if voteFactionLines == nil {
		voteFactionLines = ComputeStoreFactionLines(store)
	}

	var stats CohesionStats
	stats.IsIndependent = isIndependent

	if isIndependent {
		return stats
	}

	for _, vote := range store.Votes {
		voteMap, ok := store.RollcallByVoteAndMP[vote.ID]
		if !ok {
			continue
		}
		rec, found := voteMap[mpID]
		if !found {
			continue
		}

		decision := rec.Decision
		if decision != "PAR" && decision != "PRET" && decision != "ATTURAS" {
			continue
		}

		factionLines, hasVote := voteFactionLines[vote.ID]
		if !hasVote {
			continue
		}
		factionLine, hasLine := factionLines[fid]
		if !hasLine || factionLine == "" {
			continue
		}

		stats.ActiveTotalCount++
		if decision == factionLine {
			stats.ActiveAlignedCount++
		} else {
			isOpposite := (decision == "PAR" && (factionLine == "PRET" || factionLine == "ATTURAS")) ||
				(factionLine == "PAR" && (decision == "PRET" || decision == "ATTURAS"))

			devType := DeviationNuance
			if isOpposite {
				devType = DeviationOpposite
				stats.OppositeCount++
			} else {
				stats.NuanceCount++
			}

			stats.Deviations = append(stats.Deviations, VoteDeviation{
				VoteID:        vote.ID,
				SittingDate:   vote.SittingDate,
				Decision:      decision,
				FactionLine:   factionLine,
				DeviationType: devType,
			})
		}
	}

	stats.DeviationsCount = len(stats.Deviations)

	if stats.ActiveTotalCount > 0 {
		pct := round1dp(float64(stats.ActiveAlignedCount) / float64(stats.ActiveTotalCount) * 100)
		stats.CohesionPct = &pct
	} else {
		val := 100.0
		stats.CohesionPct = &val
	}

	return stats
}
