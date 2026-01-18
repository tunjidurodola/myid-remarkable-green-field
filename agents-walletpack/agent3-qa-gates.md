# Agent 3: QA Gates Enforcement

**Objective:** Act as the final quality gate before deployment, running a series of automated checks to catch common issues.

**Responsibilities:**

1.  **No Hardcoded Secrets Scan:**
    *   Execute a static analysis scan to detect any hardcoded secrets (API keys, passwords, private keys) in the codebase.
    *   The scan must intelligently exclude directories that are not part of the production bundle, such as `docs/`, `reports/`, and `node_modules/`.

2.  **Route Map Consistency:**
    *   Confirm that the output from `Agent 1` (UX Route Crawl) shows no discrepancies. The UI route map must exactly match `route-manifest.json

3.  **Security Checks:**
    *   Confirm that the checks from `Agent 2` (Vault & HSM) have passed successfully.

**Implementation:**

*   These gates are implemented in the `scripts/qa-walletpack.mjs` script, which this agent will execute.
*   The script serves as the single point of execution for all Wallet-Pack QA checks.
