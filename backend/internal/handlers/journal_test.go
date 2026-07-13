package handlers

import (
	"testing"
	"time"

	"knowledgecanvas/internal/models"
)

// ---- pure logic (no DB) -----------------------------------------------------

func TestResolveDate_Rollover(t *testing.T) {
	// 2026-07-12 20:30 UTC. In IST (UTC+5:30, offset -330) it is already
	// 2026-07-13 02:00; in Hawaii (UTC-10, offset 600) it is still 2026-07-12.
	now := time.Date(2026, 7, 12, 20, 30, 0, 0, time.UTC)
	cases := []struct {
		name   string
		offset string
		want   string
	}{
		{"utc empty header", "", "2026-07-12"},
		{"utc explicit", "0", "2026-07-12"},
		{"ist crosses into next day", "-330", "2026-07-13"},
		{"hawaii still previous day", "600", "2026-07-12"},
		{"invalid header falls back to utc", "notanumber", "2026-07-12"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			day, str := resolveDate(tc.offset, now)
			if str != tc.want {
				t.Errorf("resolveDate(%q) = %q, want %q", tc.offset, str, tc.want)
			}
			if day.Hour() != 0 || day.Minute() != 0 || day.Location() != time.UTC {
				t.Errorf("resolveDate day not midnight-UTC: %v", day)
			}
		})
	}
}

func TestWordCount(t *testing.T) {
	cases := []struct {
		name    string
		content string
		want    int
	}{
		{"empty", "", 0},
		{"empty paragraph", "<p></p>", 0},
		{"plain words", "<p>hello world</p>", 2},
		{"across tags", "<h2>Topics covered</h2><p>calculus and vectors</p>", 5},
		{"entities decoded", "<p>rock &amp; roll</p>", 3},
		{"extra whitespace", "<p>  a   b  </p>", 2},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := wordCount(tc.content); got != tc.want {
				t.Errorf("wordCount(%q) = %d, want %d", tc.content, got, tc.want)
			}
		})
	}
}

func TestScaffoldFromTemplate(t *testing.T) {
	cases := []struct {
		name string
		tmpl models.JSONB
		want string
	}{
		{
			name: "study log three sections",
			tmpl: models.JSONB{"sections": []interface{}{
				map[string]interface{}{"heading": "Topics covered"},
				map[string]interface{}{"heading": "Doubts"},
			}},
			want: "<h2>Topics covered</h2><p></p><h2>Doubts</h2><p></p>",
		},
		{
			name: "free write blank heading",
			tmpl: models.JSONB{"sections": []interface{}{
				map[string]interface{}{"heading": ""},
			}},
			want: "<p></p>",
		},
		{
			name: "no sections key",
			tmpl: models.JSONB{},
			want: "<p></p>",
		},
		{
			name: "heading is html-escaped",
			tmpl: models.JSONB{"sections": []interface{}{
				map[string]interface{}{"heading": "A & <B>"},
			}},
			want: "<h2>A &amp; &lt;B&gt;</h2><p></p>",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := scaffoldFromTemplate(tc.tmpl); got != tc.want {
				t.Errorf("scaffoldFromTemplate() = %q, want %q", got, tc.want)
			}
		})
	}
}
