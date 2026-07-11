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

	// r := setupRouter(h, cfg)
	r := routes.SetupRouter(h, cfg)

	log.Printf("startup: listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server: %v", err)
	}
}

// // setupRouter wires all middleware and routes. Extracted so route registration
// // can be tested without a database connection.
// func setupRouter(h *handlers.Handler, cfg *config.Config) *gin.Engine {
// 	r := gin.New()
// 	r.Use(gin.Logger(), gin.Recovery())
// 	r.MaxMultipartMemory = 51 << 20 // 51MB
//
// 	// CORS — whitelist configured frontend origins (PRD §9.3).
// 	r.Use(cors.New(cors.Config{
// 		AllowOrigins:     strings.Split(cfg.AllowedOrigins, ","),
// 		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
// 		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
// 		AllowCredentials: true,
// 		MaxAge:           12 * time.Hour,
// 	}))
//
// 	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })
//
// 	api := r.Group("/api/v1")
//
// 	// Local storage file server (dev fallback only).
// 	if cfg.StorageDriver != "oracle" {
// 		api.StaticFS("/files", http.Dir(storage.LocalRoot(cfg)))
// 	}
//
// 	// ---- Auth (rate-limited, unauthenticated) ----
// 	authGroup := api.Group("/auth")
// 	authGroup.Use(middleware.RateLimit(100))
// 	{
// 		authGroup.POST("/register", h.Register)
// 		authGroup.POST("/login", h.Login)
// 		authGroup.POST("/logout", h.Logout)
// 		authGroup.GET("/me", middleware.Auth(cfg.JWTSecret), h.Me)
// 	}
//
// 	// ---- Protected routes ----
// 	auth := api.Group("")
// 	auth.Use(middleware.Auth(cfg.JWTSecret))
// 	{
// 		// Boards
// 		auth.GET("/boards", h.ListBoards)
// 		auth.POST("/boards", h.CreateBoard)
// 		auth.GET("/boards/:id", h.GetBoard)
// 		auth.PUT("/boards/:id", h.UpdateBoard)
// 		auth.DELETE("/boards/:id", h.DeleteBoard)
// 		auth.PUT("/boards/:id/state", h.UpdateBoardState)
// 		auth.PATCH("/boards/:id/reorder", h.ReorderItems)
// 		auth.PATCH("/boards/:id/parent", h.MoveBoard)
//
// 		// Items (shared) — all param routes use :id to satisfy Gin's router.
// 		auth.GET("/items/:id", h.GetItem)
// 		auth.PATCH("/items/:id/pin", h.PinItem)
// 		auth.PATCH("/items/:id/color", h.ColorItem)
// 		auth.PATCH("/items/:id/board", h.MoveItem)
// 		auth.DELETE("/items/:id", h.DeleteItem)
// 		auth.GET("/items/:id/sub-notes", h.ListSubNotes)
// 		auth.POST("/items/:id/sub-notes", h.CreateSubNote)
//
// 		// Type-specific item routes — top-level resources (Gin cannot mix the
// 		// static "/items/notes" with the param "/items/:id"; see README).
// 		auth.POST("/notes", h.CreateNote)
// 		auth.PUT("/notes/:id", h.UpdateNote)
// 		auth.POST("/links", h.CreateLink)
// 		auth.PUT("/links/:id", h.UpdateLink)
// 		auth.POST("/pdfs", h.CreatePDF)
// 		auth.PUT("/pdfs/:id", h.UpdatePDF)
// 		auth.POST("/images", h.CreateImage)
// 		auth.PUT("/images/:id", h.UpdateImage)
// 		auth.POST("/excalidraws", h.CreateExcalidraw)
// 		auth.PUT("/excalidraws/:id", h.UpdateExcalidraw)
//
// 		// Sub-notes
// 		auth.PUT("/sub-notes/:id", h.UpdateSubNote)
// 		auth.DELETE("/sub-notes/:id", h.DeleteSubNote)
//
// 		// Search
// 		auth.GET("/search", h.Search)
//
// 		// Todos — checklist items aggregated across all note items.
// 		auth.GET("/todos", h.ListTodos)
// 		auth.POST("/todos", h.CreateQuickTodo)
// 		auth.PATCH("/todos/:id", h.ToggleTodo)
// 		auth.DELETE("/todos/:id", h.DeleteTodo)
// 	}
//
// 	return r
// }
