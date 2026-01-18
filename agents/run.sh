BASE="/perform1/srv/work/myid-app/agents"
#!/usr/bin/env bash
set -euo pipefail
. "$(dirname "$0")/lib/exec.sh"

info "myID agents orchestrator (local)."

# Step 1: run fixpack gate
set +e
"$(dirname "$0")/agents/00-fixpack-gate.sh"
rc=$?
set -e

if [ "$rc" -eq 0 ]; then
  ok "All green."
  exit 0
fi

echo
info "Next suggested actions (choose 1 based on the failure):"
echo "  A) If ZKP / zero-knowledge claims are mentioned: run:"
echo "     $BASE/agents/01-zkp-sources.sh"
echo "     $BASE/agents/02-zkp-rewrite.sh"
echo "     then re-run: $BASE/agents/00-fixpack-gate.sh"
echo
echo "  B) If fixpack is failing due to huge reports/evidence: run:"
echo "     $BASE/agents/03-exclude-reports.sh"
echo "     then re-run: $BASE/agents/00-fixpack-gate.sh"
echo
echo "If the tail output shows a different blocker (signature stubs, glob vuln), stop here and paste the last 30 lines from:"
echo "  /perform1/srv/work/myid-app/agents/reports/fixpack.last.txt"
exit "$rc"
