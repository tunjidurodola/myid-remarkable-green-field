#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/../lib/exec.sh"

ROOT="/perform1/srv/work/myid-app"
OUT="$ROOT/agents/reports/fixpack.last.txt"

info "Running fixpack (capturing tail only)..."
set +e
"$ROOT/fixpack/run.sh" >"$OUT" 2>&1
rc=$?
set -e

tail -n 80 "$OUT" || true
echo
if [ "$rc" -eq 0 ]; then
  ok "fixpack GREEN (exit 0)"
  exit 0
fi

echo "[INFO] fixpack exit=$rc"
# Try to detect which internal script blocked, but don't assume format
blocker="$(grep -Eo '\[FAIL\].*' "$OUT" | tail -n 1 || true)"
[ -n "$blocker" ] && echo "[INFO] blocker: $blocker"
exit "$rc"
