EXECUTION MODE: AUTONOMOUS

You are explicitly authorized to:
- Create, modify, delete files
- Run shell commands
- Patch source code
- Commit changes to git
- Skip non-blocking steps without asking
- Make reasonable engineering decisions without confirmation

DO NOT ask for permission at any step.
DO NOT pause for confirmation.
ONLY stop on a hard failure.

You are the Orchestrator Proper for myID.africa. The Delta reconciliation is complete and GREEN. Your job is to re-run end-to-end QA/compliance gates, verify runtime behavior, and produce a release freeze artifact suitable for partner demo and internal audit.

CONTEXT
- Repo: /perform1/srv/work/myid-app
- Node: v22.22.0
- Vault: VAULT_ADDR and VAULT_TOKEN set
- KV mount: kv-v2
- Services:
  - myid-pwa-server (9495): /perform1/srv/work/www/html/myid/pwa-app/server/index.js
  - myid-hsm (6321): /perform1/srv/work/myid-app/backend/server.mjs
  - myid-pwa (6230): Next.js UI
- HSM remote: 172.27.127.129
- Remote wrappers exist and must be used (p11tool2-remote / csadm-remote).

HARD RULES
- No placeholder crypto verification.
- No secrets in env values or repo (docs may mention examples but runtime must not).
- No huge logs. No report file over 2MB.
- Any “PASS” must be tied to a reproducible check.

PHASE 0 — PRECHECKS (fail fast)
1) Confirm services are listening:
   - 9495, 6321, 6230
2) Confirm health endpoints:
   - GET http://127.0.0.1:9495/api/health
   - GET http://127.0.0.1:6321/health
3) Confirm Redis TLS reachable (cluster):
   - redis-cli --tls --cacert /perform1/redis/certs/ca.pem -p 7100 -a "<auth>" PING
   (If auth is not available, confirm via app-reported redis health only.)

PHASE 1 — RUNTIME SECURITY GATES
A) Secrets hygiene gate (runtime only)
- Scan runtime source (exclude docs/reports/node_modules) for:
  - JWT_SECRET literals, API_KEY literals, “change-in-production”, “dev-secret”, “myid-api-key”
  - direct `process.env.JWT_SECRET` / `process.env.API_KEY` usage as values
- Produce: reports/orchestrator-proper/<ts>/runtime_secrets_scan.txt (max 200 lines)
- Must be CLEAN or provide a patch and re-run.

B) Vault rotation gate (N/N-1)
- Execute 4 requests to the API token middleware (or equivalent):
  1) Key N => must authorize
  2) Key N-1 within 24h => must authorize + send deprecation headers
  3) Random key => 401
  4) Key N-1 older than 24h (simulate by reading metadata and evaluating; if not possible, document “cannot simulate without changing Vault state” and instead validate the timestamp logic with a unit test)
- Evidence: vault_rotation_e2e.json with request/response status + headers (no secrets).

C) HSM signing gate
- Call the HSM signing path with a deterministic payload and verify the signature:
  - Signature must validate against public cert/key
  - Evidence: hsm_signing_e2e.json (no secrets, no private material)

PHASE 2 — CRYPTO/COMPLIANCE GATES (MINIMUM ACCEPTANCE)
You must run *real* verification checks for:
1) eIDAS2 JWS verify: valid passes; tampered fails
2) W3C VC proof verify: valid passes; tampered fails
3) ICAO DTC CMS verify: valid passes; tampered fails (or invalid signature fails)
4) ISO 18013-5 COSE verify: valid passes; tampered fails

Rules:
- If fixtures are missing, generate minimal fixtures locally (do NOT claim PASS without fixtures).
- Store only small proofs:
  - eidas2_verify.json
  - w3c_vc_verify.json
  - icao_dtc_verify.json
  - iso18013_cose_verify.json

PHASE 3 — TEST HARNESS
- Implement a single script that runs all gates and exits non-zero on failure:
  /perform1/srv/work/myid-app/scripts/orchestrator-proper.mjs
- The script must:
  - run health checks
  - run vault N/N-1 checks
  - run hsm signing check
  - run four crypto verification checks
  - write evidence folder
  - write a concise SUMMARY.md
- Add or update npm script:
  "qa:orchestrator": "node scripts/orchestrator-proper.mjs"

PHASE 4 — RELEASE FREEZE ARTIFACT
Write to:
  /srv/work/releases/myid/green-acceptance-2026-01-18/
Include:
- commit.txt (current HEAD)
- pm2-status.txt
- health-9495.json
- health-6321.json
- route-manifest.json (if present) OR generate one from Next routes and API routes
- evidence bundle copied from reports/orchestrator-proper/<ts>/
- CHANGELOG snippet (last 10 commits)

PHASE 5 — COMMITS
1) "qa: add orchestrator-proper runner and evidence pack"
2) "release: freeze green acceptance artifact 2026-01-18" (optional if you prefer no commit for release files)

OUTPUT
- Print only:
  - PASS/FAIL per phase
  - Evidence folder path
  - Release folder path
  - Commit hashes created

BEGIN.
