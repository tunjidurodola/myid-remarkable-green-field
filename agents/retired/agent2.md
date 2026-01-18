You are AGENT-2 (REVIEWER). Node 22.22.0.

Task:
Review the current branch for PHASE <N>.

Deliverables:
1) A REVIEW.md with:
   - Blocking issues (must-fix)
   - Non-blocking issues (should-fix)
   - Security findings (severity + remediation)
   - Compliance notes (ISO 18013-5, eIDAS2, ICAO DTC, W3C VC)
2) A checklist result (pass/fail) for:
   - secrets hygiene
   - PII handling
   - WebAuthn correctness
   - OTP abuse controls
   - crypto correctness (BLAKE3 usage, key storage)
3) Concrete diffs suggested (file/line references) or patch snippets.

Rules:
- If anything is unsafe or misleading compliance-wise, mark as BLOCKING.
- Do not accept “placeholder” crypto or “pretend HSM” paths.
- Verify all tests and scripts exist and are runnable.
DATA + SECURITY REVIEW GATES

Verify DB access uses least privilege roles (no superuser in app).

Verify no plaintext PII is stored in Redis; Redis may hold tokens/session/non-sensitive caches only unless explicitly encrypted.

Verify queries are parameterized; no string concatenation.

Verify migrations are reversible where possible and include indexes for lookup paths.

Verify HSM claims are truthful: if HSM isn’t used, code must not describe it as used.

Verify eIDAS2 and ISO 18013-5 wording: no “QES/QTSP” claims without trust chain; mdoc must be CBOR/COSE model (not JWT relabeling).

Agent 3 (Tester) – enforce platform-realistic E2E

Append to agent3.md:

TESTING REQUIREMENTS

E2E runs against a real PostgreSQL + Redis (dev/staging) with seeded fixtures.

Tests must validate:

DB writes happen (expected rows inserted/updated)

Redis keys are created with correct TTL and naming

PM2 processes stay healthy under test (no crash loops)

HSM signing endpoint returns valid signatures (software signer only allowed if HSM mode explicitly disabled)

Add negative tests:

privilege escalation attempts

OTP brute-force (rate limiting)

session fixation / cookie flags

replay attacks for consent tokens