package data

import (
	"fmt"
	"sort"
	"strings"
)

// ValidationError represents an invariant violation in the dataset.
type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// IsActiveOnDate checks if an MP holds an active mandate on the given ISO date (YYYY-MM-DD).
// Invariant: from <= voteDate < to (to == nil or empty means open-ended/active).
func (m *Mandate) IsActiveOnDate(isoDate string) bool {
	for _, iv := range m.Active {
		if iv.From <= isoDate {
			if iv.To == nil || *iv.To == "" || isoDate < *iv.To {
				return true
			}
		}
	}
	return false
}

// ActiveDeputiesOnDate returns the list of MP IDs holding active mandates on the given ISO date.
func (s *Store) ActiveDeputiesOnDate(isoDate string) []string {
	var active []string
	for _, m := range s.Mandates {
		if m.IsActiveOnDate(isoDate) {
			active = append(active, m.MpID)
		}
	}
	sort.Strings(active)
	return active
}

// Validate checks all core chamber size, mandate, and rollcall invariants.
// Invariant rules:
// 1. Ceiling Invariant: Active mandates > 100 on ANY vote date fails immediately (fatal error).
// 2. Floor Invariant: Active mandates < 100 emits a notice/warning.
// 3. Rollcall Participation: Every mpId voting in a rollcall must hold an active mandate on that sitting date.
// 4. Secret Ballots: Votes with isSecret: true do not require rollcall files.
// 5. MPs and Mandates must match 1:1 on mpId and saeimaId.
func (s *Store) Validate() ([]string, error) {
	var warnings []string

	// 1. Verify MPs and Mandates alignment
	if len(s.MPs) != len(s.Mandates) {
		warnings = append(warnings, fmt.Sprintf("MP count (%d) does not match Mandates count (%d)", len(s.MPs), len(s.Mandates)))
	}

	mandateBySaeimaID := make(map[string]*Mandate, len(s.Mandates))
	for i := range s.Mandates {
		m := &s.Mandates[i]
		if m.SaeimaID != "" {
			mandateBySaeimaID[strings.ToUpper(m.SaeimaID)] = m
		}
	}

	for _, mp := range s.MPs {
		if mp.ID == "" {
			return warnings, &ValidationError{Message: fmt.Sprintf("MP missing ID: %+v", mp)}
		}
		if mp.SaeimaID == "" {
			return warnings, &ValidationError{Message: fmt.Sprintf("MP %s missing saeimaId", mp.ID)}
		}
		if mp.Slug == "" {
			return warnings, &ValidationError{Message: fmt.Sprintf("MP %s missing slug", mp.ID)}
		}
		m, ok := mandateBySaeimaID[strings.ToUpper(mp.SaeimaID)]
		if !ok {
			return warnings, &ValidationError{Message: fmt.Sprintf("MP %s (%s) has no corresponding mandate in mandates.json for saeimaId %s", mp.ID, mp.Name, mp.SaeimaID)}
		}
		if !strings.EqualFold(m.Name, mp.Name) {
			warnings = append(warnings, fmt.Sprintf("MP %s name slight discrepancy: mps.json has %q, mandates.json has %q", mp.ID, mp.Name, m.Name))
		}
	}

	// 2. Collect unique sitting dates across all votes
	dateVotes := make(map[string][]string) // isoDate -> list of voteIDs
	for _, v := range s.Votes {
		isoDate, err := ParseSittingDate(v.SittingDate)
		if err != nil {
			return warnings, &ValidationError{Message: fmt.Sprintf("vote %s invalid sittingDate: %v", v.ID, err)}
		}
		dateVotes[isoDate] = append(dateVotes[isoDate], v.ID)
	}

	// 3. Validate Chamber Size Invariant per vote sitting date
	for isoDate := range dateVotes {
		active := s.ActiveDeputiesOnDate(isoDate)
		count := len(active)
		if count > 100 {
			return warnings, &ValidationError{
				Message: fmt.Sprintf("CEILING INVARIANT VIOLATION: %d active mandates on %s (>100)", count, isoDate),
			}
		}
		if count < 100 {
			warnings = append(warnings, fmt.Sprintf("FLOOR NOTICE: %d active mandates on %s (<100 vacancies present)", count, isoDate))
		}
	}

	// 4. Validate Rollcalls: Participation and Secret Ballots
	for _, v := range s.Votes {
		if v.IsSecret {
			if _, exists := s.Rollcalls[v.ID]; exists {
				warnings = append(warnings, fmt.Sprintf("Secret vote %s unexpectedly has rollcall records", v.ID))
			}
			continue
		}

		records, exists := s.Rollcalls[v.ID]
		if !exists {
			return warnings, &ValidationError{
				Message: fmt.Sprintf("Non-secret vote %s missing rollcall records", v.ID),
			}
		}

		isoDate, _ := ParseSittingDate(v.SittingDate)

		for _, rec := range records {
			m, ok := s.MandateByMpID[rec.MpID]
			if !ok {
				return warnings, &ValidationError{
					Message: fmt.Sprintf("Rollcall for vote %s contains unknown mpId %s", v.ID, rec.MpID),
				}
			}
			if !m.IsActiveOnDate(isoDate) {
				return warnings, &ValidationError{
					Message: fmt.Sprintf("ROLLCALL PARTICIPATION INVARIANT VIOLATION: MP %s (%s) voted on %s in vote %s without active mandate",
						rec.MpID, rec.Name, isoDate, v.ID),
				}
			}
		}
	}

	return warnings, nil
}
