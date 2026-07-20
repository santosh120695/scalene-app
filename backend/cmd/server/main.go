package main

import (
	"knowledgecanvas/config"
	"knowledgecanvas/internal/database"
	"knowledgecanvas/internal/handlers"
	"knowledgecanvas/internal/storage"
	"knowledgecanvas/routes"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	db, err := database.Connect(cfg.DatabaseURL, cfg.Environment == "development")
	if err != nil {
		log.Fatalf("startup: %v", err)
	}
	if err := database.Migrate(db); err != nil {
		log.Fatalf("startup: migrations: %v", err)
	}

	store, err := storage.New(cfg)
	if err != nil {
		log.Fatalf("startup: storage: %v", err)
	}
	log.Printf("startup: storage driver = %s", cfg.StorageDriver)

	h := handlers.New(db, cfg, store)

	r := routes.Init(h, cfg)

	log.Printf("startup: listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server: %v", err)
	}
}
