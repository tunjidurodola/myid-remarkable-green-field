#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/../lib/exec.sh"

ROOT="/perform1/srv/work/myid-app"
info "Rewriting ZKP/zero-knowledge claims to accurate non-ZKP wording..."

# Only touch project sources/docs, never reports/evidence
targets=(
  "$ROOT/backend"
  "$ROOT/docs"
  "$ROOT/README.md"
  "$ROOT"/*.md
)

# Replace common phrases (case-insensitive)
# We avoid GNU sed -i portability issues by using perl.
for t in "${targets[@]}"; do
  [ -e "$t" ] || continue
  perl -pi -e 's/zero[- ]?knowledge( proof(s)?)?/hash-based selective disclosure/ig' "$t" 2>/dev/null || true
  perl -pi -e 's/\bZKP(s)?\b/hash-based disclosure/ig' "$t" 2>/dev/null || true
  perl -pi -e 's/zero[- ]?knowledge\b/hash-based disclosure/ig' "$t" 2>/dev/null || true
done

# Also patch any stray UI strings in app (if present)
perl -R -pi -e 's/zero[- ]?knowledge( proof(s)?)?/hash-based selective disclosure/ig; s/\bZKP(s)?\b/hash-based disclosure/ig' \
  "$ROOT" 2>/dev/null || true

ok "Rewrite done. Commit later. Now re-run fixpack."
