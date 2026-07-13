package routes

import (
	"knowledgecanvas/config"
	"knowledgecanvas/internal/handlers"
	"knowledgecanvas/internal/middleware"
	"knowledgecanvas/internal/storage"
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRouter(h *handlers.Handler, cfg *config.Config) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	r.MaxMultipartMemory = 51 << 20

	r.Use(cors.New(
		cors.Config{
			AllowOrigins:     strings.Split(cfg.AllowedOrigins, ","),
			AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "X-Client-TZ-Offset"},
			AllowCredentials: true,
			MaxAge:           12 * time.Hour,
		},
	))
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	api := r.Group("/api/v1")

	// Local storage file server (dev fallback only).
	if cfg.StorageDriver != "oracle" {
		api.StaticFS("/files", http.Dir(storage.LocalRoot(cfg)))
	}

	// Inline note images are served unauthenticated (an <img> tag cannot send a
	// Bearer header); the UUID id is the capability, mirroring presigned URLs.
	api.GET("/editor/images/:id", h.ServeEditorImage)

	// ---- Auth (rate-limited, unauthenticated) ----
	authGroup := api.Group("/auth")
	authGroup.Use(middleware.RateLimit(100))
	{
		authGroup.POST("/register", h.Register)
		authGroup.POST("/login", h.Login)
		authGroup.POST("/logout", h.Logout)
		authGroup.GET("/me", middleware.Auth(cfg.JWTSecret), h.Me)
	}

	// ---- Protected routes ----
	auth := api.Group("")
	auth.Use(middleware.Auth(cfg.JWTSecret))
	{
		// Boards
		auth.GET("/boards", h.ListBoards)
		auth.POST("/boards", h.CreateBoard)
		auth.GET("/boards/:id", h.GetBoard)
		auth.PUT("/boards/:id", h.UpdateBoard)
		auth.DELETE("/boards/:id", h.DeleteBoard)
		auth.PUT("/boards/:id/state", h.UpdateBoardState)
		auth.PATCH("/boards/:id/reorder", h.ReorderItems)
		auth.PATCH("/boards/:id/parent", h.MoveBoard)

		// Items (shared) — all param routes use :id to satisfy Gin's router.
		auth.GET("/items/:id", h.GetItem)
		auth.PATCH("/items/:id/pin", h.PinItem)
		auth.PATCH("/items/:id/color", h.ColorItem)
		auth.PATCH("/items/:id/board", h.MoveItem)
		auth.DELETE("/items/:id", h.DeleteItem)
		auth.GET("/items/:id/sub-notes", h.ListSubNotes)
		auth.POST("/items/:id/sub-notes", h.CreateSubNote)

		// Type-specific item routes — top-level resources (Gin cannot mix the
		// static "/items/notes" with the param "/items/:id"; see README).
		auth.POST("/notes", h.CreateNote)
		auth.PUT("/notes/:id", h.UpdateNote)
		auth.POST("/links", h.CreateLink)
		auth.PUT("/links/:id", h.UpdateLink)
		auth.POST("/pdfs", h.CreatePDF)
		auth.PUT("/pdfs/:id", h.UpdatePDF)
		auth.POST("/images", h.CreateImage)
		auth.PUT("/images/:id", h.UpdateImage)
		auth.POST("/editor/images", h.UploadEditorImage)
		auth.POST("/excalidraws", h.CreateExcalidraw)
		auth.PUT("/excalidraws/:id", h.UpdateExcalidraw)

		// Sub-notes
		auth.PUT("/sub-notes/:id", h.UpdateSubNote)
		auth.DELETE("/sub-notes/:id", h.DeleteSubNote)

		// Search
		auth.GET("/search", h.Search)

		// Todos — checklist items aggregated across all note items.
		auth.GET("/todos", h.ListTodos)
		auth.POST("/todos", h.CreateQuickTodo)
		auth.PATCH("/todos/:id", h.ToggleTodo)
		auth.DELETE("/todos/:id", h.DeleteTodo)

		// Journal — daily entries: days hold items scaffolded from templates.
		journal := auth.Group("/journal")
		{
			journal.GET("/templates", h.ListJournalTemplates)
			journal.GET("/days", h.ListJournalDays)
			journal.GET("/days/today", h.GetTodayJournalDay)
			journal.GET("/day/:date", h.GetJournalDayByDate)
			journal.GET("/tags", h.ListJournalTags)
			journal.POST("/items", h.CreateJournalItem)
			journal.GET("/items", h.ListJournalItemsByTag) // ?tag=...
			journal.GET("/items/:id", h.GetJournalItem)
			journal.PATCH("/items/:id", h.UpdateJournalItem)
			journal.DELETE("/items/:id", h.DeleteJournalItem)
			journal.GET("/preferences", h.GetJournalPreferences)
			journal.PUT("/preferences", h.UpdateJournalPreferences)
			journal.POST("/backdrops", h.UploadJournalBackdrop)
		}
	}

	return r
}
