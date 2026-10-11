package data

// MandateInterval represents a deputy's period of active service.
type MandateInterval struct {
	From string  `json:"from"`
	To   *string `json:"to"`
}

// Mandate represents official mandate timeline and provenance for an MP.
type Mandate struct {
	MpID     string            `json:"mpId"`
	SaeimaID string            `json:"saeimaId"`
	Name     string            `json:"name"`
	Slug     string            `json:"slug"`
	Active   []MandateInterval `json:"active"`
	Note     string            `json:"note"`
	Source   string            `json:"source"`
	FetchedAt string           `json:"fetchedAt"`
}

// MP represents a member of parliament from mps.json.
type MP struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	FactionID  string `json:"factionId"`
	SeatNumber int    `json:"seatNumber"`
	Row        int    `json:"row"`
	Col        int    `json:"col"`
	IsActive   bool   `json:"isActive"`
	SaeimaID   string `json:"saeimaId"`
	Slug       string `json:"slug"`
}

// VoteCategory represents the taxonomy metadata of a vote.
type VoteCategory struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

// VoteCounts holds the aggregate vote tally.
type VoteCounts struct {
	Par          int `json:"par"`
	Pret         int `json:"pret"`
	Atturas      int `json:"atturas"`
	Nebalso      int `json:"nebalso"`
	TotalPresent int `json:"totalPresent"`
}

// FactionVotes holds the vote counts broken down for a faction.
type FactionVotes struct {
	Par     int `json:"par"`
	Pret    int `json:"pret"`
	Atturas int `json:"atturas"`
	Nebalso int `json:"nebalso"`
}

// DeviatingMP represents a deputy voting against the majority faction line.
type DeviatingMP struct {
	MpID        string `json:"mpId"`
	Name        string `json:"name"`
	Decision    string `json:"decision"`
	FactionLine string `json:"factionLine"`
}

// FactionBreakdown represents a faction's aggregated stance on a vote.
type FactionBreakdown struct {
	FactionID    string        `json:"factionId"`
	Name         string        `json:"name"`
	ShortName    string        `json:"shortName"`
	Color        string        `json:"color"`
	Votes        FactionVotes  `json:"votes"`
	DeviatingMps []DeviatingMP `json:"deviatingMps"`
}

// Vote represents a plenary vote from votes.json.
type Vote struct {
	ID              string             `json:"id"`
	SaeimaTerm      int                `json:"saeimaTerm"`
	SessionDate     string             `json:"sessionDate"`
	SittingDate     string             `json:"sittingDate"`
	SittingTime     string             `json:"sittingTime"`
	SittingType     string             `json:"sittingType"`
	Reading         *int               `json:"reading"`
	IsUrgent        bool               `json:"isUrgent"`
	IsTier1         bool               `json:"isTier1"`
	VoteType        string             `json:"voteType"`
	ReadingStage    string             `json:"readingStage"`
	IsSecret        bool               `json:"isSecret"`
	IsRevote        bool               `json:"isRevote"`
	OfficialTitle   string             `json:"officialTitle"`
	BillNumber      string             `json:"billNumber"`
	SimplifiedTitle string             `json:"simplifiedTitle"`
	Summary         string             `json:"summary"`
	Purpose         string             `json:"purpose"`
	ProtocolURL     string             `json:"protocolUrl"`
	Category        VoteCategory       `json:"category"`
	Result          string             `json:"result"`
	Counts          VoteCounts         `json:"counts"`
	FactionBreakdown []FactionBreakdown `json:"factionBreakdown"`
}

// RollcallRecord represents an MP's individual vote in a rollcall file.
type RollcallRecord struct {
	MpID      string `json:"mpId"`
	Name      string `json:"name"`
	FactionID string `json:"factionId"`
	Decision  string `json:"decision"` // PAR, PRET, ATTURAS, NEBALSO, etc.
}

// Faction represents metadata from factions.json.
type Faction struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ShortName string `json:"shortName"`
	Color     string `json:"color"`
}
