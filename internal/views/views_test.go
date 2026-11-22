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

func TestTermURLAndMultiTermSwitcher(t *testing.T) {
	if got := TermURL("", "/deputati/"); got != "/deputati/" {
		t.Errorf("TermURL('', '/deputati/') = %q, want /deputati/", got)
	}
	if got := TermURL("/14-saeima", "/"); got != "/14-saeima/" {
		t.Errorf("TermURL('/14-saeima', '/') = %q, want /14-saeima/", got)
	}
	if got := TermURL("/14-saeima", "/balsojumi/abc/"); got != "/14-saeima/balsojumi/abc/" {
		t.Errorf("TermURL('/14-saeima', '/balsojumi/abc/') = %q, want /14-saeima/balsojumi/abc/", got)
	}

	store := loadGoldenStore(t)
	props := OverviewProps{
		LayoutProps: LayoutProps{
			Title:        "14. Saeima",
			CanonicalURL: "https://kabalsosaeima.lv/14-saeima/",
			ActiveNav:    "votes",
			TermNumber:   14,
			TermYears:    "2022–2026",
			BasePath:     "/14-saeima",
			Terms: []TermNavItem{
				{Term: 15, Label: "15. Saeima", Years: "2026–2030", BasePath: "", IsActive: true},
				{Term: 14, Label: "14. Saeima", Years: "2022–2026", BasePath: "/14-saeima", IsActive: false},
			},
		},
		Votes: store.Votes[:2],
		Store: store,
	}

	var buf bytes.Buffer
	if err := Overview(props).Render(context.Background(), &buf); err != nil {
		t.Fatalf("Failed to render multi-term Overview: %v", err)
	}
	html := buf.String()
	if !strings.Contains(html, `aria-label="Saeimas sasaukuma izvēle"`) {
		t.Error("Rendered multi-term HTML missing term switcher nav")
	}
	if !strings.Contains(html, `href="/14-saeima/deputati/"`) {
		t.Error("Rendered 14. Saeima HTML missing scoped /14-saeima/deputati/ nav link")
	}
	if !strings.Contains(html, `href="/14-saeima/balsojumi/`) {
		t.Error("Rendered 14. Saeima HTML missing scoped /14-saeima/balsojumi/ card link")
	}
	if !strings.Contains(html, "15. Saeima") {
		t.Error("Rendered multi-term HTML missing 15. Saeima switcher option")
	}
}

func TestDebaterStyleAndKeyDebaters(t *testing.T) {
	// Neutral general debate speaker (e.g. Prime Minister candidate) must NEVER be mislabeled as "Pret"
	pmCand := data.Debater{
		Name:         "Andris Kulbergs",
		Fraction:     "AS",
		Opinion:      "Debates",
		Role:         "Ministru prezidenta amata kandidāts",
		Duration:     "22:14",
		VoteDecision: "PAR",
		Preview:      "Pirms nepilna pusgada 28. maijā es stāvēju šai pat tribīnē.",
		FullSpeech:   "Godātais Saeimas priekšsēdētāj!\n\nPirms nepilna pusgada 28. maijā es stāvēju šai pat tribīnē.",
	}
	stPM := DebaterStyle(pmCand)
	if strings.Contains(stPM.PrefixLabel, "Pret") {
		t.Errorf("Neutral debate speaker mislabeled as Pret: %q", stPM.PrefixLabel)
	}
	if !stPM.HasRealSpeech || !stPM.CanExpand {
		t.Errorf("Expected PM candidate speech to have HasRealSpeech=true and CanExpand=true, got %+v", stPM)
	}
	if stPM.VotePillText != "Balsoja PAR" {
		t.Errorf("Expected VotePillText='Balsoja PAR', got %q", stPM.VotePillText)
	}
	if !strings.Contains(stPM.MetaSubtitle, "22:14") {
		t.Errorf("Expected MetaSubtitle to include duration, got %q", stPM.MetaSubtitle)
	}

	// Legacy duration-only preview must NOT be treated as a real speech quote
	legacyDeb := data.Debater{
		Name:    "Test Speaker",
		Opinion: "Debates",
		Preview: "Frakc. viedoklis · Dep. · uzstāšanās ilgums 08:35",
	}
	stLegacy := DebaterStyle(legacyDeb)
	if stLegacy.HasRealSpeech {
		t.Errorf("Expected legacy duration-only preview to have HasRealSpeech=false")
	}

	// KeyDebaters on general debate picks contrasting presenter/PAR vs PRET
	opp := data.Debater{
		Name:         "Inese Lībiņa-Egnere",
		Fraction:     "JV",
		Opinion:      "Debates",
		Role:         "Frakcijas viedoklis",
		Duration:     "08:35",
		VoteDecision: "PRET",
		Preview:      "Dažas stundas kopš preses konferences...",
		FullSpeech:   "Augsti godātais Saeimas priekšsēdētāja kungs!\n\nDažas stundas kopš preses konferences...",
	}
	ally := data.Debater{
		Name:         "Artūrs Butāns",
		Fraction:     "NA",
		Opinion:      "Debates",
		Role:         "Frakcijas viedoklis",
		VoteDecision: "PAR",
		Preview:      "Nacionālā apvienība redz Latviju...",
		FullSpeech:   "Nacionālā apvienība redz Latviju...",
	}
	args := &data.DebateArguments{
		HasDebates: true,
		Debaters:   []data.Debater{pmCand, ally, opp},
	}
	picked := KeyDebaters(args)
	if len(picked) != 2 || picked[0].Name != "Andris Kulbergs" || picked[1].Name != "Inese Lībiņa-Egnere" {
		t.Errorf("Expected contrasting KeyDebaters [Andris Kulbergs, Inese Lībiņa-Egnere], got %+v", picked)
	}

	// SpeechParagraphs splits double-newline paragraphs cleanly
	paras := SpeechParagraphs("Pirmais paragrāfs.\n\nOtrais paragrāfs.\n\n")
	if len(paras) != 2 || paras[0] != "Pirmais paragrāfs." || paras[1] != "Otrais paragrāfs." {
		t.Errorf("Unexpected SpeechParagraphs result: %+v", paras)
	}
}

func TestVoteProtocolAndBillURLsNoDeadEnds(t *testing.T) {
	// 1. Direct protocolUrl wins
	v1 := data.Vote{
		SaeimaTerm:  15,
		ProtocolURL: "https://titania.saeima.lv/LIVS15/saeimalivs2_dk.nsf/0/51636DB89C39420BC2258EB20072DFB2?OpenDocument",
		DkID:        "25552831-b992-409a-942e-51075d920c2c",
		BillNumber:  "14/Lm15",
	}
	if got := VoteProtocolURL(v1); got != v1.ProtocolURL {
		t.Errorf("VoteProtocolURL(v1) = %q, want %q", got, v1.ProtocolURL)
	}

	// 2. Missing protocolUrl falls back to exact sitting DK page (never SearchView dead end)
	v2 := data.Vote{
		SaeimaTerm: 15,
		DkID:       "25552831-b992-409a-942e-51075d920c2c",
		BillNumber: "14/Lm15",
	}
	got2 := VoteProtocolURL(v2)
	if !strings.Contains(got2, "saeimalivs2_dk.nsf/DK?ReadForm&nr=25552831-b992-409a-942e-51075d920c2c") {
		t.Errorf("VoteProtocolURL(v2) = %q, want DK?ReadForm fallback", got2)
	}
	if strings.Contains(got2, "SearchView") {
		t.Errorf("VoteProtocolURL must never generate broken SearchView URL: %q", got2)
	}

	// 3. Lm decisions route to saeimalivs_lmp.nsf; Lp bills route to saeimalivs{term}.nsf (never 404 SaeimaLIVS2_DK.nsf/webAll)
	if got := SaeimaBillSearchURLForTerm(15, "14/Lm15"); !strings.Contains(got, "/LIVS15/saeimalivs_lmp.nsf/webAll?OpenView") {
		t.Errorf("Unexpected Lm15 bill URL: %q", got)
	}
	if got := SaeimaBillSearchURLForTerm(14, "1246/Lp14"); !strings.Contains(got, "/LIVS14/saeimalivs14.nsf/webAll?OpenView") {
		t.Errorf("Unexpected Lp14 bill URL: %q", got)
	}
}



