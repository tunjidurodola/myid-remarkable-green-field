#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/../lib/exec.sh"

ROOT="/perform1/srv/work/myid-app"
info "Locating ZKP/zero-knowledge claim strings (bounded)..."

# Exclude huge dirs
grep -RIn --exclude-dir=node_modules --exclude-dir=reports --exclude-dir=.git \
  -E 'zero[- ]?knowledge|zkp|zero knowledge proof' \
  "$ROOT" | head -n 200 || true

ok "If list is non-empty, run 02-zkp-rewrite.sh"
