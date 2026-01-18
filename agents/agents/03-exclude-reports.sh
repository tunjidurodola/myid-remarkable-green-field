#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/../lib/exec.sh"

ROOT="/perform1/srv/work/myid-app"
info "Ensuring reports/evidence cannot block scanners..."

mkdir -p "$ROOT/.artifacts"
if [ -d "$ROOT/reports" ]; then
  ts="$(date +%Y%m%d-%H%M%S)"
  mv "$ROOT/reports" "$ROOT/.artifacts/reports.$ts"
  mkdir -p "$ROOT/reports"
  ok "Moved reports -> .artifacts/reports.$ts and recreated empty reports/"
else
  ok "No reports/ directory found; nothing to move."
fi

ok "Re-run fixpack."
