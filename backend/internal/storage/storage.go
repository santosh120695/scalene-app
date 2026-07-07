package storage

import (
	"context"
	"fmt"
	"time"

	"knowledgecanvas/config"
)

// Storage abstracts object storage so the rest of the app is driver-agnostic.
type Storage interface {
	// Upload stores body under key and returns the stored key.
	Upload(ctx context.Context, key string, body []byte, contentType string) (string, error)
	// PresignGet returns a time-limited URL the browser can use to fetch key.
	PresignGet(ctx context.Context, key string, ttl time.Duration) (string, error)
	// Delete removes key (best-effort).
	Delete(ctx context.Context, key string) error
}

// New returns the appropriate storage driver based on config.
// In production, oracle is required — missing credentials are a fatal
// misconfiguration rather than a silent fallback to local storage.
func New(cfg *config.Config) (Storage, error) {
	if cfg.StorageDriver == "oracle" {
		if cfg.OCIAccessKey == "" || cfg.OCISecretKey == "" || cfg.OCIStorageEndpoint == "" {
			return nil, fmt.Errorf(
				"storage: driver=oracle but OCI_ACCESS_KEY / OCI_SECRET_KEY / OCI_STORAGE_ENDPOINT are not set",
			)
		}
		return newOracle(cfg)
	}
	return newLocal(cfg)
}

// Default presign expiry for files (PRD §7.3 — 24h for files, 7d for thumbs).
const (
	FileTTL  = 24 * time.Hour
	ThumbTTL = 7 * 24 * time.Hour
)
