package main

import (
	"testing"

	"knowledgecanvas/config"
	"knowledgecanvas/internal/handlers"

	"github.com/gin-gonic/gin"
)

// TestSetupRouter verifies that every route registers without a Gin radix-tree
// conflict (the split-table item routes are easy to get wrong) and that the
// expected endpoints are present. It needs no database.
func TestSetupRouter(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{
		JWTSecret:      "test-secret",
		AllowedOrigins: "http://localhost:5173",
		StorageDriver:  "local",
		LocalStorage:   t.TempDir(),
	}
	h := &handlers.Handler{Cfg: cfg}

	var r *gin.Engine
	func() {
		defer func() {
			if rec := recover(); rec != nil {
				t.Fatalf("setupRouter panicked (route conflict?): %v", rec)
			}
		}()
		r = setupRouter(h, cfg)
	}()

	want := map[string]bool{
		"POST /api/v1/auth/login":           false,
		"GET /api/v1/boards/:id":            false,
		"PATCH /api/v1/boards/:id/reorder":  false,
		"GET /api/v1/items/:id":             false,
		"GET /api/v1/items/:id/sub-notes":   false,
		"POST /api/v1/notes":                false,
		"POST /api/v1/links":                false,
		"POST /api/v1/pdfs":                 false,
		"POST /api/v1/images":               false,
		"GET /api/v1/search":                false,
	}
	for _, ri := range r.Routes() {
		key := ri.Method + " " + ri.Path
		if _, ok := want[key]; ok {
			want[key] = true
		}
	}
	for key, found := range want {
		if !found {
			t.Errorf("expected route not registered: %s", key)
		}
	}
}
