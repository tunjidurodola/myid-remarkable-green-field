# Wallet-Pack Orchestrator

This orchestrator coordinates the Wallet-Pack agents to ensure the application meets UX, security, and QA standards for the digital wallet features.

**Execution Flow:**

1.  **Agent 1 (UX Route Crawl):**
    *   Crawls the single source of truth for UI screens: `https://myid.africa/screens/`.
    *   Parses the result to build a canonical route map.
    *   Compares this map against the local `route-manifest.json`.
    *   Fails the build if there is any mismatch, enforcing pixel-perfect UI alignment.

2.  **Agent 2 (Security Vault & HSM):**
    *   Verifies the Vault kv-v2 N/N-1 API key middleware is correctly implemented via a dedicated unit test.
    *   Performs a smoke test on the HSM remote signing infrastructure by invoking `p11tool2-remote` in list/slot mode to confirm connectivity.

3.  **Agent 3 (QA Gates):**
    *   Executes a comprehensive scan for hardcoded secrets, excluding non-production directories (`docs`, `reports`, `node_modules`).
    *   Runs the full suite of acceptance gates defined in `scripts/qa-walletpack.mjs`.
    *   Aggregates results and produces a final pass/fail report for the build.

The orchestration is fail-fast: any failure in an earlier agent halts the entire process.
