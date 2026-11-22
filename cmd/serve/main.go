package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	portFlag := flag.Int("port", 8080, "HTTP port to listen on")
	dirFlag := flag.String("dir", "dist", "Directory to serve")
	flag.Parse()

	distDir := *dirFlag
	if _, err := os.Stat(distDir); os.IsNotExist(err) {
		log.Fatalf("Directory %q does not exist. Please run 'go run ./cmd/build' first.", distDir)
	}

	absDir, err := filepath.Abs(distDir)
	if err != nil {
		absDir = distDir
	}

	addr := fmt.Sprintf(":%d", *portFlag)
	fileServer := http.FileServer(http.Dir(distDir))

	// Simple request logging wrapper
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("%s %s", r.Method, r.URL.Path)
		fileServer.ServeHTTP(w, r)
	})

	fmt.Printf("=== Kā Balso Saeima: Local Dev Server ===\n")
	fmt.Printf("Serving:   %s\n", absDir)
	fmt.Printf("Listening: http://localhost:%d/\n", *portFlag)
	fmt.Println("Press Ctrl+C to stop.")

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
