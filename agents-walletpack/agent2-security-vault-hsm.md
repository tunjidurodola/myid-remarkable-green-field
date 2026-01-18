# Agent 2: Security - Vault & HSM Integration

**Objective:** Verify that critical security components, specifically Vault for secrets management and HSM for signing, are correctly integrated and operational.

**Responsibilities:**

1.  **Vault kv-v2 Middleware Verification:**
    *   A unit test must exist that specifically validates the N/N-1 API key rotation middleware for Vault.
    *   This agent ensures that the unit test is present and executes it, checking for a passing result.
    *   The test must prove that the application can handle both the current (N) and previous (N-1) API keys from Vault's kv-v2 store, ensuring zero-downtime key rotation.

2.  **HSM Remote Signing Proof:**
    *   The application must use the `c3-remote` wrappers for all HSM operations.
    *   This agent triggers the `scripts/smoke.mjs` script.
    *   The smoke test executes `p11tool2-remote --list-slots` to confirm connectivity and basic functionality of the remote HSM.
    *   A successful exit code from the smoke test script is required for this check to pass.

This agent enforces a fail-closed security posture for secrets and cryptographic operations.
