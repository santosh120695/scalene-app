package database

import (
	"fmt"
	"knowledgecanvas/migrations"
	"log"
	"sort"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

// Connect opens the GORM/Postgres connection.
func Connect(dsn string, debug bool) (*gorm.DB, error) {
	logLevel := gormlogger.Warn
	if debug {
		logLevel = gormlogger.Info
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormlogger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("database: connect: %w", err)
	}
	return db, nil
}

func Migrate(db *gorm.DB) error {
	if err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version VARCHAR(255) PRIMARY KEY,
		applied_at TIMESTAMPTZ DEFAULT NOW()
	)`).Error; err != nil {
		return fmt.Errorf("database: ensure migrations table: %w", err)
	}

	entries, err := migrations.FS.ReadDir(".")
	if err != nil {
		return fmt.Errorf("database: read migrations dir: %w", err)
	}

	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var count int64
		if err := db.Raw("SELECT COUNT(1) FROM schema_migrations WHERE version = ?", name).Scan(&count).Error; err != nil {
			return fmt.Errorf("database: check migration %s: %w", name, err)
		}
		if count > 0 {
			continue
		}

		sqlBytes, err := migrations.FS.ReadFile(name)
		if err != nil {
			return fmt.Errorf("database: read %s: %w", name, err)
		}

		err = db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(string(sqlBytes)).Error; err != nil {
				return err
			}
			return tx.Exec("INSERT INTO schema_migrations (version) VALUES (?)", name).Error
		})
		if err != nil {
			return fmt.Errorf("database: apply %s: %w", name, err)
		}
		log.Printf("database: applied migration %s", name)
	}
	return nil
}
