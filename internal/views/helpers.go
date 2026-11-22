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
	case "NEBALSO", "NEBALSOJA":
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
	MpID             string
	Name             string
	Slug             string
	FactionID        string
	FactionShort     string
	FactionName      string
	FactionColor     string
	FactionTextColor string
	Decision         string
	Color            string
	ChamberSeat      int
	X                float64
	Y                float64
	IsDeviating      bool
	FactionLine      string
}

// FactionTextColor returns readable foreground text color for a faction background.
func FactionTextColor(factionID string, customText string) string {
	if customText != "" {
		return customText
	}
	if strings.EqualFold(factionID, "as") {
		return "#713F12" // Dark warm brown on golden yellow
	}
	return "#ffffff" // White on dark backgrounds
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
	n := len(history)
	if n == 0 {
		if mp != nil && mp.FactionID != "" {
			return mp.FactionID
		}
		return "ind"
	}

	// Fast path: loader populates RollcallsByMP in descending VoteDate order -> O(log N) binary search
	if n == 1 || history[0].VoteDate >= history[n-1].VoteDate {
		// First index i where history[i].VoteDate <= voteDate (largest date <= voteDate)
		idx := sort.Search(n, func(i int) bool {
			return history[i].VoteDate <= voteDate
		})
		for i := idx; i < n; i++ {
			if history[i].Record.FactionID != "" {
				return history[i].Record.FactionID
			}
		}
		// Fallback: nearest vote after voteDate (smallest date > voteDate)
		for i := idx - 1; i >= 0; i-- {
			if history[i].Record.FactionID != "" {
				return history[i].Record.FactionID
			}
		}
	} else {
		// Unsorted fallback
		var beforeBest *data.MPVoteHistory
		for i := range history {
			h := &history[i]
			if h.VoteDate <= voteDate && (beforeBest == nil || h.VoteDate > beforeBest.VoteDate) {
				beforeBest = h
			}
		}
		if beforeBest != nil && beforeBest.Record.FactionID != "" {
			return beforeBest.Record.FactionID
		}
		var afterBest *data.MPVoteHistory
		for i := range history {
			h := &history[i]
			if h.VoteDate > voteDate && (afterBest == nil || h.VoteDate < afterBest.VoteDate) {
				afterBest = h
			}
		}
		if afterBest != nil && afterBest.Record.FactionID != "" {
			return afterBest.Record.FactionID
		}
	}

	if mp != nil && mp.FactionID != "" {
		return mp.FactionID
	}
	return "ind"
}

// sectorIndex returns the parliamentary sector sort order for political factions.
func sectorIndex(fid string) int {
	sectors := []string{"pro", "jv", "zzs", "as", "na", "lpv", "sv_aj", "st", "ind"}
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

	// Index deviating MPs for this vote
	deviatingMap := make(map[string]data.DeviatingMP)
	for _, fb := range v.FactionBreakdown {
		for _, d := range fb.DeviatingMps {
			deviatingMap[d.MpID] = d
		}
	}

	// 3. Map active deputies to coordinate seats
	var seats []HemicycleSeat
	for i, coord := range coords {
		if i >= len(activeList) {
			break
		}
		dep := activeList[i]
		fMeta := store.FactionByID[dep.factionID]

		fShort := dep.factionID
		fName := "Pie frakcijām nepiederošs"
		fColor := "#64748B"
		fTextColor := FactionTextColor(dep.factionID, "")
		if fMeta != nil {
			if fMeta.ShortName != "" {
				fShort = fMeta.ShortName
			}
			if fMeta.Name != "" {
				fName = fMeta.Name
			}
			if fMeta.Color != "" {
				fColor = fMeta.Color
			}
			fTextColor = FactionTextColor(dep.factionID, fMeta.TextColor)
		}

		slug := dep.mp.Slug
		if slug == "" {
			slug = dep.mp.ID
		}

		isDeviating := false
		factionLine := ""
		if dev, ok := deviatingMap[dep.mp.ID]; ok {
			isDeviating = true
			factionLine = dev.FactionLine
		}

		seats = append(seats, HemicycleSeat{
			MpID:             dep.mp.ID,
			Name:             dep.mp.Name,
			Slug:             slug,
			FactionID:        dep.factionID,
			FactionShort:     fShort,
			FactionName:      fName,
			FactionColor:     fColor,
			FactionTextColor: fTextColor,
			Decision:         dep.decision,
			Color:            DecisionColor(dep.decision),
			ChamberSeat:      i + 1,
			X:                coord.x,
			Y:                coord.y,
			IsDeviating:      isDeviating,
			FactionLine:      factionLine,
		})
	}

	return seats
}

// ResolveMPSlugByName looks up an MP's slug from store by exact name.
func ResolveMPSlugByName(store *data.Store, name string) string {
	if store != nil {
		cleanTarget := strings.TrimSpace(name)
		for _, mp := range store.MPs {
			if strings.EqualFold(strings.TrimSpace(mp.Name), cleanTarget) {
				if mp.Slug != "" {
					return mp.Slug
				}
				return mp.ID
			}
		}
	}
	return ""
}

// FormatVotesCount formats a count of votes with correct Latvian plural inflection.
func FormatVotesCount(count int) string {
	if count%10 == 1 && count%100 != 11 {
		return fmt.Sprintf("%d balsojums", count)
	}
	return fmt.Sprintf("%d balsojumi", count)
}

// AvatarInitials returns uppercase letters representing a person's first and last name initials.
func AvatarInitials(name string) string {
	parts := strings.Fields(strings.TrimSpace(name))
	if len(parts) >= 2 {
		r1, _ := utf8.DecodeRuneInString(parts[0])
		r2, _ := utf8.DecodeRuneInString(parts[len(parts)-1])
		return strings.ToUpper(string(r1) + string(r2))
	} else if len(parts) == 1 && len(parts[0]) > 0 {
		r, _ := utf8.DecodeRuneInString(parts[0])
		return strings.ToUpper(string(r))
	}
	return ""
}

// OrderedDebaters returns debaters with all "Par" speeches first, followed by "Pret" speeches.
func OrderedDebaters(args *data.DebateArguments) []data.Debater {
	if args == nil || !args.HasDebates || len(args.Debaters) == 0 {
		return nil
	}
	var par []data.Debater
	var pret []data.Debater
	var other []data.Debater
	for _, d := range args.Debaters {
		if strings.EqualFold(d.Opinion, "Par") {
			par = append(par, d)
		} else if strings.EqualFold(d.Opinion, "Pret") {
			pret = append(pret, d)
		} else {
			other = append(other, d)
		}
	}
	res := append(par, pret...)
	return append(res, other...)
}

// FormatPct formats float percentages nicely with 1 decimal place or integer.
func FormatPct(v float64) string {
	if v == math.Floor(v) {
		return fmt.Sprintf("%.0f", v)
	}
	return fmt.Sprintf("%.1f", v)
}

// IsFinalReadingVote returns true if a vote represents a final substantive adoption vote
// (3rd reading, urgent 2nd reading, or final reading stage).
func IsFinalReadingVote(v data.Vote) bool {
	if v.VoteType != "likums" {
		return false
	}
	if v.Reading != nil && *v.Reading == 3 {
		return true
	}
	if v.Reading != nil && *v.Reading == 2 && v.IsUrgent {
		return true
	}
	stage := strings.ToLower(v.ReadingStage)
	return strings.Contains(stage, "3. las") || strings.Contains(stage, "galīg") || strings.Contains(stage, "steidzam")
}

// TermNavItem represents a selectable Saeima parliamentary term in the header switcher.
type TermNavItem struct {
	Term     int
	Label    string
	Years    string
	BasePath string // "" for active root term, "/14-saeima" for archive term
	IsActive bool
}

// TermURL prefixes an internal absolute path with the term's BasePath.
func TermURL(basePath, path string) string {
	bp := strings.TrimRight(basePath, "/")
	if bp == "" {
		return path
	}
	if path == "" || path == "/" {
		return bp + "/"
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return bp + path
}

// ActiveTermNumber returns the effective Saeima term number (defaults to 14 if unset).
func ActiveTermNumber(lp LayoutProps) int {
	if lp.TermNumber > 0 {
		return lp.TermNumber
	}
	if lp.Metadata.SaeimaTerm > 0 {
		return lp.Metadata.SaeimaTerm
	}
	return 14
}

// ActiveTermYears returns the year range label for the current term.
func ActiveTermYears(lp LayoutProps) string {
	if lp.TermYears != "" {
		return lp.TermYears
	}
	if ActiveTermNumber(lp) == 15 {
		return "2026–2030"
	}
	return "2022–2026"
}

// LayoutProps defines metadata and navigation state for base layout.
type LayoutProps struct {
	Title        string
	Description  string
	CanonicalURL string
	ActiveNav    string // "votes", "mps"
	Metadata     data.SiteMetadata
	TermNumber   int
	TermYears    string
	BasePath     string
	Terms        []TermNavItem
}

// NavLinkClass returns Tailwind classes for active vs inactive navbar links.
func NavLinkClass(isActive bool) string {
	if isActive {
		return "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 bg-slate-900 text-white shadow-2xs"
	}
	return "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
}


// OverviewPageURL returns the URL for a given 1-indexed overview archive page.
func OverviewPageURL(basePath string, page int) string {
	if page <= 1 {
		return TermURL(basePath, "/")
	}
	return TermURL(basePath, fmt.Sprintf("/lapa/%d/", page))
}

// PaginationWindow returns a compact slice of page numbers with 0 representing an ellipsis.
func PaginationWindow(current, total int) []int {
	if total <= 7 {
		out := make([]int, total)
		for i := 1; i <= total; i++ {
			out[i-1] = i
		}
		return out
	}
	var out []int
	add := func(p int) {
		if len(out) == 0 || out[len(out)-1] != p {
			out = append(out, p)
		}
	}
	add(1)
	if current > 3 {
		out = append(out, 0)
	}
	for p := current - 1; p <= current+1; p++ {
		if p > 1 && p < total {
			add(p)
		}
	}
	if current < total-2 {
		out = append(out, 0)
	}
	add(total)
	return out
}

// CompactTimelineEntry pairs a stage label with a single vote for compact vote-page timeline previews.
type CompactTimelineEntry struct {
	StageName string
	Vote      *data.Vote
}

// CompactTimelineVotes caps inline bill timeline previews on vote detail pages to maxItems
// surrounding the current vote (avoiding duplicating 500+ budget amendments on every vote page).
func CompactTimelineVotes(tl *stats.BillTimeline, currentVoteID string, maxItems int) ([]CompactTimelineEntry, int) {
	if tl == nil {
		return nil, 0
	}
	var all []CompactTimelineEntry
	curIdx := -1
	for _, st := range tl.Stages {
		for _, v := range st.Votes {
			if v.ID == currentVoteID {
				curIdx = len(all)
			}
			all = append(all, CompactTimelineEntry{StageName: st.StageName, Vote: v})
		}
	}
	total := len(all)
	if maxItems <= 0 || total <= maxItems {
		return all, total
	}
	if curIdx < 0 {
		return all[:maxItems], total
	}
	half := maxItems / 2
	start := curIdx - half
	if start < 0 {
		start = 0
	}
	end := start + maxItems
	if end > total {
		end = total
		start = end - maxItems
		if start < 0 {
			start = 0
		}
	}
	return all[start:end], total
}

// OverviewProps defines props for the vote overview list page.
type OverviewProps struct {
	LayoutProps   LayoutProps
	Votes         []data.Vote
	Categories    []data.VoteCategory
	Store         *data.Store
	BillTimelines map[string]*stats.BillTimeline
	CurrentPage   int
	TotalPages    int
	TotalVotes    int
}

// VoteProps defines props for individual vote permalinks with hemicycle.
type VoteProps struct {
	LayoutProps LayoutProps
	Vote        *data.Vote
	Seats       []HemicycleSeat
	BillSlug    string
	Timeline    *stats.BillTimeline
	Store       *data.Store
}

// KeyDebaters selects up to 2 contrasting debaters (e.g. 1 Par and 1 Pret) for feed cards, ordered Par then Pret.
func KeyDebaters(args *data.DebateArguments) []data.Debater {
	if args == nil || !args.HasDebates || len(args.Debaters) == 0 {
		return nil
	}
	if len(args.Debaters) <= 2 {
		if len(args.Debaters) == 2 {
			if strings.EqualFold(args.Debaters[0].Opinion, "Pret") && strings.EqualFold(args.Debaters[1].Opinion, "Par") {
				return []data.Debater{args.Debaters[1], args.Debaters[0]}
			}
		}
		return args.Debaters
	}
	var par *data.Debater
	var pret *data.Debater
	for i := range args.Debaters {
		d := args.Debaters[i]
		if strings.EqualFold(d.Opinion, "Par") && par == nil {
			par = &d
		} else if strings.EqualFold(d.Opinion, "Pret") && pret == nil {
			pret = &d
		}
		if par != nil && pret != nil {
			break
		}
	}
	var res []data.Debater
	if par != nil {
		res = append(res, *par)
	}
	if pret != nil {
		res = append(res, *pret)
	}
	if len(res) == 0 {
		return args.Debaters[:2]
	}
	return res
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

// SaeimaBillSearchURLForTerm generates a direct search link to the Saeima LIVS database for a specific term.
func SaeimaBillSearchURLForTerm(term int, billNr string) string {
	clean := CleanBillNr(billNr)
	if clean == "" {
		return "https://www.saeima.lv/lv/likumdosana/"
	}
	if term >= 15 {
		return fmt.Sprintf("https://titania.saeima.lv/LIVS%d/saeimalivs%d.nsf/webAll?SearchView&Query=([Title]=*%s*)", term, term, clean)
	}
	return fmt.Sprintf("https://titania.saeima.lv/LIVS14/SaeimaLIVS2_DK.nsf/webAll?SearchView&Query=([Title]=*%s*)", clean)
}

// SaeimaBillSearchURL generates a direct search link to the Saeima legal database for a bill.
func SaeimaBillSearchURL(billNr string) string {
	if strings.Contains(strings.ToLower(billNr), "15") {
		return SaeimaBillSearchURLForTerm(15, billNr)
	}
	return SaeimaBillSearchURLForTerm(14, billNr)
}

// SaeimaDeputiesRegistryURL returns the official saeima.lv deputy directory URL for the given term.
func SaeimaDeputiesRegistryURL(term int) string {
	if term <= 0 {
		term = 14
	}
	return fmt.Sprintf("https://www.saeima.lv/lv/sasaukumi/%d-saeima/deputati/", term)
}

// VoteProtocolURL returns the official protocol URL, or an official bill search fallback.
func VoteProtocolURL(v data.Vote) string {
	if v.ProtocolURL != "" {
		return v.ProtocolURL
	}
	if v.BillNumber != "" {
		term := v.SaeimaTerm
		if term == 0 {
			term = 14
		}
		return SaeimaBillSearchURLForTerm(term, v.BillNumber)
	}
	return "https://www.saeima.lv/lv/likumdosana/"
}

// VoteProtocolURLFromPtr returns VoteProtocolURL for a pointer to data.Vote.
func VoteProtocolURLFromPtr(v *data.Vote) string {
	if v == nil {
		return "https://www.saeima.lv"
	}
	return VoteProtocolURL(*v)
}


