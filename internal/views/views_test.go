package views

import (
	"bytes"
	"context"
	"path/filepath"
	"strings"
	"testing"

	"github.com/FisersDavis/kabalsosaeima/internal/data"
	"github.com/FisersDavis/kabalsosaeima/internal/stats"
)

func TestCleanVoteTitle(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{
			input:    "Par likumprojekta Valsts aizsardzības dienesta likums (123/Lp14)",
			expected: "Valsts aizsardzības dienesta likums",
		},
		{
			input:    "Par priekšlikumu Nr. 5 likumprojektā (45/Lp14)",
			expected: "Nr. 5 likumprojektā",
		},
		{
			input:    "Likumprojekts Par valsts budžetu 2026. gadam",
			expected: "Par valsts budžetu 2026. gadam",
		},
		{
			input:    "Par lēmuma projektu Par Saeimas deputātu ētikas kodeksu",
			expected: "Par Saeimas deputātu ētikas kodeksu",
		},
		{
			input:    "   par likumprojektu grozījumi likumā   ",
			expected: "Grozījumi likumā",
		},
	}

	for _, tc := range tests {
		got := CleanVoteTitle(tc.input)
		if got != tc.expected {
			t.Errorf("CleanVoteTitle(%q) = %q; want %q", tc.input, got, tc.expected)
		}
	}
}

func TestCleanBillNr(t *testing.T) {
	if got := CleanBillNr("Nr. 1149/Lp14"); got != "1149/Lp14" {
		t.Errorf("CleanBillNr failed: got %q", got)
	}
	if got := CleanBillNr("#56/Lp14"); got != "56/Lp14" {
		t.Errorf("CleanBillNr failed: got %q", got)
	}
}

func TestMeaningfulVotePurpose(t *testing.T) {
	// Formulaic boilerplates should be suppressed
	if got := MeaningfulVotePurpose("Saeimas izskatīts likumprojekts (2. lasījums): Grozījumi likumā"); got != "" {
		t.Errorf("Expected empty string for mechanical purpose, got %q", got)
	}
	if got := MeaningfulVotePurpose("Procedūras lēmums Saeimas sēdes gaitā. Grozījumi likumā."); got != "" {
		t.Errorf("Expected empty string for procedural purpose, got %q", got)
	}
	if got := MeaningfulVotePurpose("Priekšlikums likumprojektam „Grozījumi likumā” (Nr. 123/Lp14)."); got != "" {
		t.Errorf("Expected empty string for generic proposal purpose, got %q", got)
	}

	// Substantive context should be preserved
	civic := "Likumprojekts paredzēja paaugstināt amatpersonu atbildību par informācijas nesniegšanu."
	if got := MeaningfulVotePurpose(civic); got != civic {
		t.Errorf("Expected %q, got %q", civic, got)
	}
}

func TestExtractResponsibleCommittee(t *testing.T) {
	summary := "Likumprojekts izskatīts Saeimas sēdē. Oficiālais reģistrācijas numurs: 1135/Lp14. Atbildīgā komisija: Tautsaimniecības, agrārās, vides un reģionālās politikas komisija."
	expected := "Tautsaimniecības, agrārās, vides un reģionālās politikas komisija"
	if got := ExtractResponsibleCommittee(summary); got != expected {
		t.Errorf("ExtractResponsibleCommittee failed: got %q, want %q", got, expected)
	}

	if got := ExtractResponsibleCommittee("Nav norādīta komisija."); got != "" {
		t.Errorf("Expected empty string when no committee is present, got %q", got)
	}
}

func TestPurposeLabel(t *testing.T) {
	if got := PurposeLabel("priekslikums", "Priekšlikums", "3. priekšlikums"); got != "Priekšlikuma būtība" {
		t.Errorf("Expected 'Priekšlikuma būtība', got %q", got)
	}
	if got := PurposeLabel("procedura", "Darba kārtība", "Par darba kārtību"); got != "Lēmuma pamatojums" {
		t.Errorf("Expected 'Lēmuma pamatojums', got %q", got)
	}
	if got := PurposeLabel("likums", "3. lasījums", "Grozījumi likumā"); got != "Likuma mērķis" {
		t.Errorf("Expected 'Likuma mērķis', got %q", got)
	}
}

func TestGroupFactionDecisions(t *testing.T) {
	fbs := []data.FactionBreakdown{
		{
			FactionID: "jv",
			ShortName: "JV",
			Votes:     data.FactionVotes{Par: 0, Pret: 24, Atturas: 0, Nebalso: 0},
		},
		{
			FactionID: "lpv",
			ShortName: "LPV",
			Votes:     data.FactionVotes{Par: 8, Pret: 0, Atturas: 0, Nebalso: 0},
		},
		{
			FactionID: "pro",
			ShortName: "PRO",
			Votes:     data.FactionVotes{Par: 0, Pret: 0, Atturas: 10, Nebalso: 0},
		},
	}

	groups := GroupFactionDecisions(fbs)
	if len(groups) != 3 {
		t.Fatalf("Expected 3 stance groups, got %d", len(groups))
	}

	if groups[0].Decision != "PAR" || groups[0].Factions[0].ShortName != "LPV" || groups[0].Factions[0].Count != 8 {
		t.Errorf("Unexpected PAR group: %+v", groups[0])
	}
	if groups[1].Decision != "PRET" || groups[1].Factions[0].ShortName != "JV" || groups[1].Factions[0].Count != 24 {
		t.Errorf("Unexpected PRET group: %+v", groups[1])
	}
	if groups[2].Decision != "ATTURAS" || groups[2].Factions[0].ShortName != "PRO" || groups[2].Factions[0].Count != 10 {
		t.Errorf("Unexpected ATTURAS group: %+v", groups[2])
	}
}

func loadGoldenStore(t *testing.T) *data.Store {
	t.Helper()
	goldenDir := filepath.Join("..", "..", "testdata", "golden")
	store, err := data.Load(goldenDir)
	if err != nil {
		t.Fatalf("Failed to load golden store from %s: %v", goldenDir, err)
	}
	return store
}

func TestBuildHemicycleSeats(t *testing.T) {
	store := loadGoldenStore(t)

	// Pick a non-secret vote
	var nonSecretVote *data.Vote
	var secretVote *data.Vote
	for i := range store.Votes {
		v := &store.Votes[i]
		if !v.IsSecret && nonSecretVote == nil {
			nonSecretVote = v
		}
		if v.IsSecret && secretVote == nil {
			secretVote = v
		}
	}

	if nonSecretVote == nil {
		t.Fatal("No non-secret vote found in golden dataset")
	}

	seats := BuildHemicycleSeats(store, nonSecretVote)
	if len(seats) != 100 {
		t.Fatalf("Expected exactly 100 seats on vote %s; got %d", nonSecretVote.ID, len(seats))
	}

	// Verify seat invariant: valid coordinates, slug, and colors
	for i, seat := range seats {
		if seat.Slug == "" {
			t.Errorf("Seat %d has empty Slug", i)
		}
		if seat.Name == "" {
			t.Errorf("Seat %d has empty Name", i)
		}
		if seat.Color == "" {
			t.Errorf("Seat %d has empty Color", i)
		}
		if seat.X <= 0 || seat.Y <= 0 {
			t.Errorf("Seat %d has invalid coordinates: (%f, %f)", i, seat.X, seat.Y)
		}
	}

	// Secret vote should return nil
	if secretVote != nil {
		secretSeats := BuildHemicycleSeats(store, secretVote)
		if len(secretSeats) != 0 {
			t.Errorf("Secret vote %s expected 0 seats; got %d", secretVote.ID, len(secretSeats))
		}
	}
}

func TestRenderOverview(t *testing.T) {
	store := loadGoldenStore(t)
	timelines := stats.GroupBillTimelines(store)
	props := OverviewProps{
		LayoutProps: LayoutProps{
			Title:        "Kā Balso Saeima - Balsojumu arhīvs",
			Description:  "Pārskats par visiem 14. Saeimas balsojumiem",
			CanonicalURL: "https://kabalsosaeima.lv/",
			ActiveNav:    "votes",
		},
		Votes:         store.Votes[:5], // Render a subset
		Categories:    []data.VoteCategory{{ID: "valsts", Label: "Valsts pārvalde"}},
		Store:         store,
		BillTimelines: timelines,
	}

	var buf bytes.Buffer
	err := Overview(props).Render(context.Background(), &buf)
	if err != nil {
		t.Fatalf("Failed to render Overview: %v", err)
	}

	html := buf.String()
	if !strings.Contains(html, "vote-card") {
		t.Error("Rendered HTML missing .vote-card")
	}
	if !strings.Contains(html, "data-title") {
		t.Error("Rendered HTML missing data-title attribute")
	}
	if !strings.Contains(html, "filter-empty-state") {
		t.Error("Rendered HTML missing filter-empty-state")
	}
	if !strings.Contains(html, "assets/js/filter.js") {
		t.Error("Rendered HTML missing filter.js")
	}
	if !strings.Contains(html, "assets/js/redirect.js") {
		t.Error("Rendered HTML missing redirect.js")
	}

	// Verify that if any vote in props.Votes has deviating MPs, they render as clickable links to /deputati/
	hasDevs := false
	for _, v := range props.Votes {
		for _, fb := range v.FactionBreakdown {
			if len(fb.DeviatingMps) > 0 {
				hasDevs = true
				break
			}
		}
		if hasDevs {
			break
		}
	}
	if hasDevs {
		if !strings.Contains(html, "✦ Novirzes no frakcijas") {
			t.Error("Expected deviations heading in overview HTML")
		}
		if !strings.Contains(html, `href="/deputati/`) {
			t.Error("Expected deviating MP link href in overview HTML")
		}
	}
}

func TestRenderVotePermalink(t *testing.T) {
	store := loadGoldenStore(t)
	var vote *data.Vote
	for i := range store.Votes {
		if !store.Votes[i].IsSecret {
			vote = &store.Votes[i]
			break
		}
	}
	if vote == nil {
		t.Fatal("No non-secret vote found")
	}

	seats := BuildHemicycleSeats(store, vote)
	props := VoteProps{
		LayoutProps: LayoutProps{
			Title:        vote.SimplifiedTitle,
			Description:  vote.Summary,
			CanonicalURL: "https://kabalsosaeima.lv/balsojumi/" + vote.ID + "/",
			ActiveNav:    "votes",
		},
		Vote:     vote,
		Seats:    seats,
		BillSlug: stats.CleanBillSlug(vote.BillNumber),
		Store:    store,
	}

	var buf bytes.Buffer
	err := Vote(props).Render(context.Background(), &buf)
	if err != nil {
		t.Fatalf("Failed to render Vote permalink: %v", err)
	}

	html := buf.String()
	// Assert accessible Hemicycle SVG seats with <a href="/deputati/{slug}/">
	if !strings.Contains(html, "<svg") {
		t.Error("Rendered HTML missing <svg>")
	}
	if !strings.Contains(html, "/deputati/") {
		t.Error("Rendered HTML missing deputy link /deputati/ in hemicycle")
	}
	if !strings.Contains(html, "<title>") {
		t.Error("Rendered HTML missing native <title> tooltip in SVG seats")
	}
}

func TestRenderBillTimeline(t *testing.T) {
	store := loadGoldenStore(t)
	timelines := stats.GroupBillTimelines(store)

	var bt *stats.BillTimeline
	for _, timeline := range timelines {
		if len(timeline.Stages) > 1 {
			bt = timeline
			break
		}
	}
	if bt == nil {
		t.Fatal("No multi-stage bill timeline found")
	}

	props := BillProps{
		LayoutProps: LayoutProps{
			Title:        bt.Title,
			Description:  "Likumprojekta gaitas hronoloģija",
			CanonicalURL: "https://kabalsosaeima.lv/likumprojekti/" + bt.Slug + "/",
			ActiveNav:    "votes",
		},
		Timeline: bt,
		Store:    store,
	}

	var buf bytes.Buffer
	err := Bill(props).Render(context.Background(), &buf)
	if err != nil {
		t.Fatalf("Failed to render Bill timeline: %v", err)
	}

	html := buf.String()
	if !strings.Contains(html, bt.Title) {
		t.Errorf("Rendered HTML missing bill title %q", bt.Title)
	}
	if !strings.Contains(html, "balsojumi") {
		t.Error("Rendered HTML missing stage votes count")
	}
}

func TestRenderMPDossier(t *testing.T) {
	store := loadGoldenStore(t)

	// Test 1: Inactive Minister (e.g. Evika Siliņa, slug: evika-silina)
	var ministerMP *data.MP
	for i := range store.MPs {
		if store.MPs[i].Slug == "evika-silina" {
			ministerMP = &store.MPs[i]
			break
		}
	}
	if ministerMP == nil {
		t.Fatal("Minister Evika Siliņa not found in golden dataset")
	}

	att := stats.ComputeMPAttendance(store, ministerMP.ID)
	factionLines := stats.ComputeStoreFactionLines(store)
	coh := stats.ComputeMPCohesion(store, ministerMP.ID, factionLines)
	mandate := store.MandateByMpID[ministerMP.ID]

	props := MPProps{
		LayoutProps: LayoutProps{
			Title:        ministerMP.Name + " - Saeimas deputāta profils",
			Description:  "Deputāta balsojumu analītika",
			CanonicalURL: "https://kabalsosaeima.lv/deputati/" + ministerMP.Slug + "/",
			ActiveNav:    "mps",
		},
		MP:         ministerMP,
		Mandate:    mandate,
		Faction:    store.FactionByID[ministerMP.FactionID],
		Attendance: att,
		Cohesion:   coh,
		History:    store.RollcallsByMP[ministerMP.ID],
		Store:      store,
	}

	var buf bytes.Buffer
	err := MPView(props).Render(context.Background(), &buf)
	if err != nil {
		t.Fatalf("Failed to render MPView: %v", err)
	}

	html := buf.String()
	if !strings.Contains(html, "Mandāts neaktīvs") {
		t.Error("Expected inactive minister to display 'Mandāts neaktīvs' badge")
	}
	if !strings.Contains(html, ministerMP.Name) {
		t.Error("Rendered HTML missing MP name")
	}
}

func TestRenderMPDirectory(t *testing.T) {
	store := loadGoldenStore(t)
	factionLines := stats.ComputeStoreFactionLines(store)

	var items []MPDirectoryItem
	for i := range store.MPs {
		mp := &store.MPs[i]
		att := stats.ComputeMPAttendance(store, mp.ID)
		coh := stats.ComputeMPCohesion(store, mp.ID, factionLines)
		items = append(items, MPDirectoryItem{
			MP:         mp,
			Mandate:    store.MandateByMpID[mp.ID],
			Faction:    store.FactionByID[mp.FactionID],
			Attendance: att,
			Cohesion:   coh,
		})
	}

	props := MPDirectoryProps{
		LayoutProps: LayoutProps{
			Title:        "14. Saeimas deputāti un frakcijas",
			Description:  "14. Saeimas deputātu saraksts",
			CanonicalURL: "https://kabalsosaeima.lv/deputati/",
			ActiveNav:    "mps",
		},
		Items:    items,
		Factions: store.Factions,
		Store:    store,
	}

	var buf bytes.Buffer
	err := MPDirectory(props).Render(context.Background(), &buf)
	if err != nil {
		t.Fatalf("Failed to render MPDirectory: %v", err)
	}

	html := buf.String()
	if !strings.Contains(html, "mp-row") {
		t.Error("Rendered HTML missing .mp-row")
	}
	if !strings.Contains(html, "data-name") {
		t.Error("Rendered HTML missing data-name attribute")
	}
	if !strings.Contains(html, "data-sort") {
		t.Error("Rendered HTML missing data-sort attribute")
	}
	if !strings.Contains(html, "mp-filter.js") {
		t.Error("Rendered HTML missing mp-filter.js")
	}
}

