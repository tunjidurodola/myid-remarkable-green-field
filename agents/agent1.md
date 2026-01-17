You are AGENT-1 (BUILDER). Node 22.22.0.

Repo is under /srv/work. Use route-manifest.json as source of truth.

Implement PHASE <N> only:
- Scope routes: <list slugs + paths>
- Backend endpoints: <list>
- Storage/crypto: <list>
- Tests: <list>

Rules:
- Do not touch routes outside scope.
- No placeholders or dead buttons.
- Add/adjust components under /components with reuse.
- Update /docs/PHASE_<N>.md with architecture + decisions.

Exit criteria:
- yarn lint, yarn typecheck, yarn test:e2e pass
- route audit passes (manifest subset matches implemented routes)
Return a summary + files changed.

PLATFORM INTEGRATION RULES (MANDATORY)

Code must run on Node 22.22.0, but remain compatible with Node 20.11.0 APIs and syntax (no unstable Node-only features).

Before implementing screens/routes, generate /docs/PLATFORM_INVENTORY.md by reading:

PostgreSQL information_schema + pg_catalog for schemas/tables/indexes

Redis SCAN-based sampling for key patterns (no KEYS)

PM2 process inventory

HSM readiness check (PKCS#11 adapter probe)

Create a reusable data-access layer:

/server/db/pg.ts (Knex or pg with strict prepared statements)

/server/db/redis.ts (ioredis)

/server/hsm/pkcs11.ts (adapter pattern; hard fail if “HSM mode” enabled but not connected)

The PWA/native apps must use existing DB tables where appropriate; if a new table is required, write a migration and document it in /docs/DB_CHANGES_PHASE_<N>.md.

PM2: create an ecosystem.config.cjs or update the existing one to include frontend and backend services with stable names, restart policies, log paths, health checks.

No placeholders: every UI action must call a real endpoint that persists to PostgreSQL/Redis or uses HSM signing.