package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/FisersDavis/kabalsosaeima/internal/data"
	"github.com/FisersDavis/kabalsosaeima/internal/stats"
	"github.com/FisersDavis/kabalsosaeima/internal/views"
)

type termConfig struct {
	Term        int    `json:"term"`
	Label       string `json:"label"`
	Years       string `json:"years"`
	IsActive    bool   `json:"isActive"`
	BasePath    string `json:"basePath"`
	Description string `json:"description"`
}

type loadedTerm struct {
	Config  termConfig
	DataDir string
	Store   *data.Store
}

func main() {
	validateOnly := flag.Bool("validate-only", false, "Run data validation only without generating dist/")
	dataDirFlag := flag.String("data-dir", "", "Path to single-term data directory (optional; defaults to multi-term public/data/terms/)")
	outDirFlag := flag.String("out-dir", "dist", "Output directory for static site")
	flag.Parse()

	start := time.Now()
	fmt.Println("=== Kā Balso Saeima: Static Site Generator ===")

	// 1. Discover and load dataset(s)
	terms, err := discoverAndLoadTerms(*dataDirFlag)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error loading data: %v\n", err)
		os.Exit(1)
	}

	// 2. Validate invariants for every loaded term
	fmt.Println("[2/6] Validating parliamentary and mandate invariants...")
	for _, lt := range terms {
		fmt.Printf("      Validating %s (%s)...\n", lt.Config.Label, lt.DataDir)
		warnings, err := lt.Store.Validate()
		for _, w := range warnings {
			fmt.Printf("      [WARN] [%s] %s\n", lt.Config.Label, w)
		}
		if err != nil {
			fmt.Fprintf(os.Stderr, "FATAL VALIDATION ERROR [%s]: %v\n", lt.Config.Label, err)
			os.Exit(1)
		}
	}
	fmt.Println("      Validation passed cleanly for all terms!")

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

	// 5. Copy shared static assets & per-term open-data JSON bundles
	fmt.Println("[5/6] Copying static assets & open-data JSON bundles...")
	if err := copySharedAssets(outDir); err != nil {
		fmt.Fprintf(os.Stderr, "Error copying shared assets: %v\n", err)
		os.Exit(1)
	}
	for _, lt := range terms {
		termOutDir := termOutputDir(outDir, lt.Config.BasePath)
		if err := copyTermData(lt.DataDir, filepath.Join(termOutDir, "data"), lt.Config.IsActive); err != nil {
			fmt.Fprintf(os.Stderr, "Error copying data for %s: %v\n", lt.Config.Label, err)
			os.Exit(1)
		}
	}

	// 6. Pre-render HTML pages for every term
	fmt.Println("[6/6] Pre-rendering static HTML pages...")
	navTerms := make([]views.TermNavItem, 0, len(terms))
	for _, lt := range terms {
		navTerms = append(navTerms, views.TermNavItem{
			Term:     lt.Config.Term,
			Label:    lt.Config.Label,
			Years:    lt.Config.Years,
			BasePath: lt.Config.BasePath,
			IsActive: lt.Config.IsActive,
		})
	}

	var sitemapURLs []string
	for _, lt := range terms {
		termOutDir := termOutputDir(outDir, lt.Config.BasePath)
		fmt.Printf("   -> Rendering %s into %s/ ...\n", lt.Config.Label, termOutDir)
		urls, err := renderTermPages(lt, navTerms, termOutDir)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Page generation failed for %s: %v\n", lt.Config.Label, err)
			os.Exit(1)
		}
		sitemapURLs = append(sitemapURLs, urls...)
	}

	if err := writeStandardSiteFiles(outDir, terms[0], navTerms, sitemapURLs); err != nil {
		fmt.Fprintf(os.Stderr, "Failed writing 404/robots/sitemap: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\nSite generation complete in %v! Output in %s/\n", time.Since(start), outDir)
}

func termOutputDir(outDir, basePath string) string {
	bp := strings.Trim(basePath, "/")
	if bp == "" {
		return outDir
	}
	return filepath.Join(outDir, bp)
}

func discoverAndLoadTerms(explicitDataDir string) ([]loadedTerm, error) {
	// Explicit single-term override (used by tests or --data-dir validation)
	if explicitDataDir != "" {
		fmt.Printf("[1/6] Loading single-term dataset from: %s\n", explicitDataDir)
		store, err := data.Load(explicitDataDir)
		if err != nil {
			return nil, err
		}
		termNum := store.Metadata.SaeimaTerm
		if termNum == 0 {
			termNum = 14
		}
		years := "2022–2026"
		if termNum == 15 {
			years = "2026–2030"
		}
		fmt.Printf("      Loaded %d votes, %d MPs, %d mandates, %d rollcalls\n",
			len(store.Votes), len(store.MPs), len(store.Mandates), len(store.Rollcalls))
		return []loadedTerm{
			{
				Config: termConfig{
					Term:     termNum,
					Label:    fmt.Sprintf("%d. Saeima", termNum),
					Years:    years,
					IsActive: true,
					BasePath: "",
				},
				DataDir: explicitDataDir,
				Store:   store,
			},
		}, nil
	}

	// Default: detect multi-term public/data/terms/
	rootDataDir := "public/data"
	if fi, err := os.Stat("data/terms"); err == nil && fi.IsDir() {
		rootDataDir = "data"
	}
	termsDir := filepath.Join(rootDataDir, "terms")
	if fi, err := os.Stat(termsDir); err == nil && fi.IsDir() {
		fmt.Printf("[1/6] Loading multi-term datasets from: %s\n", termsDir)
		var configs []termConfig
		termsJSON := filepath.Join(rootDataDir, "terms.json")
		if b, err := os.ReadFile(termsJSON); err == nil {
			_ = json.Unmarshal(b, &configs)
		}

		// Discover any term directories that actually have votes.json
		cfgByTerm := make(map[int]termConfig)
		for _, c := range configs {
			cfgByTerm[c.Term] = c
		}

		entries, err := os.ReadDir(termsDir)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", termsDir, err)
		}

		var loaded []loadedTerm
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			var tNum int
			if _, err := fmt.Sscanf(e.Name(), "%d", &tNum); err != nil {
				continue
			}
			tDir := filepath.Join(termsDir, e.Name())
			if _, err := os.Stat(filepath.Join(tDir, "votes.json")); err != nil {
				continue
			}

			cfg, ok := cfgByTerm[tNum]
			if !ok {
				cfg = termConfig{
					Term:     tNum,
					Label:    fmt.Sprintf("%d. Saeima", tNum),
					Years:    fmt.Sprintf("%d", 2022+(tNum-14)*4),
					IsActive: false,
					BasePath: fmt.Sprintf("/%d-saeima", tNum),
				}
			}

			store, err := data.Load(tDir)
			if err != nil {
				return nil, fmt.Errorf("loading term %d from %s: %w", tNum, tDir, err)
			}
			if store.Metadata.SaeimaTerm == 0 {
				store.Metadata.SaeimaTerm = tNum
			}
			fmt.Printf("      [%s] Loaded %d votes, %d MPs, %d mandates, %d rollcalls\n",
				cfg.Label, len(store.Votes), len(store.MPs), len(store.Mandates), len(store.Rollcalls))
			loaded = append(loaded, loadedTerm{
				Config:  cfg,
				DataDir: tDir,
				Store:   store,
			})
		}

		if len(loaded) > 0 {
			// Sort newest term first (15, then 14)
			sort.Slice(loaded, func(i, j int) bool {
				return loaded[i].Config.Term > loaded[j].Config.Term
			})
			return loaded, nil
		}
	}

	// Fallback to legacy single-term directory
	fallbackDir := "public/data"
	if fi, err := os.Stat("data"); err == nil && fi.IsDir() {
		fallbackDir = "data"
	}
	return discoverAndLoadTerms(fallbackDir)
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

func copySharedAssets(outDir string) error {
	if err := copyDir("assets/js", filepath.Join(outDir, "assets", "js")); err != nil {
		return fmt.Errorf("copying assets/js: %w", err)
	}

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
	return nil
}

func copyTermData(dataDir, distData string, includeRollcalls bool) error {
	_ = os.RemoveAll(filepath.Join(distData, "mp_dossiers"))
	return filepath.Walk(dataDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(dataDir, path)
		if err != nil {
			return err
		}
		if info.IsDir() && (info.Name() == "mp_dossiers" || info.Name() == "terms") {
			return filepath.SkipDir
		}
		if !includeRollcalls && info.IsDir() && info.Name() == "rollcalls" {
			return filepath.SkipDir
		}
		if info.Name() == "sync_state.json" || info.Name() == "enrichment_cache.json" {
			return nil
		}
		target := filepath.Join(distData, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		return copyFile(path, target)
	})
}

const overviewPageSize = 200

func renderTermPages(lt loadedTerm, navTerms []views.TermNavItem, outDir string) ([]string, error) {
	ctx := context.Background()
	store := lt.Store
	bp := lt.Config.BasePath
	termLabel := lt.Config.Label

	activeMPCount := 0
	for i := range store.MPs {
		if store.MPs[i].IsActive {
			activeMPCount++
		}
	}
	if activeMPCount == 0 {
		activeMPCount = len(store.MPs)
	}

	makeLayout := func(title, desc, relPath, activeNav string) views.LayoutProps {
		return views.LayoutProps{
			Title:         title,
			Description:   desc,
			CanonicalURL:  "https://kabalsosaeima.lv" + views.TermURL(bp, relPath),
			ActiveNav:     activeNav,
			Metadata:      store.Metadata,
			TermNumber:    lt.Config.Term,
			TermYears:     lt.Config.Years,
			BasePath:      bp,
			IsActiveTerm:  lt.Config.IsActive,
			ActiveMPCount: activeMPCount,
			Terms:         navTerms,
		}
	}

	var sitemapURLs []string
	addSitemapURL := func(relPath string) {
		sitemapURLs = append(sitemapURLs, "https://kabalsosaeima.lv"+views.TermURL(bp, relPath))
	}
	addSitemapURL("/")
	addSitemapURL("/deputati/")

	// Extract unique categories from votes (sorted deterministically)
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
	sort.Slice(categories, func(i, j int) bool {
		return categories[i].Label < categories[j].Label
	})

	// Compute bill progression timelines
	timelines := stats.GroupBillTimelines(store)

	// 1. Overview Pages (paginated at overviewPageSize so even 7,950-vote archives stay ~1 MB/page)
	totalVotes := len(store.Votes)
	totalPages := (totalVotes + overviewPageSize - 1) / overviewPageSize
	if totalPages < 1 {
		totalPages = 1
	}
	for page := 1; page <= totalPages; page++ {
		startIdx := (page - 1) * overviewPageSize
		endIdx := startIdx + overviewPageSize
		if endIdx > totalVotes {
			endIdx = totalVotes
		}
		pageVotes := store.Votes[startIdx:endIdx]

		relPath := "/"
		outPath := filepath.Join(outDir, "index.html")
		pageTitle := fmt.Sprintf("Kā Balso Saeima - %s balsojumu arhīvs un analītika", termLabel)
		if page > 1 {
			relPath = fmt.Sprintf("/lapa/%d/", page)
			outPath = filepath.Join(outDir, "lapa", fmt.Sprint(page), "index.html")
			pageTitle = fmt.Sprintf("Kā Balso Saeima - %s balsojumi (%d. lapa)", termLabel, page)
		}

		overviewProps := views.OverviewProps{
			LayoutProps: makeLayout(
				pageTitle,
				fmt.Sprintf("Pārskatāms un neatkarīgs %s balsojumu arhīvs ar frakciju disciplīnas un deputātu dalības analīzi.", termLabel),
				relPath,
				"votes",
			),
			Votes:         pageVotes,
			Categories:    categories,
			Store:         store,
			BillTimelines: timelines,
			CurrentPage:   page,
			TotalPages:    totalPages,
			TotalVotes:    totalVotes,
		}
		if err := writeHTML(outPath, views.Overview(overviewProps), ctx); err != nil {
			return nil, fmt.Errorf("rendering overview page %d: %w", page, err)
		}
	}

	// 2. Vote Pages (parallelized across CPU workers)
	fmt.Printf("      Rendering %d vote permalinks (%d overview pages)...\n", len(store.Votes), totalPages)
	workers := runtime.NumCPU()
	if workers < 2 {
		workers = 2
	}
	voteJobs := make(chan int, len(store.Votes))
	for i := range store.Votes {
		addSitemapURL(fmt.Sprintf("/balsojumi/%s/", store.Votes[i].ID))
		voteJobs <- i
	}
	close(voteJobs)

	errCh := make(chan error, workers)
	for w := 0; w < workers; w++ {
		go func() {
			for i := range voteJobs {
				v := &store.Votes[i]
				seats := views.BuildHemicycleSeats(store, v)
				billSlug := stats.CleanBillSlug(v.BillNumber)

				title := views.CleanVoteTitle(v.SimplifiedTitle)
				if title == "" {
					title = views.CleanVoteTitle(v.OfficialTitle)
				}

				var timeline *stats.BillTimeline
				if v.BillNumber != "" {
					timeline = timelines[strings.TrimSpace(v.BillNumber)]
				}

				voteProps := views.VoteProps{
					LayoutProps: makeLayout(
						fmt.Sprintf("%s - Kā Balso Saeima", title),
						v.Summary,
						fmt.Sprintf("/balsojumi/%s/", v.ID),
						"votes",
					),
					Vote:     v,
					Seats:    seats,
					BillSlug: billSlug,
					Timeline: timeline,
					Store:    store,
				}

				votePath := filepath.Join(outDir, "balsojumi", v.ID, "index.html")
				if err := writeHTML(votePath, views.Vote(voteProps), ctx); err != nil {
					errCh <- fmt.Errorf("rendering vote %s: %w", v.ID, err)
					return
				}
			}
			errCh <- nil
		}()
	}
	for w := 0; w < workers; w++ {
		if err := <-errCh; err != nil {
			return nil, err
		}
	}

	// 3. Bill Progression Pages: {outDir}/likumprojekti/{slug}/index.html
	fmt.Printf("      Rendering %d bill progression timelines...\n", len(timelines))
	billList := make([]*stats.BillTimeline, 0, len(timelines))
	for _, bt := range timelines {
		billList = append(billList, bt)
	}
	sort.Slice(billList, func(i, j int) bool {
		return billList[i].Slug < billList[j].Slug
	})
	billJobs := make(chan *stats.BillTimeline, len(billList))
	for _, bt := range billList {
		addSitemapURL(fmt.Sprintf("/likumprojekti/%s/", bt.Slug))
		billJobs <- bt
	}
	close(billJobs)

	for w := 0; w < workers; w++ {
		go func() {
			for bt := range billJobs {
				billProps := views.BillProps{
					LayoutProps: makeLayout(
						fmt.Sprintf("Likumprojekts Nr. %s: %s - Kā Balso Saeima", views.CleanBillNr(bt.BillNumber), bt.Title),
						fmt.Sprintf("Likumprojekta %s gaitas hronoloģija un balsojumu vēsture %d. Saeimā.", bt.BillNumber, lt.Config.Term),
						fmt.Sprintf("/likumprojekti/%s/", bt.Slug),
						"votes",
					),
					Timeline: bt,
					Store:    store,
				}
				billPath := filepath.Join(outDir, "likumprojekti", bt.Slug, "index.html")
				if err := writeHTML(billPath, views.Bill(billProps), ctx); err != nil {
					errCh <- fmt.Errorf("rendering bill %s: %w", bt.Slug, err)
					return
				}
			}
			errCh <- nil
		}()
	}
	for w := 0; w < workers; w++ {
		if err := <-errCh; err != nil {
			return nil, err
		}
	}

	// 4. MP Directory & Dossier Pages
	fmt.Printf("      Rendering MP directory and %d MP dossiers...\n", len(store.MPs))
	factionLines := stats.ComputeStoreFactionLines(store)

	var dirItems []views.MPDirectoryItem
	for i := range store.MPs {
		mp := &store.MPs[i]
		slug := mp.Slug
		if slug == "" {
			slug = mp.ID
		}
		addSitemapURL(fmt.Sprintf("/deputati/%s/", slug))

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
			LayoutProps: makeLayout(
				fmt.Sprintf("%s - %d. Saeimas deputāta profils - Kā Balso Saeima", mp.Name, lt.Config.Term),
				fmt.Sprintf("Deputāta %s balsojumu statistika, frakcijas disciplīna un dalība %d. Saeimas sēdēs.", mp.Name, lt.Config.Term),
				fmt.Sprintf("/deputati/%s/", slug),
				"mps",
			),
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
			return nil, fmt.Errorf("rendering MP %s: %w", slug, err)
		}

		if mp.Slug != "" && mp.Slug != mp.ID {
			redirectPath := filepath.Join(outDir, "deputati", mp.ID, "index.html")
			if err := writeRedirectStub(redirectPath, views.TermURL(bp, fmt.Sprintf("/deputati/%s/", slug))); err != nil {
				return nil, fmt.Errorf("writing MP redirect stub %s: %w", mp.ID, err)
			}
		}
	}

	// Render Directory Index: {outDir}/deputati/index.html
	dirProps := views.MPDirectoryProps{
		LayoutProps: makeLayout(
			fmt.Sprintf("%d. Saeimas deputāti un frakcijas - Kā Balso Saeima", lt.Config.Term),
			fmt.Sprintf("%d. Saeimas deputātu saraksts, frakciju piederība, apmeklētības un frakcijas disciplīnas statistika.", lt.Config.Term),
			"/deputati/",
			"mps",
		),
		Items:    dirItems,
		Factions: store.Factions,
		Store:    store,
	}
	dirPath := filepath.Join(outDir, "deputati", "index.html")
	if err := writeHTML(dirPath, views.MPDirectory(dirProps), ctx); err != nil {
		return nil, fmt.Errorf("rendering MP directory: %w", err)
	}

	return sitemapURLs, nil
}

func writeStandardSiteFiles(outDir string, activeTerm loadedTerm, navTerms []views.TermNavItem, sitemapURLs []string) error {
	ctx := context.Background()
	activeMPCount := 0
	for i := range activeTerm.Store.MPs {
		if activeTerm.Store.MPs[i].IsActive {
			activeMPCount++
		}
	}

	// 1. Branded Latvian 404.html (includes redirect.js for legacy SPA hash links)
	notFoundProps := views.NotFoundProps{
		LayoutProps: views.LayoutProps{
			Title:         "Lapa nav atrasta (404) - Kā Balso Saeima",
			Description:   "Pieprasītā lapa netika atrasta. Pārlūkojiet 15. un 14. Saeimas balsojumu arhīvu.",
			CanonicalURL:  "https://kabalsosaeima.lv/404.html",
			ActiveNav:     "",
			Metadata:      activeTerm.Store.Metadata,
			TermNumber:    activeTerm.Config.Term,
			TermYears:     activeTerm.Config.Years,
			BasePath:      "",
			IsActiveTerm:  activeTerm.Config.IsActive,
			ActiveMPCount: activeMPCount,
			Terms:         navTerms,
		},
	}
	if err := writeHTML(filepath.Join(outDir, "404.html"), views.NotFound(notFoundProps), ctx); err != nil {
		return fmt.Errorf("rendering 404.html: %w", err)
	}

	// 2. robots.txt
	robots := "User-agent: *\nAllow: /\n\nSitemap: https://kabalsosaeima.lv/sitemap.xml\n"
	if err := os.WriteFile(filepath.Join(outDir, "robots.txt"), []byte(robots), 0644); err != nil {
		return fmt.Errorf("writing robots.txt: %w", err)
	}

	// 3. sitemap.xml
	var sb strings.Builder
	sb.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	sb.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` + "\n")
	for _, u := range sitemapURLs {
		escaped := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", `"`, "&quot;", "'", "&apos;").Replace(u)
		sb.WriteString("  <url><loc>")
		sb.WriteString(escaped)
		sb.WriteString("</loc></url>\n")
	}
	sb.WriteString("</urlset>\n")
	if err := os.WriteFile(filepath.Join(outDir, "sitemap.xml"), []byte(sb.String()), 0644); err != nil {
		return fmt.Errorf("writing sitemap.xml: %w", err)
	}

	fmt.Printf("   -> Wrote 404.html, robots.txt, and sitemap.xml (%d URLs)\n", len(sitemapURLs))
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

func writeRedirectStub(filePath, targetURL string) error {
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return err
	}
	content := fmt.Sprintf(`<!DOCTYPE html>
<html lang="lv">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="refresh" content="0; url=%s"/>
<link rel="canonical" href="https://kabalsosaeima.lv%s"/>
<script>window.location.replace(%q);</script>
<title>Pāradresācija...</title>
</head>
<body><a href="%s">Turpināt uz deputāta profilu</a></body>
</html>
`, targetURL, targetURL, targetURL, targetURL)
	return os.WriteFile(filePath, []byte(content), 0644)
}
