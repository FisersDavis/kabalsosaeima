package views

import (
	"encoding/json"
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

// DecisionBadgeClass returns Tailwind utility classes for decision labels.
func DecisionBadgeClass(decision string) string {
	switch strings.ToUpper(strings.TrimSpace(decision)) {
	case "PAR":
		return "text-emerald-800"
	case "PRET":
		return "text-rose-800"
	case "ATTURAS":
		return "text-amber-800"
	case "NEBALSO", "NEBALSOJA":
		return "text-neutral-500"
	default:
		return "text-neutral-500"
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

// ResultBadgeClass returns Tailwind utility classes for outcome labels.
func ResultBadgeClass(result string) string {
	switch result {
	case "PIENEMTS":
		return "text-emerald-800 bg-emerald-50/70 border-emerald-200/80"
	case "NAV_KVORUMA":
		return "text-amber-800 bg-amber-50/70 border-amber-200/80"
	case "NORAIDITS":
		return "text-rose-800 bg-rose-50/70 border-rose-200/80"
	default:
		return "text-neutral-700 bg-neutral-100 border-neutral-200"
	}
}

// ResultTextClass returns semantic text color class for clean typographic outcome labels.
func ResultTextClass(result string) string {
	switch result {
	case "PIENEMTS":
		return "text-emerald-800"
	case "NAV_KVORUMA":
		return "text-amber-800"
	case "NORAIDITS":
		return "text-rose-800"
	default:
		return "text-neutral-700"
	}
}

var lvMonthsShort = [...]string{
	"", "janv.", "febr.", "marts", "apr.", "maijs", "jūn.",
	"jūl.", "aug.", "sept.", "okt.", "nov.", "dec.",
}

var lvMonthsLong = [...]string{
	"", "janvāris", "februāris", "marts", "aprīlis", "maijs", "jūnijs",
	"jūlijs", "augusts", "septembris", "oktobris", "novembris", "decembris",
}

// FormatLatvianDate converts DD.MM.YYYY or YYYY-MM-DD into a crisp newspaper date (e.g. "20. nov. 2026").
func FormatLatvianDate(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	var day, month, year int
	if _, err := fmt.Sscanf(s, "%d.%d.%d", &day, &month, &year); err == nil && month >= 1 && month <= 12 && year > 1900 {
		return fmt.Sprintf("%d. %s %d", day, lvMonthsShort[month], year)
	}
	if _, err := fmt.Sscanf(s, "%d-%d-%d", &year, &month, &day); err == nil && month >= 1 && month <= 12 && year > 1900 {
		return fmt.Sprintf("%d. %s %d", day, lvMonthsShort[month], year)
	}
	return s
}

// FormatLatvianDateLong converts DD.MM.YYYY or YYYY-MM-DD into a full editorial dateline ("2026. gada 20. novembris").
func FormatLatvianDateLong(raw string) string {
	s := strings.TrimSpace(raw)
	if s == "" {
		return ""
	}
	var day, month, year int
	if _, err := fmt.Sscanf(s, "%d.%d.%d", &day, &month, &year); err == nil && month >= 1 && month <= 12 && year > 1900 {
		return fmt.Sprintf("%d. gada %d. %s", year, day, lvMonthsLong[month])
	}
	if _, err := fmt.Sscanf(s, "%d-%d-%d", &year, &month, &day); err == nil && month >= 1 && month <= 12 && year > 1900 {
		return fmt.Sprintf("%d. gada %d. %s", year, day, lvMonthsLong[month])
	}
	return s
}

// IsSameTitle returns true when officialTitle duplicates the cleaned H1 headline (ignoring trailing bill code).
func IsSameTitle(official, simplified string) bool {
	a := strings.ToLower(strings.TrimSpace(CleanVoteTitle(official)))
	b := strings.ToLower(strings.TrimSpace(CleanVoteTitle(simplified)))
	return a == "" || a == b
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

// FactionsCompactJSON returns a compact JSON object mapping factionID -> [shortName, name, color, textColor]
// so vote pages embed faction display metadata once instead of repeating it on every SVG seat and table row.
func FactionsCompactJSON(store *data.Store) string {
	if store == nil || len(store.Factions) == 0 {
		return "{}"
	}
	m := make(map[string][4]string, len(store.Factions))
	for _, f := range store.Factions {
		short := f.ShortName
		if short == "" {
			short = f.ID
		}
		name := f.Name
		if name == "" {
			name = "Pie frakcijām nepiederošs"
		}
		color := f.Color
		if color == "" {
			color = "#64748B"
		}
		m[f.ID] = [4]string{short, name, color, FactionTextColor(f.ID, f.TextColor)}
	}
	b, err := json.Marshal(m)
	if err != nil {
		return "{}"
	}
	return string(b)
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

// OrderedDebaters returns debaters ordered Par then Pret when explicit stances dominate,
// or preserves chronological order for general debates (e.g. Cabinet confidence votes).
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
	// If this is primarily a general debate without Par/Pret slots, keep original chronological speaking order
	if len(other) > len(par)+len(pret) {
		return args.Debaters
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
	Title         string
	Description   string
	CanonicalURL  string
	ActiveNav     string // "votes", "mps"
	Metadata      data.SiteMetadata
	TermNumber    int
	TermYears     string
	BasePath      string
	IsActiveTerm  bool
	ActiveMPCount int
	Terms         []TermNavItem
}

// EffectiveActiveMPCount returns the active deputy count badge value (defaults to 100).
func EffectiveActiveMPCount(lp LayoutProps) int {
	if lp.ActiveMPCount > 0 {
		return lp.ActiveMPCount
	}
	return 100
}

// IsLayoutTermActive reports whether the currently rendered parliamentary term is active (not archived).
func IsLayoutTermActive(lp LayoutProps) bool {
	if lp.IsActiveTerm {
		return true
	}
	if len(lp.Terms) > 0 {
		cur := ActiveTermNumber(lp)
		for _, t := range lp.Terms {
			if t.Term == cur {
				return t.IsActive
			}
		}
	}
	return lp.BasePath == ""
}

// DirectoryActiveCount counts how many items in an MP directory have IsActive == true.
func DirectoryActiveCount(items []MPDirectoryItem) int {
	n := 0
	for _, it := range items {
		if it.MP != nil && it.MP.IsActive {
			n++
		}
	}
	if n == 0 {
		return len(items)
	}
	return n
}

// IsConstitutionalAmendmentVote reports whether a vote is a final-reading Satversme amendment
// subject to Satversme Art. 76 (2/3 quorum = 67 MPs and 2/3 majority of present MPs).
func IsConstitutionalAmendmentVote(v *data.Vote) bool {
	if v == nil || v.VoteType != "likums" {
		return false
	}
	titleLow := strings.ToLower(v.OfficialTitle)
	if !strings.Contains(titleLow, "satversm") {
		return false
	}
	if !strings.Contains(titleLow, "grozījum") && !strings.Contains(titleLow, "likumprojekts") {
		return false
	}
	if v.Reading != nil && *v.Reading == 3 {
		return true
	}
	stageLow := strings.ToLower(v.ReadingStage)
	return strings.Contains(stageLow, "3. las") || strings.Contains(stageLow, "galīg")
}

// VoteQuorumThreshold returns the constitutional quorum requirement (67 for Satversme Art. 76, 50 for Art. 24).
func VoteQuorumThreshold(v *data.Vote) int {
	if IsConstitutionalAmendmentVote(v) {
		return 67
	}
	return 50
}

// NotFoundProps defines props for the 404.html error page.
type NotFoundProps struct {
	LayoutProps LayoutProps
}

// NavLinkClass returns Tailwind classes for active vs inactive navbar links.
func NavLinkClass(isActive bool) string {
	if isActive {
		return "inline-flex items-center gap-2 border-b-2 border-neutral-950 pb-2.5 text-sm font-semibold text-neutral-950 transition shrink-0"
	}
	return "inline-flex items-center gap-2 border-b-2 border-transparent pb-2.5 text-sm font-medium text-neutral-500 hover:text-neutral-950 hover:border-neutral-300 transition shrink-0"
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

// DebaterCardStyle holds pre-computed visual presentation metadata for a debater card.
type DebaterCardStyle struct {
	CardClass      string
	DotClass       string
	TitleClass     string
	BtnClass       string
	PrefixLabel    string
	MetaSubtitle   string
	VotePillText   string
	VotePillClass  string
	HasRealSpeech  bool
	CanExpand      bool
}

// isMetadataOnlyPreview detects legacy duration-only strings that are not actual speech quotes.
func isMetadataOnlyPreview(preview string) bool {
	p := strings.TrimSpace(preview)
	if p == "" {
		return true
	}
	low := strings.ToLower(p)
	return strings.Contains(low, "uzstāšanās ilgums") || low == "uzstājās debatēs saeimas sēdē."
}

// DebaterStyle returns honest visual presentation for a debater without mislabeling neutral debates as "Pret".
func DebaterStyle(deb data.Debater) DebaterCardStyle {
	var st DebaterCardStyle

	op := strings.TrimSpace(deb.Opinion)
	switch {
	case strings.EqualFold(op, "Par"):
		st.CardClass = "border-l-2 border-emerald-700 pl-4 py-1"
		st.DotClass = "bg-emerald-700"
		st.TitleClass = "text-neutral-950"
		st.BtnClass = "text-emerald-800 hover:text-neutral-950 underline underline-offset-2"
		st.PrefixLabel = `Runāja "Par":`
	case strings.EqualFold(op, "Pret"):
		st.CardClass = "border-l-2 border-rose-700 pl-4 py-1"
		st.DotClass = "bg-rose-700"
		st.TitleClass = "text-neutral-950"
		st.BtnClass = "text-rose-800 hover:text-neutral-950 underline underline-offset-2"
		st.PrefixLabel = `Runāja "Pret":`
	default:
		// General debate speaker: tint subtly by verified rollcall decision if available, else neutral rule
		switch strings.ToUpper(strings.TrimSpace(deb.VoteDecision)) {
		case "PAR":
			st.CardClass = "border-l-2 border-emerald-700/70 pl-4 py-1"
			st.DotClass = "bg-emerald-700"
			st.TitleClass = "text-neutral-950"
			st.BtnClass = "text-emerald-800 hover:text-neutral-950 underline underline-offset-2"
		case "PRET":
			st.CardClass = "border-l-2 border-rose-700/70 pl-4 py-1"
			st.DotClass = "bg-rose-700"
			st.TitleClass = "text-neutral-950"
			st.BtnClass = "text-rose-800 hover:text-neutral-950 underline underline-offset-2"
		default:
			st.CardClass = "border-l-2 border-neutral-300 pl-4 py-1"
			st.DotClass = "bg-neutral-500"
			st.TitleClass = "text-neutral-950"
			st.BtnClass = "text-neutral-700 hover:text-neutral-950 underline underline-offset-2"
		}
		st.PrefixLabel = "Debatēs:"
	}

	var metaParts []string
	if strings.TrimSpace(deb.Role) != "" {
		metaParts = append(metaParts, strings.TrimSpace(deb.Role))
	}
	if strings.TrimSpace(deb.Duration) != "" {
		metaParts = append(metaParts, "ilgums "+strings.TrimSpace(deb.Duration))
	}
	st.MetaSubtitle = strings.Join(metaParts, " · ")

	switch strings.ToUpper(strings.TrimSpace(deb.VoteDecision)) {
	case "PAR":
		st.VotePillText = "Balsoja PAR"
		st.VotePillClass = "text-emerald-800"
	case "PRET":
		st.VotePillText = "Balsoja PRET"
		st.VotePillClass = "text-rose-800"
	case "ATTURAS":
		st.VotePillText = "Atturējās"
		st.VotePillClass = "text-amber-800"
	}

	fullClean := strings.TrimSpace(deb.FullSpeech)
	prevClean := strings.TrimSpace(deb.Preview)
	st.HasRealSpeech = fullClean != "" || !isMetadataOnlyPreview(prevClean)
	st.CanExpand = fullClean != "" && fullClean != prevClean
	return st
}

// SpeechParagraphs splits a verbatim speech into clean non-empty paragraphs for readable rendering.
func SpeechParagraphs(text string) []string {
	raw := strings.TrimSpace(text)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, "\n\n")
	var out []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// KeyDebaters selects up to 2 contrasting debaters for feed cards, preferring speakers with real verbatim speeches.
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

	hasSpeech := func(d data.Debater) bool {
		return strings.TrimSpace(d.FullSpeech) != "" || !isMetadataOnlyPreview(d.Preview)
	}

	// Pass 1: explicit Par + Pret (preferring those with verbatim speeches)
	pickFirst := func(pred func(data.Debater) bool) *data.Debater {
		for i := range args.Debaters {
			if pred(args.Debaters[i]) && hasSpeech(args.Debaters[i]) {
				d := args.Debaters[i]
				return &d
			}
		}
		for i := range args.Debaters {
			if pred(args.Debaters[i]) {
				d := args.Debaters[i]
				return &d
			}
		}
		return nil
	}

	par := pickFirst(func(d data.Debater) bool {
		return strings.EqualFold(d.Opinion, "Par") && !strings.EqualFold(d.VoteDecision, "PRET")
	})
	pret := pickFirst(func(d data.Debater) bool {
		return strings.EqualFold(d.Opinion, "Pret") && !strings.EqualFold(d.VoteDecision, "PAR")
	})
	if par != nil && pret != nil {
		return []data.Debater{*par, *pret}
	}

	// Pass 2: general debate without explicit Par/Pret slots -> pick contrasting presenter/supporter vs opponent
	proSide := pickFirst(func(d data.Debater) bool {
		rLow := strings.ToLower(d.Role)
		return strings.Contains(rLow, "kandidāts") || strings.Contains(rLow, "referents")
	})
	if proSide == nil {
		proSide = par
	}
	if proSide == nil {
		proSide = pickFirst(func(d data.Debater) bool {
			return strings.EqualFold(d.VoteDecision, "PAR")
		})
	}
	conSide := pret
	if conSide == nil {
		conSide = pickFirst(func(d data.Debater) bool {
			return strings.EqualFold(d.VoteDecision, "PRET") && (proSide == nil || d.Name != proSide.Name)
		})
	}

	var res []data.Debater
	if proSide != nil {
		res = append(res, *proSide)
	}
	if conSide != nil {
		res = append(res, *conSide)
	}
	if len(res) == 2 {
		return res
	}

	// Fill up to 2 distinct speakers with speeches first
	for i := range args.Debaters {
		if len(res) >= 2 {
			break
		}
		d := args.Debaters[i]
		if !hasSpeech(d) {
			continue
		}
		dup := false
		for _, existing := range res {
			if existing.Name == d.Name {
				dup = true
				break
			}
		}
		if !dup {
			res = append(res, d)
		}
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

// SaeimaBillSearchURLForTerm returns a guaranteed-working official Titania LIVS registry URL
// for the right database (saeimalivs_lmp.nsf for Lm decisions, saeimalivs{term}.nsf for Lp bills).
func SaeimaBillSearchURLForTerm(term int, billNr string) string {
	if term <= 0 {
		term = 14
	}
	clean := strings.ToLower(CleanBillNr(billNr))
	if clean == "" {
		return fmt.Sprintf("https://titania.saeima.lv/LIVS%d/saeimalivs%d.nsf/webAll?OpenView", term, term)
	}
	if strings.Contains(clean, "/lm") {
		return fmt.Sprintf("https://titania.saeima.lv/LIVS%d/saeimalivs_lmp.nsf/webAll?OpenView", term)
	}
	return fmt.Sprintf("https://titania.saeima.lv/LIVS%d/saeimalivs%d.nsf/webAll?OpenView", term, term)
}

// SaeimaBillSearchURL generates an official Titania LIVS link for a bill or decision number.
func SaeimaBillSearchURL(billNr string) string {
	if strings.Contains(strings.ToLower(billNr), "15") {
		return SaeimaBillSearchURLForTerm(15, billNr)
	}
	return SaeimaBillSearchURLForTerm(14, billNr)
}

// VoteBillURL returns the direct official Titania document URL for a vote's bill/decision,
// falling back to the working LIVS registry view.
func VoteBillURL(v *data.Vote, fallbackTerm int) string {
	if v != nil && v.BillURL != "" {
		return v.BillURL
	}
	term := fallbackTerm
	if v != nil && v.SaeimaTerm > 0 {
		term = v.SaeimaTerm
	}
	billNr := ""
	if v != nil {
		billNr = v.BillNumber
	}
	return SaeimaBillSearchURLForTerm(term, billNr)
}

// SaeimaDeputiesRegistryURL returns the official saeima.lv deputy directory URL for the given term.
func SaeimaDeputiesRegistryURL(term int) string {
	if term <= 0 {
		term = 14
	}
	return fmt.Sprintf("https://www.saeima.lv/lv/sasaukumi/%d-saeima/deputati/", term)
}

// VoteProtocolURL returns the exact official Titania voting protocol URL, with guaranteed-working
// fallbacks to the sitting DK agenda/protocols page or official bill document (never a dead end).
func VoteProtocolURL(v data.Vote) string {
	if v.ProtocolURL != "" {
		return v.ProtocolURL
	}
	term := v.SaeimaTerm
	if term <= 0 {
		term = 14
	}
	dkDB := "SaeimaLIVS2_DK.nsf"
	if term >= 15 {
		dkDB = "saeimalivs2_dk.nsf"
	}
	if v.DkID != "" {
		return fmt.Sprintf("https://titania.saeima.lv/LIVS%d/%s/DK?ReadForm&nr=%s", term, dkDB, v.DkID)
	}
	if v.BillURL != "" {
		return v.BillURL
	}
	return fmt.Sprintf("https://titania.saeima.lv/LIVS%d/%s/DK?ReadForm&calendar=1", term, dkDB)
}

// VoteProtocolURLFromPtr returns VoteProtocolURL for a pointer to data.Vote.
func VoteProtocolURLFromPtr(v *data.Vote) string {
	if v == nil {
		return "https://titania.saeima.lv/LIVS15/saeimalivs2_dk.nsf/DK?ReadForm&calendar=1"
	}
	return VoteProtocolURL(*v)
}


