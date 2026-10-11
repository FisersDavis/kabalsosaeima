package stats

import (
	"regexp"
	"sort"
	"strings"

	"github.com/FisersDavis/kabalsosaeima/internal/data"
)

var nonAlphanumericRegex = regexp.MustCompile(`[^a-z0-9]+`)

// CleanBillSlug converts a Saeima bill number like "1149/Lp14" or "Nr. 56/Lp14"
// to a clean ASCII URL slug: "1149-lp14" or "56-lp14".
func CleanBillSlug(billNumber string) string {
	s := strings.TrimSpace(billNumber)
	s = strings.TrimPrefix(s, "Nr.")
	s = strings.TrimPrefix(s, "#")
	s = strings.TrimSpace(s)
	s = strings.ToLower(s)
	s = strings.ReplaceAll(s, "/", "-")
	s = nonAlphanumericRegex.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

// BillStage groups votes in a particular plenary sitting date and legislative stage.
type BillStage struct {
	SittingDate string       `json:"sittingDate"` // e.g., "12.02.2026"
	StageName   string       `json:"stageName"`   // e.g., "3. lasījums (galīgais)", "2. lasījums", "Priekšlikumu izskatīšana"
	Reading     *int         `json:"reading"`     // 1, 2, 3 or nil
	Votes       []*data.Vote `json:"votes"`       // Votes in this stage, sorted chronologically
	Amendments  []*data.Vote `json:"amendments"`  // Specific amendments/priekšlikumi in this stage
}

// BillTimeline represents the progression of a legislative bill over plenary sittings.
type BillTimeline struct {
	BillNumber string       `json:"billNumber"` // Raw bill number, e.g. "1149/Lp14"
	Slug       string       `json:"slug"`       // URL slug, e.g. "1149-lp14"
	Title      string       `json:"title"`      // Canonical bill title
	Stages     []*BillStage `json:"stages"`     // Chronologically ordered stages
	TotalVotes int          `json:"totalVotes"` // Count of all votes related to this bill
}

// GroupBillTimelines scans all votes in the store and groups them by bill number,
// organizing them chronologically by plenary sitting sessions.
func GroupBillTimelines(store *data.Store) map[string]*BillTimeline {
	timelines := make(map[string]*BillTimeline)

	for i := range store.Votes {
		v := &store.Votes[i]
		if strings.TrimSpace(v.BillNumber) == "" {
			continue
		}

		bNum := strings.TrimSpace(v.BillNumber)
		bt, exists := timelines[bNum]
		if !exists {
			title := v.SimplifiedTitle
			if title == "" {
				title = v.OfficialTitle
			}
			bt = &BillTimeline{
				BillNumber: bNum,
				Slug:       CleanBillSlug(bNum),
				Title:      title,
			}
			timelines[bNum] = bt
		}

		bt.TotalVotes++

		// Find or create stage for this sitting date
		sittingDate := strings.TrimSpace(v.SittingDate)
		var targetStage *BillStage
		for _, st := range bt.Stages {
			if st.SittingDate == sittingDate {
				targetStage = st
				break
			}
		}
		if targetStage == nil {
			targetStage = &BillStage{
				SittingDate: sittingDate,
				StageName:   v.ReadingStage,
				Reading:     v.Reading,
			}
			bt.Stages = append(bt.Stages, targetStage)
		}

		targetStage.Votes = append(targetStage.Votes, v)
		if v.VoteType == "priekslikums" || strings.Contains(strings.ToLower(v.OfficialTitle), "priekšlikum") {
			targetStage.Amendments = append(targetStage.Amendments, v)
		}
	}

	// For each bill and each stage, determine the best descriptive StageName and sort chronologically
	for _, bt := range timelines {
		for _, st := range bt.Stages {
			// Sort votes inside stage chronologically: proposals first, then adoption votes
			sort.SliceStable(st.Votes, func(i, j int) bool {
				vi := st.Votes[i]
				vj := st.Votes[j]
				if vi.SittingTime != vj.SittingTime {
					return vi.SittingTime < vj.SittingTime
				}
				// If same minute, priekslikums comes before likums
				if vi.VoteType == "priekslikums" && vj.VoteType != "priekslikums" {
					return true
				}
				if vj.VoteType == "priekslikums" && vi.VoteType != "priekslikums" {
					return false
				}
				return vi.ID < vj.ID
			})

			// Determine canonical StageName for this sitting
			var hasFinal, has2nd, has1st, hasAmend bool
			for _, v := range st.Votes {
				if v.Reading != nil {
					st.Reading = v.Reading
				}
				if strings.Contains(strings.ToLower(v.ReadingStage), "3. las") || strings.Contains(strings.ToLower(v.ReadingStage), "galīg") {
					hasFinal = true
				} else if strings.Contains(strings.ToLower(v.ReadingStage), "2. las") {
					has2nd = true
				} else if strings.Contains(strings.ToLower(v.ReadingStage), "1. las") {
					has1st = true
				}
				if v.VoteType == "priekslikums" || strings.Contains(strings.ToLower(v.OfficialTitle), "priekšlikum") {
					hasAmend = true
				}
			}

			if hasFinal {
				if hasAmend {
					st.StageName = "3. lasījums (priekšlikumi un galīgais lēmums)"
				} else {
					st.StageName = "3. lasījums (galīgais)"
				}
			} else if has2nd {
				if hasAmend {
					st.StageName = "2. lasījums (priekšlikumi un balsojums)"
				} else {
					st.StageName = "2. lasījums"
				}
			} else if has1st {
				st.StageName = "1. lasījums"
			} else if hasAmend {
				st.StageName = "Priekšlikumu izskatīšana"
			} else if len(st.Votes) > 0 && st.Votes[len(st.Votes)-1].ReadingStage != "" {
				st.StageName = st.Votes[len(st.Votes)-1].ReadingStage
			} else {
				st.StageName = "Plenārsēdes balsojumi"
			}
		}

		// Sort stages chronologically by SittingDate
		sort.SliceStable(bt.Stages, func(i, j int) bool {
			di, _ := data.ParseSittingDate(bt.Stages[i].SittingDate)
			dj, _ := data.ParseSittingDate(bt.Stages[j].SittingDate)
			return di < dj
		})
	}

	return timelines
}

func fmtStageReading(reading int) string {
	switch reading {
	case 1:
		return "1. lasījums"
	case 2:
		return "2. lasījums"
	case 3:
		return "3. lasījums"
	default:
		return "Lasījums"
	}
}

