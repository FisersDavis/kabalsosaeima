package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/FisersDavis/kabalsosaeima/internal/data"
	"github.com/FisersDavis/kabalsosaeima/internal/stats"
	"github.com/FisersDavis/kabalsosaeima/internal/views"
)

func main() {
	validateOnly := flag.Bool("validate-only", false, "Run data validation only without generating dist/")
	dataDirFlag := flag.String("data-dir", "", "Path to data directory (defaults to 'data' or 'public/data')")
	outDirFlag := flag.String("out-dir", "dist", "Output directory for static site")
	flag.Parse()

	start := time.Now()
	fmt.Println("=== Kā Balso Saeima: Static Site Generator ===")

	// 1. Resolve data directory
	dataDir := *dataDirFlag
	if dataDir == "" {
		if fi, err := os.Stat("data"); err == nil && fi.IsDir() {
			dataDir = "data"
		} else if fi, err := os.Stat("public/data"); err == nil && fi.IsDir() {
			dataDir = "public/data"
		} else {
			dataDir = "data"
		}
	}

	fmt.Printf("[1/6] Loading dataset from: %s\n", dataDir)
	store, err := data.Load(dataDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading data: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("      Loaded %d votes, %d MPs, %d mandates, %d rollcalls\n",
		len(store.Votes), len(store.MPs), len(store.Mandates), len(store.Rollcalls))

	// 2. Validate invariants
	fmt.Println("[2/6] Validating parliamentary and mandate invariants...")
	warnings, err := store.Validate()
	for _, w := range warnings {
		fmt.Printf("      [WARN] %s\n", w)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "FATAL VALIDATION ERROR: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("      Validation passed cleanly!")

	if *validateOnly {
		fmt.Printf("\nDone (--validate-only completed in %v).\n", time.Since(start))
		return
	}

	outDir := *outDirFlag

	// 3. Prepare output directory
	fmt.Printf("[3/6] Preparing output directory: %s\n", outDir)
	if err := os.MkdirAll(filepath.Join(outDir, "assets", "js"), 0755); err != nil {
		fmt.Fprintf(os.Stderr, "Error creating output directories: %v\n", err)
		os.Exit(1)
	}

	// 4. Compile Tailwind CSS
	fmt.Println("[4/6] Compiling Tailwind CSS...")
	if err := compileTailwind(outDir); err != nil {
		fmt.Fprintf(os.Stderr, "Tailwind compilation failed: %v\n", err)
		os.Exit(1)
	}

	// 5. Copy static assets (JS, public files)
	fmt.Println("[5/6] Copying static assets...")
	if err := copyStaticAssets(outDir, dataDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error copying assets: %v\n", err)
		os.Exit(1)
	}

	// 6. Pre-render HTML pages
	fmt.Println("[6/6] Pre-rendering static HTML pages...")
	if err := renderPages(store, outDir); err != nil {
		fmt.Fprintf(os.Stderr, "Page generation failed: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nSite generation complete in %v! Output in %s/\n", time.Since(start), outDir)
}

func compileTailwind(outDir string) error {
	tailwindBin := "./bin/tailwindcss"
	if runtime.GOOS == "windows" {
		if _, err := os.Stat("bin/tailwindcss.exe"); err == nil {
			tailwindBin = "bin/tailwindcss.exe"
		} else if _, err := os.Stat("./bin/tailwindcss.exe"); err == nil {
			tailwindBin = "./bin/tailwindcss.exe"
		}
	} else {
		if _, err := os.Stat("bin/tailwindcss"); err == nil {
			tailwindBin = "bin/tailwindcss"
		}
	}

	// Check if local binary exists, otherwise fallback to system tailwindcss
	if _, err := exec.LookPath(tailwindBin); err != nil {
		if sysBin, err := exec.LookPath("tailwindcss"); err == nil {
			tailwindBin = sysBin
		}
	}

	cssOut := filepath.Join(outDir, "assets", "styles.css")
	if err := os.MkdirAll(filepath.Dir(cssOut), 0755); err != nil {
		return err
	}

	cmd := exec.Command(tailwindBin, "-i", "assets/input.css", "-o", cssOut, "--minify")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
		return err
	}

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return err
}

func copyDir(srcDir, dstDir string) error {
	return filepath.Walk(srcDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(srcDir, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dstDir, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		return copyFile(path, target)
	})
}

func copyStaticAssets(outDir, dataDir string) error {
	// Copy JavaScript directory
	if err := copyDir("assets/js", filepath.Join(outDir, "assets", "js")); err != nil {
		return fmt.Errorf("copying assets/js: %w", err)
	}

	// Copy public root static files (CNAME, favicon.svg, icons.svg)
	publicEntries, err := os.ReadDir("public")
	if err == nil {
		for _, entry := range publicEntries {
			if entry.IsDir() && entry.Name() == "data" {
				continue
			}
			src := filepath.Join("public", entry.Name())
			dst := filepath.Join(outDir, entry.Name())
			if entry.IsDir() {
				if err := copyDir(src, dst); err != nil {
					return fmt.Errorf("copying public dir %s: %w", entry.Name(), err)
				}
			} else {
				if err := copyFile(src, dst); err != nil {
					return fmt.Errorf("copying public file %s: %w", entry.Name(), err)
				}
			}
		}
	}

	// Copy data directory to dist/data for API/client compatibility (sentinel smoke checks, download links)
	distData := filepath.Join(outDir, "data")
	if err := copyDir(dataDir, distData); err != nil {
		return fmt.Errorf("copying data to dist/data: %w", err)
	}

	return nil
}

func renderPages(store *data.Store, outDir string) error {
	ctx := context.Background()

	// Extract unique categories from votes
	catMap := make(map[string]data.VoteCategory)
	for _, v := range store.Votes {
		if v.Category.ID != "" {
			catMap[v.Category.ID] = v.Category
		}
	}
	var categories []data.VoteCategory
	for _, c := range catMap {
		categories = append(categories, c)
	}

	// Compute bill progression timelines
	timelines := stats.GroupBillTimelines(store)

	// 1. Overview Page: dist/index.html
	fmt.Println("      Rendering dist/index.html...")
	overviewProps := views.OverviewProps{
		LayoutProps: views.LayoutProps{
			Title:        "Kā Balso Saeima - 14. Saeimas balsojumu arhīvs un analītika",
			Description:  "Pārskatāms un neatkarīgs 14. Saeimas balsojumu arhīvs ar frakciju disciplīnas un deputātu dalības analīzi.",
			CanonicalURL: "https://kabalsosaeima.lv/",
			ActiveNav:    "votes",
		},
		Votes:         store.Votes,
		Categories:    categories,
		Store:         store,
		BillTimelines: timelines,
	}
	if err := writeHTML(filepath.Join(outDir, "index.html"), views.Overview(overviewProps), ctx); err != nil {
		return fmt.Errorf("rendering overview: %w", err)
	}

	// 2. Vote Pages: dist/balsojumi/{voteId}/index.html
	fmt.Printf("      Rendering %d vote permalinks (dist/balsojumi/{id}/)...\n", len(store.Votes))
	for i := range store.Votes {
		v := &store.Votes[i]
		seats := views.BuildHemicycleSeats(store, v)
		billSlug := stats.CleanBillSlug(v.BillNumber)

		title := views.CleanVoteTitle(v.SimplifiedTitle)
		if title == "" {
			title = views.CleanVoteTitle(v.OfficialTitle)
		}

		voteProps := views.VoteProps{
			LayoutProps: views.LayoutProps{
				Title:        fmt.Sprintf("%s - Kā Balso Saeima", title),
				Description:  v.Summary,
				CanonicalURL: fmt.Sprintf("https://kabalsosaeima.lv/balsojumi/%s/", v.ID),
				ActiveNav:    "votes",
			},
			Vote:     v,
			Seats:    seats,
			BillSlug: billSlug,
			Store:    store,
		}

		votePath := filepath.Join(outDir, "balsojumi", v.ID, "index.html")
		if err := writeHTML(votePath, views.Vote(voteProps), ctx); err != nil {
			return fmt.Errorf("rendering vote %s: %w", v.ID, err)
		}
	}

	// 3. Bill Progression Pages: dist/likumprojekti/{slug}/index.html
	fmt.Printf("      Rendering %d bill progression timelines (dist/likumprojekti/{slug}/)...\n", len(timelines))
	for _, bt := range timelines {
		billProps := views.BillProps{
			LayoutProps: views.LayoutProps{
				Title:        fmt.Sprintf("Likumprojekts Nr. %s: %s - Kā Balso Saeima", views.CleanBillNr(bt.BillNumber), bt.Title),
				Description:  fmt.Sprintf("Likumprojekta %s gaitas hronoloģija un balsojumu vēsture 14. Saeimā.", bt.BillNumber),
				CanonicalURL: fmt.Sprintf("https://kabalsosaeima.lv/likumprojekti/%s/", bt.Slug),
				ActiveNav:    "votes",
			},
			Timeline: bt,
			Store:    store,
		}

		billPath := filepath.Join(outDir, "likumprojekti", bt.Slug, "index.html")
		if err := writeHTML(billPath, views.Bill(billProps), ctx); err != nil {
			return fmt.Errorf("rendering bill %s: %w", bt.Slug, err)
		}
	}

	// 4. MP Directory & Dossier Pages
	fmt.Printf("      Rendering MP directory and %d MP dossiers (dist/deputati/)...\n", len(store.MPs))
	factionLines := stats.ComputeStoreFactionLines(store)

	var dirItems []views.MPDirectoryItem
	for i := range store.MPs {
		mp := &store.MPs[i]
		slug := mp.Slug
		if slug == "" {
			slug = mp.ID
		}

		att := stats.ComputeMPAttendance(store, mp.ID)
		coh := stats.ComputeMPCohesion(store, mp.ID, factionLines)
		mandate := store.MandateByMpID[mp.ID]
		faction := store.FactionByID[mp.FactionID]

		dirItems = append(dirItems, views.MPDirectoryItem{
			MP:         mp,
			Mandate:    mandate,
			Faction:    faction,
			Attendance: att,
			Cohesion:   coh,
		})

		mpProps := views.MPProps{
			LayoutProps: views.LayoutProps{
				Title:        fmt.Sprintf("%s - 14. Saeimas deputāta profils - Kā Balso Saeima", mp.Name),
				Description:  fmt.Sprintf("Deputāta %s balsojumu statistika, frakcijas disciplīna un dalība 14. Saeimas sēdēs.", mp.Name),
				CanonicalURL: fmt.Sprintf("https://kabalsosaeima.lv/deputati/%s/", slug),
				ActiveNav:    "mps",
			},
			MP:         mp,
			Mandate:    mandate,
			Faction:    faction,
			Attendance: att,
			Cohesion:   coh,
			History:    store.RollcallsByMP[mp.ID],
			Store:      store,
		}

		mpPath := filepath.Join(outDir, "deputati", slug, "index.html")
		if err := writeHTML(mpPath, views.MPView(mpProps), ctx); err != nil {
			return fmt.Errorf("rendering MP %s: %w", slug, err)
		}
	}

	// Render Directory Index: dist/deputati/index.html
	dirProps := views.MPDirectoryProps{
		LayoutProps: views.LayoutProps{
			Title:        "14. Saeimas deputāti un frakcijas - Kā Balso Saeima",
			Description:  "14. Saeimas deputātu saraksts, frakciju piederība, apmeklētības un frakcijas disciplīnas statistika.",
			CanonicalURL: "https://kabalsosaeima.lv/deputati/",
			ActiveNav:    "mps",
		},
		Items:    dirItems,
		Factions: store.Factions,
		Store:    store,
	}
	dirPath := filepath.Join(outDir, "deputati", "index.html")
	if err := writeHTML(dirPath, views.MPDirectory(dirProps), ctx); err != nil {
		return fmt.Errorf("rendering MP directory: %w", err)
	}

	return nil
}

type renderable interface {
	Render(ctx context.Context, w io.Writer) error
}

func writeHTML(filePath string, comp renderable, ctx context.Context) error {
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return err
	}

	f, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	return comp.Render(ctx, f)
}
