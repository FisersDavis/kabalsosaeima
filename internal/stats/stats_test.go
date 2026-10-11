package stats_test

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/FisersDavis/kabalsosaeima/internal/data"
	"github.com/FisersDavis/kabalsosaeima/internal/stats"
)

type GoldenSummary struct {
	PresentPct      float64  `json:"presentPct"`
	WithheldPct     float64  `json:"withheldPct"`
	AbsentPct       float64  `json:"absentPct"`
	CohesionPct     *float64 `json:"cohesionPct"`
	DeviationsCount int      `json:"deviationsCount"`
	OppositeCount   int      `json:"oppositeCount"`
	NuanceCount     int      `json:"nuanceCount"`
	IsIndependent   bool     `json:"isIndependent"`
}

func loadGoldenDataset(t *testing.T) (*data.Store, map[string]GoldenSummary) {
	goldenDir := filepath.Join("..", "..", "testdata", "golden")
	store, err := data.Load(goldenDir)
	if err != nil {
		t.Fatalf("Failed to load golden store: %v", err)
	}

	summaryPath := filepath.Join(goldenDir, "mp_summaries.json")
	bytes, err := os.ReadFile(summaryPath)
	if err != nil {
		t.Fatalf("Failed to read golden mp_summaries.json: %v", err)
	}

	var summaries map[string]GoldenSummary
	if err := json.Unmarshal(bytes, &summaries); err != nil {
		t.Fatalf("Failed to unmarshal golden mp_summaries.json: %v", err)
	}

	return store, summaries
}

func floatEq(a, b float64) bool {
	return math.Abs(a-b) < 0.05
}

func floatPtrEq(a, b *float64) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return floatEq(*a, *b)
}

// TestContinuousMPsGoldenParity verifies 100% equivalence of attendance and cohesion stats
// for all continuous deputies who held an uninterrupted mandate across the entire period
// and did not switch factions.
func TestContinuousMPsGoldenParity(t *testing.T) {
	store, goldenSummaries := loadGoldenDataset(t)
	factionLines := stats.ComputeStoreFactionLines(store)

	// Collect all unique sitting dates
	sittingDates := make(map[string]bool)
	for _, v := range store.Votes {
		d, _ := data.ParseSittingDate(v.SittingDate)
		sittingDates[d] = true
	}

	// Rollcall factions map: mpID -> set of distinct factionIDs in rollcalls
	mpRollcallFactions := make(map[string]map[string]bool)
	for _, recs := range store.Rollcalls {
		for _, r := range recs {
			if _, ok := mpRollcallFactions[r.MpID]; !ok {
				mpRollcallFactions[r.MpID] = make(map[string]bool)
			}
			mpRollcallFactions[r.MpID][r.FactionID] = true
		}
	}

	var continuousMPs []string
	for _, m := range store.Mandates {
		// Deputy must be active on all sitting dates
		activeAll := true
		for d := range sittingDates {
			if !m.IsActiveOnDate(d) {
				activeAll = false
				break
			}
		}
		if !activeAll {
			continue
		}

		// To be in the continuous golden parity group, the deputy's faction in all rollcalls
		// must match their registered faction in mps.json
		rfSet, ok := mpRollcallFactions[m.MpID]
		if !ok {
			continue
		}
		mp := store.MPByID[m.MpID]
		if mp == nil {
			continue
		}
		if len(rfSet) == 1 && rfSet[mp.FactionID] {
			continuousMPs = append(continuousMPs, m.MpID)
		}
	}

	if len(continuousMPs) < 80 {
		t.Fatalf("Expected at least 80 continuous non-switcher MPs, found %d", len(continuousMPs))
	}

	t.Logf("Testing 100%% equivalence for %d continuous MPs against golden snapshot...", len(continuousMPs))

	for _, mpID := range continuousMPs {
		golden, ok := goldenSummaries[mpID]
		if !ok {
			t.Errorf("MP %s missing from golden summaries", mpID)
			continue
		}

		att := stats.ComputeMPAttendance(store, mpID)
		coh := stats.ComputeMPCohesion(store, mpID, factionLines)

		// 1. Attendance checks
		if !floatEq(att.PresentPct, golden.PresentPct) {
			t.Errorf("MP %s PresentPct mismatch: got %.1f, want %.1f", mpID, att.PresentPct, golden.PresentPct)
		}
		if !floatEq(att.WithheldPct, golden.WithheldPct) {
			t.Errorf("MP %s WithheldPct mismatch: got %.1f, want %.1f", mpID, att.WithheldPct, golden.WithheldPct)
		}
		if !floatEq(att.AbsentPct, golden.AbsentPct) {
			t.Errorf("MP %s AbsentPct mismatch: got %.1f, want %.1f", mpID, att.AbsentPct, golden.AbsentPct)
		}

		// 2. Cohesion checks
		if !floatPtrEq(coh.CohesionPct, golden.CohesionPct) {
			var gotStr, wantStr string
			if coh.CohesionPct != nil {
				gotStr = jsonNum(*coh.CohesionPct)
			} else {
				gotStr = "nil"
			}
			if golden.CohesionPct != nil {
				wantStr = jsonNum(*golden.CohesionPct)
			} else {
				wantStr = "nil"
			}
			t.Errorf("MP %s CohesionPct mismatch: got %s, want %s", mpID, gotStr, wantStr)
		}
		if coh.DeviationsCount != golden.DeviationsCount {
			t.Errorf("MP %s DeviationsCount mismatch: got %d, want %d", mpID, coh.DeviationsCount, golden.DeviationsCount)
		}
		if coh.OppositeCount != golden.OppositeCount {
			t.Errorf("MP %s OppositeCount mismatch: got %d, want %d", mpID, coh.OppositeCount, golden.OppositeCount)
		}
		if coh.NuanceCount != golden.NuanceCount {
			t.Errorf("MP %s NuanceCount mismatch: got %d, want %d", mpID, coh.NuanceCount, golden.NuanceCount)
		}
		if coh.IsIndependent != golden.IsIndependent {
			t.Errorf("MP %s IsIndependent mismatch: got %v, want %v", mpID, coh.IsIndependent, golden.IsIndependent)
		}
	}
}

func jsonNum(v float64) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// TestDocumentedSwitchersAndMinisters explicitly verifies and documents behavior for:
// 1. Inactive ministers (mandate suspended/ended prior to votes): zero eligible votes, 0.0 attendance.
// 2. Faction switchers: rollcall faction fidelity vs static mps.json faction.
func TestDocumentedSwitchersAndMinisters(t *testing.T) {
	store, goldenSummaries := loadGoldenDataset(t)
	factionLines := stats.ComputeStoreFactionLines(store)

	t.Run("InactiveMinistersHonestDenominator", func(t *testing.T) {
		// Ministers whose mandates were suspended before 2026 votes (e.g. Evika Siliņa, Arvils Ašeradens)
		ministers := []string{"mp-1", "mp-2", "mp-6"}
		for _, mpID := range ministers {
			att := stats.ComputeMPAttendance(store, mpID)
			if att.TotalEligibleVotes != 0 {
				t.Errorf("Minister %s expected 0 eligible votes during mandate, got %d", mpID, att.TotalEligibleVotes)
			}
			if att.PresentPct != 0.0 || att.WithheldPct != 0.0 || att.AbsentPct != 0.0 {
				t.Errorf("Minister %s expected 0.0 for all percentages, got Present=%.1f Withheld=%.1f Absent=%.1f",
					mpID, att.PresentPct, att.WithheldPct, att.AbsentPct)
			}

			// In golden legacy, because denominator was static len(votes), they were reported as absentPct: 100.0
			golden := goldenSummaries[mpID]
			t.Logf("Documented Minister %s: Legacy absentPct=%.1f%% vs Corrected Honest Denominator (TotalEligible=%d, Present=%.1f%%, Absent=%.1f%%)",
				mpID, golden.AbsentPct, att.TotalEligibleVotes, att.PresentPct, att.AbsentPct)
		}
	})

	t.Run("FactionSwitchersHistoricalFidelity", func(t *testing.T) {
		// All 14 deputies whose rollcall factions differed from static mps.json:
		// Switchers between ST and IND: mp-90, mp-91, mp-92, mp-93, mp-94, mp-106, mp-107
		// Cross-faction/independent discrepancies: mp-21 (JV in mps.json, NA in rollcalls),
		// mp-25 (JV vs IND), mp-50 (PRO vs IND), mp-60 (AS vs LPV), mp-65 (AS vs IND),
		// mp-83 (LPV vs IND), mp-96 (ST vs IND).
		switchers := []string{
			"mp-21", "mp-25", "mp-50", "mp-60", "mp-65", "mp-83", "mp-96",
			"mp-90", "mp-91", "mp-92", "mp-93", "mp-94", "mp-106", "mp-107",
		}

		for _, mpID := range switchers {
			golden := goldenSummaries[mpID]

			// Historical rollcall cohesion: evaluates against the faction held AT THE TIME of each vote
			histCoh := stats.ComputeMPCohesion(store, mpID, factionLines)

			// Legacy static cohesion: evaluates against the static mps.json faction
			legacyCoh := stats.ComputeMPCohesionLegacy(store, mpID, factionLines)

			// Legacy must match golden 1:1
			if !floatPtrEq(legacyCoh.CohesionPct, golden.CohesionPct) {
				t.Errorf("Switcher %s Legacy CohesionPct mismatch: got %v, want %v", mpID, legacyCoh.CohesionPct, golden.CohesionPct)
			}
			if legacyCoh.DeviationsCount != golden.DeviationsCount {
				t.Errorf("Switcher %s Legacy DeviationsCount mismatch: got %d, want %d", mpID, legacyCoh.DeviationsCount, golden.DeviationsCount)
			}
			if legacyCoh.OppositeCount != golden.OppositeCount {
				t.Errorf("Switcher %s Legacy OppositeCount mismatch: got %d, want %d", mpID, legacyCoh.OppositeCount, golden.OppositeCount)
			}
			if legacyCoh.NuanceCount != golden.NuanceCount {
				t.Errorf("Switcher %s Legacy NuanceCount mismatch: got %d, want %d", mpID, legacyCoh.NuanceCount, golden.NuanceCount)
			}

			t.Logf("Documented Switcher %s: Legacy static cohesion=%v%% (devs=%d, opp=%d) -> Historical rollcall cohesion=%v%% (active=%d/%d, devs=%d, opp=%d)",
				mpID,
				formatFloatPtr(legacyCoh.CohesionPct), legacyCoh.DeviationsCount, legacyCoh.OppositeCount,
				formatFloatPtr(histCoh.CohesionPct), histCoh.ActiveAlignedCount, histCoh.ActiveTotalCount, histCoh.DeviationsCount, histCoh.OppositeCount,
			)
		}
	})
}

func formatFloatPtr(v *float64) string {
	if v == nil {
		return "nil"
	}
	return jsonNum(*v)
}

// TestBillTimelinesGrouping verifies that bill timelines correctly group multi-vote bills
// into progression stages and generate clean URL slugs.
func TestBillTimelinesGrouping(t *testing.T) {
	store, _ := loadGoldenDataset(t)
	timelines := stats.GroupBillTimelines(store)

	if len(timelines) == 0 {
		t.Fatal("Expected non-empty bill timelines")
	}

	// Test bill 56/Lp14: has 24 votes including amendments and final reading
	bt, ok := timelines["56/Lp14"]
	if !ok {
		t.Fatalf("Bill 56/Lp14 not found in grouped timelines")
	}

	if bt.Slug != "56-lp14" {
		t.Errorf("Expected slug '56-lp14', got %q", bt.Slug)
	}

	if bt.TotalVotes != 24 {
		t.Errorf("Expected 24 total votes for 56/Lp14, got %d", bt.TotalVotes)
	}

	if len(bt.Stages) == 0 {
		t.Errorf("Expected at least 1 stage for 56/Lp14")
	}

	// Verify slug generation
	testCases := []struct {
		input string
		want  string
	}{
		{"1149/Lp14", "1149-lp14"},
		{"Nr. 56/Lp14", "56-lp14"},
		{"#924/Lm14", "924-lm14"},
		{"110/P14", "110-p14"},
	}

	for _, tc := range testCases {
		got := stats.CleanBillSlug(tc.input)
		if got != tc.want {
			t.Errorf("CleanBillSlug(%q): got %q, want %q", tc.input, got, tc.want)
		}
	}
}
