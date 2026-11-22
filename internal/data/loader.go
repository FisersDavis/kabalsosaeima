package data

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Store holds the pre-parsed, indexed dataset for the SSG.
type Store struct {
	Votes           []Vote
	MPs             []MP
	Mandates        []Mandate
	Factions        []Faction
	Metadata        SiteMetadata
	Rollcalls       map[string][]RollcallRecord // keyed by voteID

	// Indexed lookup maps
	VoteByID        map[string]*Vote
	MPByID          map[string]*MP
	MPBySaeimaID    map[string]*MP
	MPBySlug        map[string]*MP
	MandateByMpID   map[string]*Mandate
	FactionByID     map[string]*Faction

	// Relations: voteID -> mpID -> RollcallRecord
	RollcallByVoteAndMP map[string]map[string]*RollcallRecord
	// Historical rollcalls for an MP, sorted chronologically: mpID -> list of (VoteDate, RollcallRecord)
	RollcallsByMP   map[string][]MPVoteHistory
}

// MPVoteHistory associates a rollcall record with its vote sitting date.
type MPVoteHistory struct {
	VoteID      string
	VoteDate    string // YYYY-MM-DD
	SittingDate string // DD.MM.YYYY
	Record      RollcallRecord
}

// ParseSittingDate converts Latvian format "DD.MM.YYYY" to ISO "YYYY-MM-DD".
func ParseSittingDate(sittingDate string) (string, error) {
	sittingDate = strings.TrimSpace(sittingDate)
	parts := strings.Split(sittingDate, ".")
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid sitting date format: %q", sittingDate)
	}
	day := strings.TrimSpace(parts[0])
	month := strings.TrimSpace(parts[1])
	year := strings.TrimSpace(parts[2])

	if len(day) == 1 {
		day = "0" + day
	}
	if len(month) == 1 {
		month = "0" + month
	}
	iso := fmt.Sprintf("%s-%s-%s", year, month, day)
	if _, err := time.Parse("2006-01-02", iso); err != nil {
		return "", fmt.Errorf("invalid sitting date value: %q (%w)", sittingDate, err)
	}
	return iso, nil
}

// Load loads all JSON data from dataDir and indexes it once.
func Load(dataDir string) (*Store, error) {
	s := &Store{
		Rollcalls:           make(map[string][]RollcallRecord),
		VoteByID:            make(map[string]*Vote),
		MPByID:              make(map[string]*MP),
		MPBySaeimaID:        make(map[string]*MP),
		MPBySlug:            make(map[string]*MP),
		MandateByMpID:       make(map[string]*Mandate),
		FactionByID:         make(map[string]*Faction),
		RollcallByVoteAndMP: make(map[string]map[string]*RollcallRecord),
		RollcallsByMP:       make(map[string][]MPVoteHistory),
	}

	// 1. Load mps.json
	mpsPath := filepath.Join(dataDir, "mps.json")
	mpsBytes, err := os.ReadFile(mpsPath)
	if err != nil {
		return nil, fmt.Errorf("reading mps.json: %w", err)
	}
	if err := json.Unmarshal(mpsBytes, &s.MPs); err != nil {
		return nil, fmt.Errorf("unmarshaling mps.json: %w", err)
	}
	for i := range s.MPs {
		mp := &s.MPs[i]
		s.MPByID[mp.ID] = mp
		if mp.SaeimaID != "" {
			s.MPBySaeimaID[mp.SaeimaID] = mp
		}
		if mp.Slug != "" {
			s.MPBySlug[mp.Slug] = mp
		}
	}

	// 2. Load mandates.json
	mandatesPath := filepath.Join(dataDir, "mandates.json")
	mandatesBytes, err := os.ReadFile(mandatesPath)
	if err != nil {
		return nil, fmt.Errorf("reading mandates.json: %w", err)
	}
	if err := json.Unmarshal(mandatesBytes, &s.Mandates); err != nil {
		return nil, fmt.Errorf("unmarshaling mandates.json: %w", err)
	}
	for i := range s.Mandates {
		m := &s.Mandates[i]
		s.MandateByMpID[m.MpID] = m
	}

	// 3. Load factions.json (if present)
	factionsPath := filepath.Join(dataDir, "factions.json")
	if factionsBytes, err := os.ReadFile(factionsPath); err == nil {
		if err := json.Unmarshal(factionsBytes, &s.Factions); err != nil {
			return nil, fmt.Errorf("unmarshaling factions.json: %w", err)
		}
		for i := range s.Factions {
			f := &s.Factions[i]
			s.FactionByID[f.ID] = f
		}
	}

	// 4. Load votes.json
	votesPath := filepath.Join(dataDir, "votes.json")
	votesBytes, err := os.ReadFile(votesPath)
	if err != nil {
		return nil, fmt.Errorf("reading votes.json: %w", err)
	}
	if err := json.Unmarshal(votesBytes, &s.Votes); err != nil {
		return nil, fmt.Errorf("unmarshaling votes.json: %w", err)
	}
	// Sort votes chronologically descending by (SittingDate ISO DESC, SittingTime DESC, ID DESC)
	sort.SliceStable(s.Votes, func(i, j int) bool {
		di, _ := ParseSittingDate(s.Votes[i].SittingDate)
		dj, _ := ParseSittingDate(s.Votes[j].SittingDate)
		if di != dj {
			return di > dj
		}
		if s.Votes[i].SittingTime != s.Votes[j].SittingTime {
			return s.Votes[i].SittingTime > s.Votes[j].SittingTime
		}
		return s.Votes[i].ID > s.Votes[j].ID
	})
	for i := range s.Votes {
		v := &s.Votes[i]
		s.VoteByID[v.ID] = v
	}

	// 4b. Load metadata.json (if present) and populate fallbacks
	metaPath := filepath.Join(dataDir, "metadata.json")
	if metaBytes, err := os.ReadFile(metaPath); err == nil {
		_ = json.Unmarshal(metaBytes, &s.Metadata)
	}
	s.Metadata.TotalVotes = len(s.Votes)
	if s.Metadata.SaeimaTerm == 0 {
		s.Metadata.SaeimaTerm = 14
	}
	if len(s.Votes) > 0 && s.Metadata.LatestSittingDate == "" {
		s.Metadata.LatestSittingDate = s.Votes[0].SittingDate
	}
	if s.Metadata.FormattedSyncDate == "" {
		s.Metadata.FormattedSyncDate = s.Metadata.LatestSittingDate
	}

	// 5. Load rollcalls
	rollcallsDir := filepath.Join(dataDir, "rollcalls")
	for _, v := range s.Votes {
		if v.IsSecret {
			continue
		}
		rcPath := filepath.Join(rollcallsDir, v.ID+".json")
		rcBytes, err := os.ReadFile(rcPath)
		if err != nil {
			return nil, fmt.Errorf("reading rollcall for vote %s: %w", v.ID, err)
		}
		var records []RollcallRecord
		if err := json.Unmarshal(rcBytes, &records); err != nil {
			return nil, fmt.Errorf("unmarshaling rollcall for vote %s: %w", v.ID, err)
		}
		s.Rollcalls[v.ID] = records

		mpMap := make(map[string]*RollcallRecord, len(records))
		isoDate, _ := ParseSittingDate(v.SittingDate)

		for j := range records {
			rec := records[j]
			mpMap[rec.MpID] = &records[j]

			s.RollcallsByMP[rec.MpID] = append(s.RollcallsByMP[rec.MpID], MPVoteHistory{
				VoteID:      v.ID,
				VoteDate:    isoDate,
				SittingDate: v.SittingDate,
				Record:      rec,
			})
		}
		s.RollcallByVoteAndMP[v.ID] = mpMap
	}

	return s, nil
}
