#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/../lib/exec.sh"

ROOT="/perform1/srv/work/myid-app"
info "Rewriting risky compliance claims to accurate 'prototype/targeting' language..."

# Only touch code/docs; never touch evidence/reports
paths=(
  "$ROOT/backend"
  "$ROOT/docs"
  "$ROOT/README.md"
  "$ROOT"/*.md
)

for p in "${paths[@]}"; do
  [ -e "$p" ] || continue

  # Replace absolute compliance claims with forward-looking language
  perl -pi -e 's/\b(ISO\s*18013-5|18013-5)\s+compliant\b/ISO 18013-5 targeting (prototype)/ig' "$p" 2>/dev/null || true
  perl -pi -e 's/\b(eIDAS\s*2(\.0)?)\s+compliant\b/eIDAS2 targeting (prototype)/ig' "$p" 2>/dev/null || true
  perl -pi -e 's/\bICAO\s+DTC\s+compliant\b/ICAO DTC targeting (prototype)/ig' "$p" 2>/dev/null || true
  perl -pi -e 's/\bW3C\s+(DID|VC)\s+compliant\b/W3C DID/VC targeting (prototype)/ig' "$p" 2>/dev/null || true

  # Remove "certified/audit-ready" claims
  perl -pi -e 's/\baudit[- ]ready\b/internal demo readiness/ig' "$p" 2>/dev/null || true
  perl -pi -e 's/\bcertified\b/targeting certification/ig' "$p" 2>/dev/null || true

  # ZKP language: keep feature but stop claiming ZKP
  perl -pi -e 's/zero[- ]?knowledge( proof(s)?)?/hash-based selective disclosure/ig' "$p" 2>/dev/null || true
  perl -pi -e 's/\bZKP(s)?\b/hash-based disclosure/ig' "$p" 2>/dev/null || true
done

ok "Rewrite done. Now re-run fixpack gate."
