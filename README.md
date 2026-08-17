# KnowledgeCanvas

A visual knowledge base — organize PDFs, links, images, and rich-text notes in a
clean, uniform, Pinterest-style grid. Built to the
[PRD](../Downloads/PRD_KnowledgeCanvas.md) (v1.1, Core MVP — No AI).

**Stack:** Go (Gin + GORM) · PostgreSQL · Oracle Object Storage (S3-compatible) ·
React 18 + TypeScript + Vite · Tailwind + shadcn-style components · TipTap · dnd-kit.

The "Warm Scholar" design language from the PRD is implemented faithfully
(Instrument Serif + DM Sans, teal accent, fixed-height cards with per-type left
borders, slide-in detail panel).

---

## Features (P0 + P1 — all MVP items)

- Email/password auth (JWT, bcrypt cost 12, 7-day token in `localStorage`)
- Boards: create / view / update / delete, per-board sort & filter prefs
- Four item types: **note** (TipTap rich text), **link** (live OG-tag scraping via
  colly), **image** (upload + dimension extraction), **pdf** (upload + page count)
- Fixed-size responsive grid (4/3/2/1 columns), per-type left-border accents
- Drag-to-reorder (dnd-kit → `PATCH /reorder`)
- Pin to top, color labels, right-click context menu + overflow menu
- Slide-in detail panel with inline PDF/image/link/note view
- Comments on notes: highlight a passage to start a thread, with replies and resolve
- Full-text search across all item types (PostgreSQL `to_tsvector`, `UNION ALL`)
- Keyboard shortcuts: `Ctrl/⌘+N` new note, `Ctrl/⌘+K` / `Ctrl+F` search, `Esc` close panel
- Empty states, toasts, skeletons, reduced-motion support

---

## Quick start (local dev)

### Prerequisites
- Go 1.23+
- Node 18+
- PostgreSQL 14+ running locally (or `docker compose up -d` for the bundled one)

### 1. Database

```bash
# Option A — Docker
docker compose up -d

# Option B — local Postgres
createdb knowledgecanvas
```

Migrations (including the `pg_trgm` / `pgcrypto` extensions) run automatically on
server start — no manual migration step needed.

### 2. Backend

```bash
cd backend
cp .env.example .env          # adjust DATABASE_URL if needed
go run ./cmd/server           # starts on :8080, applies migrations
```

By default `STORAGE_DRIVER=local`, so uploads go to `backend/uploads/` and are
served from `/api/v1/files/*` — **no Oracle credentials required for development.**

### 3. Frontend

```bash
cd web
cp .env.example .env          # leave VITE_API_URL empty to use the dev proxy
npm install
npm run dev                   # starts on :5173, proxies /api -> :8080
```

Open http://localhost:5173, create an account, and start adding items.

---

## Switching to Oracle Object Storage (production)

Set these in `backend/.env` and the S3-compatible Oracle driver takes over
(presigned URLs, 24h for files / 7d for thumbnails — per PRD §7.3):

```bash
STORAGE_DRIVER=oracle
OCI_ACCESS_KEY=...
OCI_SECRET_KEY=...
OCI_STORAGE_ENDPOINT=https://{namespace}.compat.objectstorage.{region}.oraclecloud.com
OCI_BUCKET_NAME=knowledgecanvas-files
OCI_REGION=ap-mumbai-1
```

No code change required — see `backend/internal/storage/`.

---

## Project layout

```
knowledgecanvas/
├── backend/
│   ├── cmd/server/        # main + router wiring (+ router test)
│   ├── config/            # env loading
│   ├── migrations/        # SQL files, embedded + auto-applied
│   └── internal/
│       ├── models/        # GORM split-table models (canvas_items + child tables)
│       ├── database/      # connect + migration runner
│       ├── auth/          # JWT + bcrypt
│       ├── middleware/    # auth, CORS, rate limit
│       ├── storage/       # Storage interface: oracle.go + local.go
│       ├── scraper/       # colly OG-tag scraper
│       ├── pdfutil/       # pdfcpu page count
│       └── handlers/      # HTTP handlers (auth, boards, items, comments, search)
├── web/
│   └── src/
│       ├── api/           # axios clients
│       ├── stores/        # zustand auth store
│       ├── hooks/         # React Query hooks
│       ├── components/    # ui/, grid/, items/, sidebar/, board/, detail/, editor/, search/
│       ├── pages/         # Login, Register, App
│       └── styles/        # globals.css (Warm Scholar tokens) + tokens.ts
└── docker-compose.yml     # Postgres only
```

---

## Tests

```bash
cd backend && go test ./...      # router registration + route-presence test
cd web && npm run build          # tsc typecheck + vite production build
```

---

## Deviations from the PRD (and why)

These are the only departures from a literal reading of the spec; each is a
forced technical constraint, not a scope cut.

1. **Type-specific item routes are top-level, not nested under `/items/`.**
   The PRD lists `POST /api/v1/items/notes` etc. alongside `GET /api/v1/items/:id`.
   Gin's radix-tree router cannot have a static segment (`notes`) and a path
   param (`:id`) at the same position, and requires a single param name per
   position. So the routes are:
   - `POST /api/v1/notes` · `POST /api/v1/links` · `POST /api/v1/pdfs` · `POST /api/v1/images`
     (and their `PUT /:id` updates)
   - shared item ops stay at `/api/v1/items/:id`, `/items/:id/pin`,
     `/items/:id/color`, `/items/:id/comments`, `/boards/:id/reorder`
   The frontend uses these paths, so the contract is internally consistent.
   (A test in `cmd/server/main_test.go` guards against route conflicts.)

2. **PDF grid thumbnails are a styled placeholder; the detail panel renders the
   real PDF.** Rasterising a PDF page to JPEG in pure Go isn't supported by
   pdfcpu (it edits PDF structure, it doesn't render). Rather than pull in a
   CGo rasteriser, the grid card shows a PDF placeholder with filename + page
   count, and the detail panel renders the document inline from the presigned
   URL via the browser's native PDF viewer (an `<iframe>`, in place of react-pdf
   — simpler and dependency-free, same result). Page count *is* extracted with
   pdfcpu. Drop a rasteriser into `internal/pdfutil` later if grid thumbnails
   are wanted.

3. **Local-filesystem storage driver added** alongside the Oracle driver, so the
   app runs end-to-end with zero cloud setup in development. Production uses
   Oracle by flipping `STORAGE_DRIVER` (see above).

4. **shadcn components are hand-authored** (Radix primitives + cva, themed with
   the PRD tokens) rather than generated via `npx shadcn add`, which needs
   interactive/network setup. They live in `web/src/components/ui/` exactly as
   shadcn would place them, re-themed per PRD §6.5.12.
```
