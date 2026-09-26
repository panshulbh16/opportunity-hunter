#!/usr/bin/env bash
# Post-deploy gate: fails unless $1 serves commit $2 (public/version.txt written by CI) within ~6 min,
# and key pages load with no-store so nobody sees a stale copy.
set -euo pipefail
site=${1%/} sha=$2 live=""
for _ in $(seq 1 72); do
  live=$(curl -fsS "$site/version.txt?v=$sha-$RANDOM" 2>/dev/null | tr -d '[:space:]' || true)
  [ "$live" = "$sha" ] && break
  sleep 5
done
[ "$live" = "$sha" ] || { echo "✗ live version is '${live:-none}', expected $sha"; exit 1; }
echo "✓ $sha is live at $site"
for path in / /pricing /login /privacy /terms; do
  headers=$(curl -fsS -o /dev/null -D - "$site$path" | tr -d '\r')
  grep -qiE '^cache-control:.*no-store' <<<"$headers" || { echo "✗ $path is cacheable"; exit 1; }
  echo "✓ $path fresh"
done
