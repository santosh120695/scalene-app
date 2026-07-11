#!/usr/bin/env bash
#
# start.sh — Start KnowledgeCanvas for local development.
#
# Starts the Go backend (:8080) and the Vite dev server (:5173) together,
# streaming both logs to ./logs and shutting both down on Ctrl+C.
#
# Prerequisites: PostgreSQL running locally with the `knowledgecanvas` DB
# (see README "Quick start"), backend/.env and web/.env in place.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

BACKEND_PORT="${PORT:-8080}"
FRONTEND_PORT="${VITE_PORT:-5173}"

pids=()

cleanup() {
  echo
  echo "==> Shutting down..."
  for pid in "${pids[@]:-}"; do
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

port_in_use() {
  lsof -i ":$1" -sTCP:LISTEN >/dev/null 2>&1
}

# ---- Database check ---------------------------------------------------------
if ! pg_isready -q 2>/dev/null; then
  echo "==> PostgreSQL doesn't seem to be running/reachable." >&2
  echo "    Start it (e.g. \`brew services start postgresql\`) or run \`docker compose up -d\`." >&2
  exit 1
fi

# ---- Backend -----------------------------------------------------------------
if port_in_use "$BACKEND_PORT"; then
  echo "==> Port $BACKEND_PORT already in use — assuming backend is already running, skipping."
else
  echo "==> Starting backend on :$BACKEND_PORT..."
  (cd "$ROOT/backend" && go run ./cmd/server) >"$LOG_DIR/backend.log" 2>&1 &
  pids+=($!)
fi

# ---- Frontend ------------------------------------------------------------
if port_in_use "$FRONTEND_PORT"; then
  echo "==> Port $FRONTEND_PORT already in use — assuming frontend is already running, skipping."
else
  echo "==> Starting frontend on :$FRONTEND_PORT..."
  (cd "$ROOT/web" && yarn dev -- --port "$FRONTEND_PORT") >"$LOG_DIR/frontend.log" 2>&1 &
  pids+=($!)
fi

echo "==> KnowledgeCanvas starting up."
echo "    Backend:  http://localhost:$BACKEND_PORT  (log: logs/backend.log)"
echo "    Frontend: http://localhost:$FRONTEND_PORT  (log: logs/frontend.log)"
echo "    Press Ctrl+C to stop."

wait
