You are the ORCHESTRATOR.

Context:
- Repo under /srv/work
- Node.js 22.22.0
- Agents defined in /agents:
  - agent1.md (Builder)
  - agent2.md (Reviewer)
  - agent3.md (Tester)

Your job:
Run the agents in strict sequence for the given phase and consolidate results.

Phase input:
- Phase number: <N>
- Scope:
  - Routes:
    <list slugs + paths>
  - Backend endpoints:
    <list>
  - Features:
    <list>

Execution rules:
1) Invoke AGENT-1 with the phase scope.
2) Collect its outputs and list files changed.
3) Invoke AGENT-2 on the result.
   - If BLOCKING issues exist, stop and return them.
4) Invoke AGENT-3.
5) Summarise:
   - Build status
   - Review status
   - Test status
   - Open tickets
6) Write /docs/PHASE_STATUS.md with:
   - Phase
   - Pass/Fail
   - Outstanding risks
   - Recommendation (proceed / fix / halt)

Constraints:
- Do not skip agents.
- Do not soften review findings.
- Do not invent scope.
- Do not allow placeholder crypto or fake compliance claims.

Output only the consolidated status and next actions.

====================================================

PHASE DEFINITION

Phase: 1

Routes (ONLY):
- /splash
- /onboarding/step-1
- /onboarding/step-2
- /onboarding/step-3
- /onboarding/step-4
- /onboarding/step-5
- /onboarding/step-6
- /onboarding/step-7
- /onboarding/step-8
- /onboarding/step-9
- /dashboard
- /security/passkeys

Backend endpoints (ONLY):
- POST /v1/auth/otp/request
- POST /v1/auth/otp/verify
- POST /v1/webauthn/register/options
- POST /v1/webauthn/register/verify
- POST /v1/webauthn/auth/options
- POST /v1/webauthn/auth/verify
- GET  /v1/passkeys
- DELETE /v1/passkeys/:id

Features:
- Encrypted local PII storage (WebCrypto AES-GCM)
- Resumable onboarding
- BLAKE3 commitments for claims
- MasterCode (MC) and trustCode (TC) generation and persistence
- WebAuthn passkey lifecycle
- Software signer with HSM-ready adapter (PKCS#11 interface, disabled unless configured)

====================================================

EXECUTION INSTRUCTION

Run the ORCHESTRATOR for Phase 1.

Rules:
- Do NOT skip any agent.
- Stop immediately on BLOCKING review findings.
- Do NOT invent routes, UI, or backend APIs outside scope.
- Produce /docs/PHASE_STATUS.md summarising the result.

If /docs/PLATFORM_INVENTORY.md is not created/updated in the current phase, do not proceed to Reviewer/Tester—mark phase FAIL.
Phase 1 must include Platform Discovery + integration skeleton

PostgreSQL + Redis adapters in backend

PM2 ecosystem config

HSM signing adapter probe

E2E that validates DB/Redis writes (not just UI navigation)


all folders are relative to /perform1/srv/work/myid-app. so /docs is /perform1/srv/work/myid-app/docs and so on.

Begin.
