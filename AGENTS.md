# Repository Guide & Operational Rules: Go Static Generator

## 1. Quick Reference & Core Commands
- **Module:** `github.com/FisersDavis/kabalsosaeima`
- **Runtime:** Go >= 1.24 (`CGO_ENABLED=0`), Git, Standalone Tailwind CLI (`tailwindcss.exe` / `tailwindcss`)
- **Tooling Directive:** Managed via `tool` directives in `go.mod`
- **Code Generation:** `go generate ./...` (runs `templ generate`)
- **Dev Watch Loop:** `templ generate --watch` (in one terminal)
- **Tailwind Compilation:** `./bin/tailwindcss -i assets/input.css -o dist/assets/styles.css --minify`
- **Build Full Site:** `go run ./cmd/build`
- **Validate Data Only:** `go run ./cmd/build --validate-only`
- **Typecheck & Vet:** `go vet ./...`
- **Run Tests:** `go test -v ./...`
- **Local Dev Server:** `go run ./cmd/serve` (serves `dist/` on localhost)

*Note: Always run `go generate ./...`, `go vet ./...`, and `go test -v ./...` before declaring any task complete.*

---

## 2. Architecture & File Layout

```text
cmd/
  ├── build/
  │   └── main.go          # SSG pipeline entrypoint (loads data, builds dist/)
  └── serve/
      └── main.go          # Minimal local dev file server for dist/
data/                      # Source of truth JSON data tracked in git
  ├── mps.json             # Saeima MP registry with official saeimaId
  ├── factions.json        # Faction metadata, colors, short names
  ├── votes.json           # Plenary sitting votes
  ├── mandates.json        # Official active mandate intervals: [{"mpId", "saeimaId", "active"}]
  ├── terms.json           # Saeima term definitions
  ├── metadata.json        # Dataset metadata and sync timestamps
  └── rollcalls/           # Per-vote MP votes: {"mpId", "name", "factionId", "decision"}
internal/
  ├── data/                # JSON loader, validation, indexing
  │   ├── models.go        # Strongly-typed Go structs
  │   ├── loader.go        # Parse & index once
  │   └── validate.go      # Mandate invariants & rollcall integrity assertions
  ├── stats/               # Pure business logic and metrics
  │   ├── cohesion.go      # Faction discipline (uses rollcall factionId at vote date)
  │   ├── attendance.go    # Attendance calculated ONLY over active mandate periods
  │   ├── timeline.go      # Bill stage grouping (1st, 2nd, 3rd reading progression)
  │   └── stats_test.go    # Stratified test (mp_summaries.json + hand-written cases)
  └── views/               # Templ component views
      ├── layout.templ     # HTML shell, metadata, CSS/JS links, legacy redirect script
      ├── overview.templ   # Pre-rendered feed (cards with data-attributes for show/hide)
      ├── bill.templ       # Bill progression timeline view
      ├── vote.templ       # Vote detail with accessible Hemicycle SVG (<title> + focusable)
      ├── mp.templ         # MP profile with dossier & active mandate denominator
      └── mp_directory.templ # MP directory table with faction & active mandate filters
assets/
  ├── input.css            # Tailwind v4 source with @source directives
  └── js/
      ├── filter.js        # Vanilla JS: shows/hides pre-rendered cards & syncs URL params
      └── redirect.js      # Forwards legacy React SPA hash/query URLs
```

---

## 3. Strict Coding Conventions

### Data Integrity & Mandate Rules
- **Mandates First:** `mandates.json` must pass validation before any stats calculations run:
  1. Active mandates on any vote date must be <= 100. Any date with >100 fails the build immediately. Dates <100 emit a warning.
  2. Every rollcall participant must hold an active mandate on that sitting date (`from <= voteDate < to`), unless exempted in `validate.go`'s `transitionExceptions` handover map.
  3. Votes with `isSecret: true` do not require a rollcall file.
- **Historical Faction Fidelity:**
  - An MP's faction for any vote MUST come from their row in that vote's rollcall (`rollcall.FactionID`).
  - For absent MPs on the Hemicycle, resolve their faction from their nearest rollcall on or before that vote date, then after, falling back to `mps.json` only if no rollcalls exist.

### Domain Math & UI Transparency
- **Honest Attendance Denominator:** An MP's attendance percentage is calculated *only* over votes that occurred during their active mandate intervals (`[from, to)`).
- **Neutral Mandate UI:** For suspended/ended mandates, display the neutral label `"Mandāts neaktīvs"` along with the free-text `note` (e.g. `"Mandāts neaktīvs (Ministre kopš 2022-12-14)"`).
- **Never compute domain logic in Templ:** All numbers must be pre-calculated in `internal/stats`.

### Single-Source UI, Clean URLs & Zero Redundant Indexes
- **Design Direction & Council Goal:** All UI/layout work must follow `DESIGN_BRIEF.md` (and visual anchors in `docs/references/`): aim for an authoritative newspaper-of-record aesthetic (*NYTimes × BBC × LSM.lv*), never a cluttered BI dashboard or dated government portal.
- **No `filter_index.json`:** Cards are pre-rendered into HTML by Templ with search data attributes (`data-title`, `data-category`, `data-faction-votes`, `data-stage`).
- `filter.js` queries the DOM directly, toggling `hidden` and syncing URL search params.
- **Clean ASCII URLs:**
  - Bill progressions: `/likumprojekti/{cleanBillSlug}/index.html` (e.g. `1149-lp14`).
  - Individual votes: `/balsojumi/{voteId}/index.html` (unique ASCII ID).
  - Deputies: `/deputati/{slug}/index.html` (clean lowercase ASCII name slug, e.g. `evika-silina`, with `mpId` fallback). All URL slugs must be clean lowercase ASCII with no diacritics.
- **Accessible Hemicycle:** Seats are wrapped in `<a href="/deputati/{slug}/">` with child `<title>` elements, focusable by default, accompanied by an off-screen plain seat list for screen-reader accessibility.

### Stratified Parity Testing
- **Continuous MPs:** For MPs who held a mandate uninterrupted for the whole term and remained in one faction, assert exact 1:1 match against `data/mp_summaries.json` (the golden output of `scripts/build_mp_analytics.py`).
- **Switchers & Ministers:** Write explicit expected test cases for faction switchers, ministers, and substitutes in `stats_test.go` documenting the mathematically corrected denominator.
- **No Hardcoded MP Lists:** Prohibit hardcoded MP ID strings (e.g. `"mp-1"`) in production code under `internal/views/` and `internal/stats/` (excluding `*_test.go`).

---

## 4. Absolute Prohibitions (Hard Guardrails)
- **DO NOT** edit auto-generated `*_templ.go` files directly.
- **DO NOT** commit fake or LLM-guessed dates in `data/mandates.json`.
- **DO NOT** hardcode MP IDs in production view or stats code.
- **DO NOT** delete `src/` (legacy React code) until stratified golden parity tests pass completely.