package data_test

import (
	"path/filepath"
	"testing"

	"github.com/FisersDavis/kabalsosaeima/internal/data"
)

func TestLoadAndValidateGolden(t *testing.T) {
	goldenDir := filepath.Join("..", "..", "testdata", "golden")

	store, err := data.Load(goldenDir)
	if err != nil {
		t.Fatalf("Failed to load golden dataset: %v", err)
	}

	if len(store.Votes) != 398 {
		t.Errorf("Expected 398 votes, got %d", len(store.Votes))
	}
	if len(store.MPs) != 139 {
		t.Errorf("Expected 139 MPs, got %d", len(store.MPs))
	}
	if len(store.Mandates) != 139 {
		t.Errorf("Expected 139 Mandates, got %d", len(store.Mandates))
	}

	warnings, err := store.Validate()
	if err != nil {
		t.Fatalf("Validation failed unexpectedly on golden data: %v", err)
	}

	t.Logf("Validation passed cleanly with %d warnings:", len(warnings))
	for _, w := range warnings {
		t.Logf("  Notice: %s", w)
	}
}

func TestCeilingInvariant(t *testing.T) {
	goldenDir := filepath.Join("..", "..", "testdata", "golden")
	store, err := data.Load(goldenDir)
	if err != nil {
		t.Fatalf("Failed to load golden dataset: %v", err)
	}

	// Mutate to artificially breach ceiling: add an extra active mandate for "2026-02-12"
	fakeMandate := data.Mandate{
		MpID:     "mp-fake",
		SaeimaID: "00000000000000000000000000000000",
		Name:     "Fake MP",
		Slug:     "fake-mp",
		Active: []data.MandateInterval{
			{From: "2026-02-12", To: nil},
		},
	}
	store.Mandates = append(store.Mandates, fakeMandate)
	store.MandateByMpID[fakeMandate.MpID] = &fakeMandate

	_, err = store.Validate()
	if err == nil {
		t.Fatal("Expected ceiling invariant violation (>100 active mandates), but validation passed")
	}
	t.Logf("Successfully caught ceiling invariant violation: %v", err)
}
