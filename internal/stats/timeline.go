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

// BillStage groups votes in a particular reading or procedural stage.
type BillStage struct {
	StageName  string       `json:"stageName"`  // e.g., "1. lasījums", "2. lasījums", "3. lasījums", "Priekšlikumi", "Procedūra"
	Reading    *int         `json:"reading"`    // 1, 2, 3 or nil
	Votes      []*data.Vote `json:"votes"`      // Votes in this stage, sorted chronologically
	Amendments []*data.Vote `json:"amendments"` // Specific amendments/priekšlikumi in this stage
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
// sorting votes chronologically within each bill progression.
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

		// Determine stage categorization
		stageName := v.ReadingStage
		if stageName == "" {
			if v.Reading != nil {
				stageName = fmtStageReading(*v.Reading)
			} else if v.VoteType == "priekslikums" {
				stageName = "Priekšlikumi"
			} else {
				stageName = "Procedūra"
			}
		}

		// Find or create stage
		var targetStage *BillStage
		for _, st := range bt.Stages {
			if st.StageName == stageName {
				targetStage = st
				break
			}
		}
		if targetStage == nil {
			targetStage = &BillStage{
				StageName: stageName,
				Reading:   v.Reading,
			}
			bt.Stages = append(bt.Stages, targetStage)
		}

		targetStage.Votes = append(targetStage.Votes, v)
		if v.VoteType == "priekslikums" || strings.Contains(strings.ToLower(v.OfficialTitle), "priekšlikum") {
			targetStage.Amendments = append(targetStage.Amendments, v)
		}
	}

	// Sort stages and votes chronologically
	for _, bt := range timelines {
		for _, st := range bt.Stages {
			sort.SliceStable(st.Votes, func(i, j int) bool {
				di, _ := data.ParseSittingDate(st.Votes[i].SittingDate)
				dj, _ := data.ParseSittingDate(st.Votes[j].SittingDate)
				if di != dj {
					return di < dj
				}
				return st.Votes[i].SittingTime < st.Votes[j].SittingTime
			})
			sort.SliceStable(st.Amendments, func(i, j int) bool {
				di, _ := data.ParseSittingDate(st.Amendments[i].SittingDate)
				dj, _ := data.ParseSittingDate(st.Amendments[j].SittingDate)
				if di != dj {
					return di < dj
				}
				return st.Amendments[i].SittingTime < st.Amendments[j].SittingTime
			})
		}
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
