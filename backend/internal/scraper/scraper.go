package scraper

import (
	"bytes"
	"encoding/json"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	readability "github.com/go-shiori/go-readability"
)

type Meta struct {
	Title       string
	Description string
	Thumbnail   string
	Domain      string
	Content     string
	Byline      string
}

const maxBody = 5 * 1024 * 1024 // 5MB

func Scrape(rawURL string) Meta {
	meta := Meta{Domain: domainOf(rawURL)}
	parsedURL, _ := url.Parse(rawURL)

	provider := embedProvider(parsedURL)
	if provider == "instagram" {
		meta.Title = "Instagram"
		return meta
	}

	body, ok := fetch(rawURL)
	if !ok {
		if meta.Title == "" {
			meta.Title = meta.Domain
		}
		return meta
	}

	// ── OpenGraph / <title> via goquery ──
	if doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body)); err == nil {
		meta.Title = firstNonEmpty(
			attr(doc, `meta[property="og:title"]`),
			strings.TrimSpace(doc.Find("title").First().Text()),
		)
		meta.Description = firstNonEmpty(
			attr(doc, `meta[property="og:description"]`),
			attr(doc, `meta[name="description"]`),
		)
		meta.Thumbnail = absURL(rawURL, firstNonEmpty(
			attr(doc, `meta[property="og:image"]`),
			attr(doc, `meta[name="twitter:image"]`),
		))
	}

	// Embeddable providers (YouTube): stop after OG metadata — no reader view.
	if provider != "" {
		if meta.Title == "" {
			meta.Title = meta.Domain
		}
		return meta
	}

	// ── Readable article body via go-readability (Readability.js port) ──
	if article, err := readability.FromReader(bytes.NewReader(body), parsedURL); err == nil {
		meta.Content = article.Content
		meta.Byline = strings.TrimSpace(article.Byline)
		if meta.Title == "" {
			meta.Title = strings.TrimSpace(article.Title)
		}
		if meta.Description == "" {
			meta.Description = strings.TrimSpace(article.Excerpt)
		}
		if meta.Thumbnail == "" {
			meta.Thumbnail = article.Image
		}
	}

	// ── Fallback for client-rendered (SPA) pages ──
	// Sites like HackerNoon (Next.js) render the article with JavaScript, so the
	// static HTML readability sees is nearly empty. The body is embedded in the
	// __NEXT_DATA__ JSON — use it when readability came up short.
	if ndContent := nextDataContent(body); textLen(ndContent) > textLen(meta.Content) {
		meta.Content = ndContent
	}

	if meta.Title == "" {
		meta.Title = meta.Domain
	}
	return meta
}

const browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
	"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

func fetch(rawURL string) ([]byte, bool) {
	req, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, false
	}
	req.Header.Set("User-Agent", browserUA)
	req.Header.Set("Accept",
		"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "none")
	req.Header.Set("Upgrade-Insecure-Requests", "1")

	client := &http.Client{
		Timeout: 12 * time.Second,
		CheckRedirect: func(r *http.Request, via []*http.Request) error {
			if len(via) >= 10 {
				return http.ErrUseLastResponse
			}
			r.Header.Set("User-Agent", browserUA)
			r.Header.Set("Accept-Language", "en-US,en;q=0.9")
			return nil
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, false
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, false
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBody))
	if err != nil {
		return nil, false
	}
	return body, true
}

func attr(doc *goquery.Document, selector string) string {
	v, _ := doc.Find(selector).First().Attr("content")
	return strings.TrimSpace(v)
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func embedProvider(u *url.URL) string {
	if u == nil {
		return ""
	}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	switch host {
	case "youtube.com", "m.youtube.com", "youtu.be", "youtube-nocookie.com":
		return "youtube"
	case "instagram.com", "instagr.am":
		return "instagram"
	}
	return ""
}

func domainOf(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(u.Hostname(), "www.")
}

func absURL(base, ref string) string {
	if ref == "" {
		return ""
	}
	b, err := url.Parse(base)
	if err != nil {
		return ref
	}
	r, err := url.Parse(ref)
	if err != nil {
		return ref
	}
	return b.ResolveReference(r).String()
}

var (
	nextDataRe = regexp.MustCompile(`(?s)<script id="__NEXT_DATA__"[^>]*>(.*?)</script>`)
	tagRe      = regexp.MustCompile(`<[^>]+>`)
)

var (
	contentKeysTier1 = map[string]bool{"parsed": true, "contenthtml": true, "bodyhtml": true}
	contentKeysTier2 = map[string]bool{"content": true, "body": true, "html": true, "markup": true}
	contentKeysText  = map[string]bool{"articlebody": true, "content": true, "body": true}
)

func nextDataContent(htmlBytes []byte) string {
	m := nextDataRe.FindSubmatch(htmlBytes)
	if m == nil {
		return ""
	}
	var data interface{}
	if err := json.Unmarshal(m[1], &data); err != nil {
		return ""
	}

	var tier1, tier2, text string
	var walk func(node interface{}, key string, skip bool)
	walk = func(node interface{}, key string, skip bool) {
		switch v := node.(type) {
		case map[string]interface{}:
			for k, child := range v {
				lk := strings.ToLower(k)
				childSkip := skip ||
					strings.Contains(lk, "related") ||
					strings.Contains(lk, "recommend") ||
					strings.Contains(lk, "stories") ||
					strings.Contains(lk, "feed") ||
					strings.Contains(lk, "comment")
				walk(child, lk, childSkip)
			}
		case []interface{}:
			for _, child := range v {
				walk(child, key, skip)
			}
		case string:
			if skip || len(v) < 600 {
				return
			}
			isHTML := strings.Contains(v, "<p") || strings.Contains(v, "<h")
			switch {
			case isHTML && contentKeysTier1[key] && len(v) > len(tier1):
				tier1 = v
			case isHTML && contentKeysTier2[key] && len(v) > len(tier2):
				tier2 = v
			case !isHTML && contentKeysText[key] && len(v) > len(text):
				text = v
			}
		}
	}
	walk(data, "", false)

	switch {
	case tier1 != "":
		return tier1
	case tier2 != "":
		return tier2
	case text != "":
		return textToHTML(text)
	}
	return ""
}

func textToHTML(s string) string {
	var b strings.Builder
	for _, para := range strings.Split(s, "\n\n") {
		para = strings.TrimSpace(para)
		if para != "" {
			b.WriteString("<p>")
			b.WriteString(html.EscapeString(para))
			b.WriteString("</p>")
		}
	}
	return b.String()
}

func textLen(htmlStr string) int {
	return len(strings.TrimSpace(tagRe.ReplaceAllString(htmlStr, " ")))
}
