package views

import (
	"fmt"
	"math"
	"regexp"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/FisersDavis/kabalsosaeima/internal/data"
	"github.com/FisersDavis/kabalsosaeima/internal/stats"
)

var (
	preamblePats = []*regexp.Regexp{
		regexp.MustCompile(`(?i)^\s*Par\s+likumprojekta\s+`),
		regexp.MustCompile(`(?i)^\s*Par\s+likumprojektu\s+`),
		regexp.MustCompile(`(?i)^\s*Par\s+lēmuma\s+projektu\s+`),
		regexp.MustCompile(`(?i)^\s*Par\s+lēmuma\s+`),
		regexp.MustCompile(`(?i)^\s*Likumprojekts\s+`),
		regexp.MustCompile(`(?i)^\s*Par\s+priekšlikumu\s+`),
	}
	trailingParenPat = regexp.MustCompile(`\s*\(\s*\d+\/[A-Za-z0-9]+\s*\)\s*$`)
)

// CleanVoteTitle removes legal filler and parliamentary boilerplate from vote titles.
func CleanVoteTitle(rawTitle string) string {
	t := strings.TrimSpace(rawTitle)
	for _, pat := range preamblePats {
		t = pat.ReplaceAllString(t, "")
	}
	t = trailingParenPat.ReplaceAllString(t, "")
	t = strings.TrimSpace(t)
	if len(t) > 0 {
		r, size := utf8.DecodeRuneInString(t)
		return string(unicode.ToUpper(r)) + t[size:]
	}
	return rawTitle
}

// CleanBillNr removes "#" or "Nr." prefixes from bill numbers.
func CleanBillNr(raw string) string {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "Nr.")
	s = strings.TrimPrefix(s, "#")
	return strings.TrimSpace(s)
}

// ResolveMPSlug looks up an MP's slug from the store, falling back to mpID.
func ResolveMPSlug(store *data.Store, mpID string) string {
	if store != nil && store.MPByID != nil {
		if mp, ok := store.MPByID[mpID]; ok && mp != nil && mp.Slug != "" {
			return mp.Slug
		}
	}
	return mpID
}

// MeaningfulVotePurpose extracts substantive civic context if purpose is not generic boilerplate.
// Returns empty string if purpose is only a mechanical repetition of stage/number or empty.
func MeaningfulVotePurpose(purpose string) string {
	s := strings.TrimSpace(purpose)
	if s == "" {
		return ""
	}
	// Filter out formulaic robotic boilerplates
	if strings.HasPrefix(s, "Saeimas izskatīts likumprojekts") {
		return ""
	}
	if strings.HasPrefix(s, "Procedūras lēmums Saeimas sēdes gaitā") {
		return ""
	}
	if strings.HasPrefix(s, "Priekšlikums likumprojektam") {
		return ""
	}
	return s
}

var committeeRegex = regexp.MustCompile(`(?i)Atbildīgā komisija:\s*([^.]+)`)

// ExtractResponsibleCommittee extracts committee name from legal summary text if present.
func ExtractResponsibleCommittee(summary string) string {
	m := committeeRegex.FindStringSubmatch(summary)
	if len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	return ""
}

// PurposeLabel returns an appropriate label for context based on whether the vote is a proposal or a law.
func PurposeLabel(voteType, readingStage, title string) string {
	vt := strings.ToLower(voteType)
	rs := strings.ToLower(readingStage)
	t := strings.ToLower(title)
	if vt == "priekslikums" || strings.Contains(rs, "priekšlikum") || strings.Contains(t, "priekšlikum") {
		return "Priekšlikuma būtība"
	}
	if vt == "procedura" || strings.Contains(rs, "procedūr") || strings.Contains(rs, "darba kārtīb") {
		return "Lēmuma pamatojums"
	}
	return "Likuma mērķis"
}


// DecisionColor returns standard chromatic colors for parliamentary decisions.
func DecisionColor(decision string) string {
	switch strings.ToUpper(strings.TrimSpace(decision)) {
	case "PAR":
		return "#059669" // Emerald 600
	case "PRET":
		return "#e11d48" // Rose 600
	case "ATTURAS":
		return "#d97706" // Amber 600
	default:
		return "#94a3b8" // Slate 400
	}
}

// DecisionLabel returns user-facing Latvian text for a decision.
func DecisionLabel(decision string) string {
	switch strings.ToUpper(strings.TrimSpace(decision)) {
	case "PAR":
		return "PAR"
	case "PRET":
		return "PRET"
	case "ATTURAS":
		return "ATTURAS"
	case "NEBALSO":
		return "NEBALSOJA"
	default:
		return "NAV REĢISTRĒTS"
	}
}

// DecisionBadgeClass returns Tailwind utility classes for decision pills.
func DecisionBadgeClass(decision string) string {
	switch strings.ToUpper(strings.TrimSpace(decision)) {
	case "PAR":
		return "bg-emerald-50 text-emerald-700 border-emerald-200"
	case "PRET":
		return "bg-rose-50 text-rose-700 border-rose-200"
	case "ATTURAS":
		return "bg-amber-50 text-amber-700 border-amber-200"
	case "NEBALSO":
		return "bg-slate-50 text-slate-600 border-slate-200"
	default:
		return "bg-slate-50 text-slate-500 border-slate-200"
	}
}

// FactionDecisionSummary represents a faction's stance with vote count.
type FactionDecisionSummary struct {
	FactionID string
	ShortName string
	Count     int
}

// FactionStanceGroup groups factions that shared the same stance on a vote.
type FactionStanceGroup struct {
	Decision string
	Factions []FactionDecisionSummary
}

// GroupFactionDecisions categorizes factions into PAR, PRET, ATTURAS, NEBALSO groups.
func GroupFactionDecisions(breakdowns []data.FactionBreakdown) []FactionStanceGroup {
	type bucket struct {
		decision string
		factions []FactionDecisionSummary
	}
	par := bucket{decision: "PAR"}
	pret := bucket{decision: "PRET"}
	att := bucket{decision: "ATTURAS"}
	neb := bucket{decision: "NEBALSO"}

	for _, fb := range breakdowns {
		p := fb.Votes.Par
		pr := fb.Votes.Pret
		a := fb.Votes.Atturas
		n := fb.Votes.Nebalso

		maxActive := p
		bestDec := "PAR"
		bestCount := p

		if pr > maxActive {
			maxActive = pr
			bestDec = "PRET"
			bestCount = pr
		}
		if a > maxActive {
			maxActive = a
			bestDec = "ATTURAS"
			bestCount = a
		}

		if maxActive > 0 {
			switch bestDec {
			case "PAR":
				par.factions = append(par.factions, FactionDecisionSummary{FactionID: fb.FactionID, ShortName: fb.ShortName, Count: bestCount})
			case "PRET":
				pret.factions = append(pret.factions, FactionDecisionSummary{FactionID: fb.FactionID, ShortName: fb.ShortName, Count: bestCount})
			case "ATTURAS":
				att.factions = append(att.factions, FactionDecisionSummary{FactionID: fb.FactionID, ShortName: fb.ShortName, Count: bestCount})
			}
		} else if n > 0 {
			neb.factions = append(neb.factions, FactionDecisionSummary{FactionID: fb.FactionID, ShortName: fb.ShortName, Count: n})
		}
	}

	var res []FactionStanceGroup
	if len(par.factions) > 0 {
		res = append(res, FactionStanceGroup{Decision: "PAR", Factions: par.factions})
	}
	if len(pret.factions) > 0 {
		res = append(res, FactionStanceGroup{Decision: "PRET", Factions: pret.factions})
	}
	if len(att.factions) > 0 {
		res = append(res, FactionStanceGroup{Decision: "ATTURAS", Factions: att.factions})
	}
	if len(neb.factions) > 0 {
		res = append(res, FactionStanceGroup{Decision: "NEBALSOJA", Factions: neb.factions})
	}
	return res
}

// ResultLabel returns user-facing Latvian outcome description.
func ResultLabel(result string) string {
	switch result {
	case "PIENEMTS":
		return "Pieņemts"
	case "NAV_KVORUMA":
		return "Nav kvoruma"
	case "NORAIDITS":
		return "Noraidīts"
	default:
		return result
	}
}

// ResultBadgeClass returns Tailwind utility classes for outcome badges.
func ResultBadgeClass(result string) string {
	switch result {
	case "PIENEMTS":
		return "border-emerald-300 bg-emerald-50 text-emerald-800"
	case "NAV_KVORUMA":
		return "border-amber-300 bg-amber-50 text-amber-900"
	case "NORAIDITS":
		return "border-rose-300 bg-rose-50 text-rose-800"
	default:
		return "border-slate-300 bg-slate-50 text-slate-800"
	}
}

// HemicycleSeat represents a single focusable seat in the Saeima chamber.
type HemicycleSeat struct {
	MpID         string
	Name         string
	Slug         string
	FactionID    string
	FactionShort string
	FactionColor string
	Decision     string
	Color        string
	ChamberSeat  int
	X            float64
	Y            float64
}

// ResolveMPFactionOnDate determines an MP's faction at a specific vote date.
// Implements historical faction fidelity with fallback:
// 1. Rollcall record on that date
// 2. Nearest rollcall record on or before that date
// 3. Nearest rollcall record after that date
// 4. Static mps.json FactionID as fallback
func ResolveMPFactionOnDate(store *data.Store, mpID string, voteDate string) string {
	mp := store.MPByID[mpID]
	history := store.RollcallsByMP[mpID]
	if len(history) == 0 {
		if mp != nil && mp.FactionID != "" {
			return mp.FactionID
		}
		return "ind"
	}

	var beforeBest *data.MPVoteHistory
	for i := range history {
		h := &history[i]
		if h.VoteDate <= voteDate {
			if beforeBest == nil || h.VoteDate > beforeBest.VoteDate {
				beforeBest = h
			}
		}
	}
	if beforeBest != nil && beforeBest.Record.FactionID != "" {
		return beforeBest.Record.FactionID
	}

	var afterBest *data.MPVoteHistory
	for i := range history {
		h := &history[i]
		if h.VoteDate > voteDate {
			if afterBest == nil || h.VoteDate < afterBest.VoteDate {
				afterBest = h
			}
		}
	}
	if afterBest != nil && afterBest.Record.FactionID != "" {
		return afterBest.Record.FactionID
	}

	if mp != nil && mp.FactionID != "" {
		return mp.FactionID
	}
	return "ind"
}

// sectorIndex returns the parliamentary sector sort order for political factions.
func sectorIndex(fid string) int {
	sectors := []string{"pro", "jv", "zzs", "as", "na", "lpv", "st", "ind"}
	for idx, s := range sectors {
		if strings.EqualFold(s, fid) {
			return idx
		}
	}
	return 99
}

type rawSeatCoord struct {
	angle  float64
	rowIdx int
	x      float64
	y      float64
}

// BuildHemicycleSeats constructs the 100 chamber seat positions for a vote.
func BuildHemicycleSeats(store *data.Store, v *data.Vote) []HemicycleSeat {
	if v.IsSecret {
		return nil
	}

	// 1. Calculate 100 semi-circular coordinates across 4 concentric arcs
	// Distribution: [18, 24, 28, 30] = 100 seats
	rowSpecs := []struct {
		radius float64
		count  int
	}{
		{radius: 130, count: 18},
		{radius: 180, count: 24},
		{radius: 230, count: 28},
		{radius: 280, count: 30},
	}
	centerX := 320.0
	centerY := 295.0

	var coords []rawSeatCoord
	for rowIdx, spec := range rowSpecs {
		angleStep := math.Pi / float64(spec.count+1)
		for i := 1; i <= spec.count; i++ {
			angle := math.Pi - float64(i)*angleStep
			x := math.Round((centerX+spec.radius*math.Cos(angle))*10) / 10
			y := math.Round((centerY-spec.radius*math.Sin(angle))*10) / 10
			coords = append(coords, rawSeatCoord{
				angle:  angle,
				rowIdx: rowIdx,
				x:      x,
				y:      y,
			})
		}
	}

	// Sort polar angle descending so MPs flow sector-by-sector from chamber left to right
	sort.Slice(coords, func(i, j int) bool {
		if coords[i].angle != coords[j].angle {
			return coords[i].angle > coords[j].angle
		}
		return coords[i].rowIdx < coords[j].rowIdx
	})

	// 2. Resolve active deputies on sitting date
	isoDate, _ := data.ParseSittingDate(v.SittingDate)
	activeIDs := store.ActiveDeputiesOnDate(isoDate)

	type activeDeputyInfo struct {
		mp        *data.MP
		factionID string
		decision  string
	}

	var activeList []activeDeputyInfo
	voteRollcallMap := store.RollcallByVoteAndMP[v.ID]

	for _, mpID := range activeIDs {
		mp := store.MPByID[mpID]
		if mp == nil {
			continue
		}

		decision := "NEBALSO"
		factionID := ""

		if voteRollcallMap != nil {
			if rec, found := voteRollcallMap[mpID]; found {
				decision = rec.Decision
				factionID = rec.FactionID
			}
		}

		if factionID == "" {
			factionID = ResolveMPFactionOnDate(store, mpID, isoDate)
		}

		activeList = append(activeList, activeDeputyInfo{
			mp:        mp,
			factionID: factionID,
			decision:  decision,
		})
	}

	// Sort active deputies into political sectors (Left -> Right) and seat number
	sort.Slice(activeList, func(i, j int) bool {
		sI := sectorIndex(activeList[i].factionID)
		sJ := sectorIndex(activeList[j].factionID)
		if sI != sJ {
			return sI < sJ
		}
		return activeList[i].mp.SeatNumber < activeList[j].mp.SeatNumber
	})

	// 3. Map active deputies to coordinate seats
	var seats []HemicycleSeat
	for i, coord := range coords {
		if i >= len(activeList) {
			break
		}
		dep := activeList[i]
		fMeta := store.FactionByID[dep.factionID]

		fShort := dep.factionID
		fColor := "#64748B"
		if fMeta != nil {
			if fMeta.ShortName != "" {
				fShort = fMeta.ShortName
			}
			if fMeta.Color != "" {
				fColor = fMeta.Color
			}
		}

		slug := dep.mp.Slug
		if slug == "" {
			slug = dep.mp.ID
		}

		seats = append(seats, HemicycleSeat{
			MpID:         dep.mp.ID,
			Name:         dep.mp.Name,
			Slug:         slug,
			FactionID:    dep.factionID,
			FactionShort: fShort,
			FactionColor: fColor,
			Decision:     dep.decision,
			Color:        DecisionColor(dep.decision),
			ChamberSeat:  i + 1,
			X:            coord.x,
			Y:            coord.y,
		})
	}

	return seats
}

// FormatPct formats float percentages nicely with 1 decimal place or integer.
func FormatPct(v float64) string {
	if v == math.Floor(v) {
		return fmt.Sprintf("%.0f", v)
	}
	return fmt.Sprintf("%.1f", v)
}

// LayoutProps defines metadata and navigation state for base layout.
type LayoutProps struct {
	Title        string
	Description  string
	CanonicalURL string
	ActiveNav    string // "votes", "mps", "radars"
}

// NavLinkClass returns Tailwind classes for active vs inactive navbar links.
func NavLinkClass(isActive bool) string {
	if isActive {
		return "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 bg-slate-900 text-white shadow-2xs"
	}
	return "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
}


// OverviewProps defines props for the vote overview list page.
type OverviewProps struct {
	LayoutProps   LayoutProps
	Votes         []data.Vote
	Categories    []data.VoteCategory
	Store         *data.Store
	BillTimelines map[string]*stats.BillTimeline
}

// VoteProps defines props for individual vote permalinks with hemicycle.
type VoteProps struct {
	LayoutProps LayoutProps
	Vote        *data.Vote
	Seats       []HemicycleSeat
	BillSlug    string
	Store       *data.Store
}

// BillProps defines props for bill progression timeline pages.
type BillProps struct {
	LayoutProps LayoutProps
	Timeline    *stats.BillTimeline
	Store       *data.Store
}

// MPProps defines props for MP dossiers.
type MPProps struct {
	LayoutProps LayoutProps
	MP          *data.MP
	Mandate     *data.Mandate
	Faction     *data.Faction
	Attendance  stats.AttendanceStats
	Cohesion    stats.CohesionStats
	History     []data.MPVoteHistory
	Store       *data.Store
}

// MPDirectoryItem holds an MP entry for the directory listing.
type MPDirectoryItem struct {
	MP         *data.MP
	Mandate    *data.Mandate
	Faction    *data.Faction
	Attendance stats.AttendanceStats
	Cohesion   stats.CohesionStats
}

// MPDirectoryProps defines props for the /deputati/ index page.
type MPDirectoryProps struct {
	LayoutProps LayoutProps
	Items       []MPDirectoryItem
	Factions    []data.Faction
	Store       *data.Store
}


