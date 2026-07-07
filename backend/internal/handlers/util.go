package handlers

import "time"

func durationFromHours(h int) time.Duration {
	return time.Duration(h) * time.Hour
}
