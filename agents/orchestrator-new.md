You are Claude acting as a senior staff engineer. You have full read/write access to the repo on disk and can run shell commands. You must make the codebase PASS these gates:

- npm run qa:hsm-profile
- npm run qa:orchestrator
- node scripts/qa-walletpack.mjs

Repo root: /perform1/srv/work/myid-app
Backend service: myid-hsm (PM2) on port 6321
PWA: port 6230 (ngrok is separate; do not modify ngrok)

Non-negotiables:
1) NO hardcoded secrets. Secrets come from Vault kv-v2 ONLY (fail-closed).
2) Role separation: SO pin MUST NOT be accessible/used in runtime service paths. Only admin tooling may touch SO pins.
3) Remove any ESM import/export mismatches causing startup crashes.
4) Fix API-key validation so runtime accepts valid keys (N and N-1 rotation from Vault), and produces “Invalid API key” only when actually invalid.
5) Do not weaken security gates by making them trivially pass. If a gate is too strict, fix the implementation, not the gate, unless the gate is incorrectly flagging non-secret strings.

Current failures and symptoms you must resolve:
A) myid-hsm crashes at startup:
   - backend/routes/credentials.mjs imports { hsmSigner, certificateManager } from ../lib/hsm-signer.mjs but certificateManager is not exported.
   - backend/routes/qes.mjs imports QES_FORMATS from ../lib/hsm-signer.mjs but QES_FORMATS is not exported.
   -> Fix exports/imports consistently. Choose a correct architecture: either export these from hsm-signer.mjs OR refactor routes to import from their correct module(s). Must be correct, not a stub.

B) qa:hsm-profile failing:
   - Role Separation: Found 'so_pin' or 'SO_' in non-admin file:
     scripts/qa-hsm-profile.mjs
     backend/server.mjs
     backend/lib/hsm-vault.test.mjs
     backend/lib/hsm-vault.mjs
     backend/lib/hsm-tools.mjs
     backend/lib/hsm-session.mjs
   - Banner Display: Found process.env.HSM_SLOT or process.env.HSM_LABEL in server banner output.
   -> Implement proper separation:
      * Runtime service MUST only use usr_pin (and optionally km_pin if required for your design).
      * so_pin must be stored in Vault but may only be accessed by a dedicated admin-only script/tooling folder (e.g., backend/admin/ or scripts/admin/), never by backend runtime imports.
      * Remove literal strings 'so_pin'/'SO_' from runtime files. If needed, rename internal keys or map them at the admin boundary.
      * Fix qa-hsm-profile script itself if it contains those strings in a way that triggers its own scan (avoid self-flagging); keep its intent intact.

C) “Invalid API key provided” spam:
   - API keys are supposed to be fetched from Vault kv-v2 (myid/pwa/api etc). No env API_KEY.
   - Ensure middleware reads current and previous keys from Vault kv-v2 and uses constant-time compare.
   - Add one CLI helper to print (masked) whether Vault keys are present and whether the provided key matches N or N-1, WITHOUT printing the key values.

D) Redis shutdown noise:
   - “Error closing Redis connection: Connection is closed.”
   -> Make shutdown idempotent: closing Redis twice should not error. Must not mask real errors; only silence benign close-after-close.

Constraints:
- Do not add new paid dependencies.
- Keep Node version assumptions as-is (ESM).
- Keep existing tool commands for HSM remote:
  /usr/bin/p11tool2-remote uses commands like “ListSlots” (not --list-slots).
  /usr/bin/csadm-remote exists as fallback.
- HSM pins exist in Vault under c3-hsm/slot_0000 ... slot_0009 with fields so_pin, usr_pin, km_pin.
- Enabled slots are 0000 and 0007 for runtime, per logs; keep this ability.

Deliverables:
1) Code changes committed in a single commit with message:
   "fix: restore myid-hsm startup, vault api auth, and hsm role separation"
2) A short report file written to:
   /perform1/srv/work/myid-app/reports/fix-hsm-auth-<timestamp>/SUMMARY.md
   Include: what changed, which gates pass, and exact commands run.

Execution plan you MUST follow:
Step 0) Create a new report directory and log every command you run.
Step 1) Reproduce failures:
   - pm2 restart myid-hsm and capture logs
   - npm run qa:hsm-profile
   - npm run qa:orchestrator
Step 2) Fix startup ESM export/import errors:
   - Identify canonical module responsibilities: hsm-signer.mjs should export only what it truly implements.
   - Update routes to import correct symbols.
   - Add a tiny import-check gate: node -e "import('./backend/server.mjs')..."
Step 3) Fix role separation:
   - Refactor Vault HSM pin loading: runtime code must only request usr_pin/km_pin; admin-only code may request so_pin.
   - Ensure no runtime file contains the literal tokens so_pin or SO_.
   - Update qa-hsm-profile script so it does not self-trigger incorrectly but continues to enforce the policy.
Step 4) Fix API key validation:
   - Ensure middleware reads api keys from Vault kv-v2 path (determine actual path from codebase; likely kv-v2/myid/pwa/api).
   - Ensure N/N-1 works and is cached safely (short TTL) but fail-closed if Vault unavailable.
   - Add deprecation header for N-1 usage (already expected).
Step 5) Fix Redis shutdown:
   - Implement safe close: if already closed, do not throw.
Step 6) Run gates until green:
   - npm run qa:hsm-profile
   - npm run qa:orchestrator
   - node scripts/qa-walletpack.mjs
Step 7) Commit and write SUMMARY.md with evidence paths.

Now do it. Start by listing the repository tree relevant files:
backend/server.mjs
backend/routes/credentials.mjs
backend/routes/qes.mjs
backend/lib/hsm-signer.mjs
backend/lib/hsm-vault.mjs
backend/lib/hsm-session.mjs
backend/lib/hsm-tools.mjs
scripts/qa-hsm-profile.mjs
Then proceed as per plan.
