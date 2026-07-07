package storage

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"knowledgecanvas/config"
)

// localStorage is a development fallback that writes objects to the local
// filesystem and serves them back through the API's /api/v1/files/* route.
// Files are NOT signed here — intended only for local development.
type localStorage struct {
	root    string
	baseURL string
}

func newLocal(cfg *config.Config) (Storage, error) {
	if err := os.MkdirAll(cfg.LocalStorage, 0o755); err != nil {
		return nil, fmt.Errorf("storage: create local dir: %w", err)
	}
	return &localStorage{
		root:    cfg.LocalStorage,
		baseURL: strings.TrimRight(cfg.PublicBaseURL, "/"),
	}, nil
}

func (s *localStorage) Upload(_ context.Context, key string, body []byte, _ string) (string, error) {
	dest := filepath.Join(s.root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(dest, body, 0o644); err != nil {
		return "", err
	}
	return key, nil
}

func (s *localStorage) PresignGet(_ context.Context, key string, _ time.Duration) (string, error) {
	if key == "" {
		return "", nil
	}
	return s.baseURL + "/api/v1/files/" + key, nil
}

func (s *localStorage) Delete(_ context.Context, key string) error {
	if key == "" {
		return nil
	}
	return os.Remove(filepath.Join(s.root, filepath.FromSlash(key)))
}

// LocalRoot returns the filesystem root (used to register the file-serving route).
func LocalRoot(cfg *config.Config) string { return cfg.LocalStorage }
