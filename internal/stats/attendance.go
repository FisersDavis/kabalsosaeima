package stats

import (
	"math"

	"github.com/FisersDavis/kabalsosaeima/internal/data"
)

// AttendanceStats holds attendance metrics computed over an MP's active mandate intervals.
type AttendanceStats struct {
	TotalEligibleVotes int     `json:"totalEligibleVotes"` // Denominator: votes held during active mandate intervals
	PresentCount       int     `json:"presentCount"`       // PAR, PRET, ATTURAS
	PresentPct         float64 `json:"presentPct"`         // PresentCount / TotalEligibleVotes * 100
	WithheldCount      int     `json:"withheldCount"`      // NEBALSO (in chamber, quorum tactic)
	WithheldPct        float64 `json:"withheldPct"`        // WithheldCount / TotalEligibleVotes * 100
	AbsentCount        int     `json:"absentCount"`        // Absent / NAV_REGISTRETS while mandate active
	AbsentPct          float64 `json:"absentPct"`          // AbsentCount / TotalEligibleVotes * 100

	// Vote breakdowns
	ParCount     int `json:"parCount"`
	PretCount    int `json:"pretCount"`
	AtturasCount int `json:"atturasCount"`
}

// round1dp rounds a float64 to 1 decimal place (standard statistical display).
func round1dp(val float64) float64 {
	return math.Round(val*10) / 10
}

// ComputeMPAttendance computes attendance for a deputy against the store votes,
// calculating the denominator honestly: ONLY votes on dates where the MP held an active mandate.
// If the MP had 0 eligible votes during the dataset period, all percentages are 0.0.
func ComputeMPAttendance(store *data.Store, mpID string) AttendanceStats {
	mandate := store.MandateByMpID[mpID]

	var stats AttendanceStats
	for _, vote := range store.Votes {
		if vote.IsSecret {
			continue
		}
		isoDate, err := data.ParseSittingDate(vote.SittingDate)
		if err != nil {
			continue
		}

		// Denominator check: was MP active on this vote date?
		if mandate == nil || !mandate.IsActiveOnDate(isoDate) {
			continue
		}

		stats.TotalEligibleVotes++

		// Check deputy decision from rollcalls
		var decision string
		if voteMap, ok := store.RollcallByVoteAndMP[vote.ID]; ok {
			if rec, found := voteMap[mpID]; found {
				decision = rec.Decision
			}
		}

		switch decision {
		case "PAR":
			stats.PresentCount++
			stats.ParCount++
		case "PRET":
			stats.PresentCount++
			stats.PretCount++
		case "ATTURAS":
			stats.PresentCount++
			stats.AtturasCount++
		case "NEBALSO":
			stats.WithheldCount++
		default: // NAV_REGISTRETS or missing record while holding active mandate
			stats.AbsentCount++
		}
	}

	if stats.TotalEligibleVotes > 0 {
		stats.PresentPct = round1dp(float64(stats.PresentCount) / float64(stats.TotalEligibleVotes) * 100)
		stats.WithheldPct = round1dp(float64(stats.WithheldCount) / float64(stats.TotalEligibleVotes) * 100)
		stats.AbsentPct = round1dp(float64(stats.AbsentCount) / float64(stats.TotalEligibleVotes) * 100)
	}

	return stats
}
