#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Building web..."
cd "$ROOT/web"
export VITE_API_URL=https://scalene.santosh.work
# npm ci
npm run build
echo "    Web build complete → web/dist"

echo "==> Building backend (linux/amd64)..."
cd "$ROOT/backend"
GOOS=linux GOARCH=amd64 go build -o "$ROOT/backend/kc-server" ./cmd/server
echo "    Backend build complete → backend/kc-server"

echo "==> All builds done."

echo $PWD

ssh -i ~/.ssh/ssh-key-2026-06-26.key ubuntu@129.154.232.237 "rm -f /home/ubuntu/app/kc-server"
scp -i ~/.ssh/ssh-key-2026-06-26.key "$ROOT/backend/kc-server" ubuntu@129.154.232.237:/home/ubuntu/app/
scp -i ~/.ssh/ssh-key-2026-06-26.key -r "$ROOT/web/dist/" ubuntu@129.154.232.237:/var/www/scalene/
ssh -i ~/.ssh/ssh-key-2026-06-26.key ubuntu@129.154.232.237 "sudo systemctl restart scalene"


