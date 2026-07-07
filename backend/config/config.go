package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration, loaded from environment variables.
type Config struct {
	Environment string
	Port        string

	DatabaseURL string
	JWTSecret   string

	// Oracle Object Storage (S3-compatible)
	OCIAccessKey       string
	OCISecretKey       string
	OCIStorageEndpoint string
	OCIBucketName      string
	OCIRegion          string

	// CORS — comma-separated list of allowed frontend origins.
	AllowedOrigins string

	// StorageDriver: "oracle" or "local" (filesystem fallback, default).
	StorageDriver string
	LocalStorage  string // directory used when StorageDriver == "local"

	// PublicBaseURL — used to build file URLs for the local storage driver.
	PublicBaseURL string
}

// Load reads .env (if present) and returns a populated Config.
func Load() *Config {
	// .env is optional — in production env vars are injected directly.
	if err := godotenv.Load(); err != nil {
		log.Println("config: no .env file found, relying on environment variables")
	}

	environment := env("ENVIRONMENT", "development")

	// Default storage driver: oracle in production, local in development.
	// Can always be overridden explicitly via STORAGE_DRIVER.
	defaultDriver := "local"
	if environment == "production" {
		defaultDriver = "oracle"
	}

	cfg := &Config{
		Environment:        environment,
		Port:               env("PORT", "8080"),
		DatabaseURL:        env("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/knowledgecanvas?sslmode=disable"),
		JWTSecret:          env("JWT_SECRET", "change-me-in-production-32-chars-min"),
		OCIAccessKey:       env("OCI_ACCESS_KEY", ""),
		OCISecretKey:       env("OCI_SECRET_KEY", ""),
		OCIStorageEndpoint: env("OCI_STORAGE_ENDPOINT", ""),
		OCIBucketName:      env("OCI_BUCKET_NAME", "knowledgecanvas-files"),
		OCIRegion:          env("OCI_REGION", "ap-mumbai-1"),
		AllowedOrigins:     env("ALLOWED_ORIGINS", "http://localhost:5173"),
		StorageDriver:      env("STORAGE_DRIVER", defaultDriver),
		LocalStorage:       env("LOCAL_STORAGE_DIR", "./uploads"),
		PublicBaseURL:      env("PUBLIC_BASE_URL", "http://localhost:8080"),
	}
	return cfg
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
