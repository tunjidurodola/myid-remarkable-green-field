#!/bin/bash
##
## Crypto Pack Orchestrator
##
## Runs 3 agents in sequence to implement real cryptographic verification
## and HSM-backed signing with Vault kv-v2 secrets.
##
## AGENTS:
## 1. agent1-crypto-implementer.mjs - Replace stubs with real crypto
## 2. agent2-vault-hardening.mjs - Ensure all secrets from Vault
## 3. agent3-qa-security-audit.mjs - Validate and generate evidence
##
## OUTPUT: Reports in /perform1/srv/work/myid-app/reports/crypto-pack/YYYYMMDD-HHMMSS/
##

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="/perform1/srv/work/myid-app"
REPORTS_BASE="${APP_ROOT}/reports/crypto-pack"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
REPORT_DIR="${REPORTS_BASE}/${TIMESTAMP}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        Crypto Pack Orchestrator - myID Application         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Timestamp:${NC} ${TIMESTAMP}"
echo -e "${BLUE}Report Directory:${NC} ${REPORT_DIR}"
echo ""

# Create report directory
mkdir -p "${REPORT_DIR}"

# Initialize orchestrator log
ORCHESTRATOR_LOG="${REPORT_DIR}/orchestrator.log"
exec > >(tee -a "${ORCHESTRATOR_LOG}") 2>&1

echo "[$(date -Iseconds)] Orchestrator started"

# Agent execution function
run_agent() {
    local agent_num=$1
    local agent_script=$2
    local agent_name=$3

    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Running Agent ${agent_num}: ${agent_name}${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    local agent_log="${REPORT_DIR}/agent${agent_num}.log"
    local start_time=$(date +%s)

    # Run agent with report directory env var
    if REPORT_DIR="${REPORT_DIR}" node "${SCRIPT_DIR}/${agent_script}" 2>&1 | tee "${agent_log}"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        echo ""
        echo -e "${GREEN}✓ Agent ${agent_num} completed successfully in ${duration}s${NC}"
        echo "[$(date -Iseconds)] Agent ${agent_num} PASSED (${duration}s)" >> "${ORCHESTRATOR_LOG}"
        return 0
    else
        local exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        echo ""
        echo -e "${RED}✗ Agent ${agent_num} failed with exit code ${exit_code} after ${duration}s${NC}"
        echo "[$(date -Iseconds)] Agent ${agent_num} FAILED (${duration}s, exit=${exit_code})" >> "${ORCHESTRATOR_LOG}"
        return ${exit_code}
    fi
}

# Track overall status
OVERALL_STATUS=0

# Run Agent 1: Crypto Implementer
run_agent 1 "agent1-crypto-implementer.mjs" "Crypto Implementer"
AGENT1_STATUS=$?
if [ $AGENT1_STATUS -ne 0 ]; then
    echo -e "${YELLOW}⚠ Agent 1 had issues, continuing to Agent 2...${NC}"
    OVERALL_STATUS=1
fi

# Run Agent 2: Vault Hardening
run_agent 2 "agent2-vault-hardening.mjs" "Vault Hardening"
AGENT2_STATUS=$?
if [ $AGENT2_STATUS -ne 0 ]; then
    echo -e "${YELLOW}⚠ Agent 2 had issues, continuing to Agent 3...${NC}"
    OVERALL_STATUS=1
fi

# Run Agent 3: QA Security Audit (always run for evidence)
run_agent 3 "agent3-qa-security-audit.mjs" "QA Security Audit"
AGENT3_STATUS=$?
if [ $AGENT3_STATUS -ne 0 ]; then
    echo -e "${RED}✗ Agent 3 (Security Audit) failed${NC}"
    OVERALL_STATUS=1
fi

# Generate final summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Orchestrator Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

SUMMARY_FILE="${REPORT_DIR}/SUMMARY.md"

cat > "${SUMMARY_FILE}" <<EOF
# Crypto Pack Execution Summary

**Timestamp:** ${TIMESTAMP}
**Report Directory:** ${REPORT_DIR}

## Agent Results

| Agent | Name | Status | Exit Code |
|-------|------|--------|-----------|
| 1 | Crypto Implementer | $([ $AGENT1_STATUS -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL") | ${AGENT1_STATUS} |
| 2 | Vault Hardening | $([ $AGENT2_STATUS -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL") | ${AGENT2_STATUS} |
| 3 | QA Security Audit | $([ $AGENT3_STATUS -eq 0 ] && echo "✓ PASS" || echo "✗ FAIL") | ${AGENT3_STATUS} |

## Files Generated

EOF

# List all report files
echo "### Agent Reports" >> "${SUMMARY_FILE}"
echo "" >> "${SUMMARY_FILE}"
for report in "${REPORT_DIR}"/*.json; do
    if [ -f "$report" ]; then
        echo "- \`$(basename "$report")\`" >> "${SUMMARY_FILE}"
    fi
done

echo "" >> "${SUMMARY_FILE}"
echo "### Logs" >> "${SUMMARY_FILE}"
echo "" >> "${SUMMARY_FILE}"
for log in "${REPORT_DIR}"/*.log; do
    if [ -f "$log" ]; then
        echo "- \`$(basename "$log")\`" >> "${SUMMARY_FILE}"
    fi
done

# Add security audit summary if available
if [ -f "${REPORT_DIR}/SECURITY_AUDIT_SUMMARY.md" ]; then
    echo "" >> "${SUMMARY_FILE}"
    echo "## Security Audit Details" >> "${SUMMARY_FILE}"
    echo "" >> "${SUMMARY_FILE}"
    echo "See [\`SECURITY_AUDIT_SUMMARY.md\`](./SECURITY_AUDIT_SUMMARY.md) for detailed findings." >> "${SUMMARY_FILE}"
fi

# Add next steps
cat >> "${SUMMARY_FILE}" <<EOF

## Overall Status

$([ $OVERALL_STATUS -eq 0 ] && echo "✅ **ALL AGENTS PASSED**" || echo "❌ **SOME AGENTS FAILED - Review logs above**")

## Next Steps

1. Review individual agent reports in this directory
2. Address any critical findings from Agent 3 (Security Audit)
3. Commit changes per agent (see git instructions below)
4. Configure HSM PKCS#11 integration if not already done
5. Load secrets into Vault kv-v2 paths
6. Run integration tests

## Git Commit Instructions

Create one commit per agent:

\`\`\`bash
# Commit Agent 1 changes
git add backend/lib/eidas2.mjs backend/lib/hsm-signer.mjs backend/lib/verifiers.test.mjs
git commit -m "crypto: implement real eIDAS2 JWS verification and HSM PKCS#11 integration

- Replace eIDAS2 PIDVerifier.verifySignature stub with real jose JWS verification
- Replace HSM simulation with PKCS#11 integration stubs (graphene-pk11/p11tool2-remote)
- Add eIDAS2 verification test fixtures
- Requires PKCS#11 library configuration for production HSM signing

Refs: crypto-pack agent1-crypto-implementer"

# Commit Agent 2 changes
git add backend/server.mjs backend/lib/secrets.mjs
git commit -m "vault: implement API key rotation and harden secrets management

- Add N vs N-1 API key validation with 24h grace period
- Add deprecated API key warnings (X-API-Key-Deprecated header)
- Remove fallback secrets, enforce fail-closed on missing Vault secrets
- Ensure all secrets from Vault kv-v2 paths only

Refs: crypto-pack agent2-vault-hardening"

# Commit Agent 3 (reports and evidence)
git add reports/crypto-pack/${TIMESTAMP}/
git commit -m "docs: add crypto-pack security audit report ${TIMESTAMP}

- Security audit validates real crypto verification implementations
- Documents compliance status for ISO 18013-5, eIDAS2, ICAO DTC, W3C DID/VC
- Evidence of Vault secrets hardening
- Recommendations for HSM PKCS#11 configuration

Refs: crypto-pack agent3-qa-security-audit"
\`\`\`

## Evidence Files

All evidence and reports are in: \`${REPORT_DIR}\`

EOF

# Display summary
cat "${SUMMARY_FILE}"

echo ""
echo -e "${BLUE}[$(date -Iseconds)] Orchestrator completed${NC}"
echo -e "${BLUE}Full summary: ${SUMMARY_FILE}${NC}"
echo ""

if [ $OVERALL_STATUS -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    ✓ ALL AGENTS PASSED                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
else
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║           ⚠ SOME AGENTS HAD ISSUES - SEE LOGS             ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
fi

exit $OVERALL_STATUS
