#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/../lib/exec.sh"

ROOT="/perform1/srv/work/myid-app"
info "Finding compliance-claim strings that cause fixpack Agent05 to block (bounded)..."

grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=reports \
  -E 'ISO 18013-5|18013-5|eIDAS2|eIDAS 2|ICAO DTC|DTC compliant|W3C DID|W3C VC|compliant|certified|audit[- ]ready|zero[- ]?knowledge|zkp' \
  "$ROOT" | head -n 220 || true

ok "If list is non-empty, run 05-compliance-claim-rewrite.sh"
