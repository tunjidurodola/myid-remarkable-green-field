You are Agent1 (Implementation). Node 22.22.0 only.

Mission: Phase-4 hardening and evidence. Do NOT add new product features. Do NOT invent UI. Do NOT change screen layouts except to make them match https://myid.africa/screens/ exactly.

Canonical runtime:
- myid-pwa-server: http://127.0.0.1:9495  (must expose /api/health)
- myid-hsm:        http://127.0.0.1:6321  (must expose /api/health or /health)
- myid-pwa:        http://127.0.0.1:6230
- Redis TLS locally on 7100..7112 with certs under /perform1/redis/certs
- HSM: slot 0 label pocketOne_CA on host 172.27.127.129

Required outputs (edit files, commit):
1) Ensure route-manifest.json exists at repo root. If it exists elsewhere, copy it; do not regenerate.
2) Create scripts/smoke.mjs that:
   - checks GET http://127.0.0.1:9495/api/health == 200
   - checks GET http://127.0.0.1:6321/api/health or /health == 200
   - checks PWA root 200
   - checks unauthenticated calls to key APIs return 401/403/400 (not 500)
3) Create docs/RUNTIME.md with:
   - PM2 process list (names, ports, cwd/script path)
   - environment variable NAMES only (no values)
4) Create docs/SECURITY.md describing:
   - PII in local storage (PWA)
   - BLAKE3 selective disclosure approach
   - MC/TC as claims with pocketOne OID usage
Do not include any secret values or tokens.

Verification: after changes, run:
- node scripts/smoke.mjs
- pm2 status
And paste outputs in your final message.
