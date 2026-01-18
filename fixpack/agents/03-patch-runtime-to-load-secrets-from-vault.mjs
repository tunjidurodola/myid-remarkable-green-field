import fs from "node:fs";
import path from "node:path";
import { execCmd } from "../lib/exec.mjs";
import { ok, writeText } from "../lib/report.mjs";

// Create shared runtime module (no repo-specific assumptions beyond ESM support)
const modPath = "/perform1/srv/work/myid-app/fixpack/vault-secrets-loader.mjs";
fs.writeFileSync(modPath, `/**
 * Vault KV v2 secret loader (runtime)
 * Reference Node.js v20.11.0
 *
 * Env allowed:
 *   VAULT_ADDR, VAULT_TOKEN, VAULT_KV_MOUNT (default kv-v2)
 *   VAULT_PATH_* values (optional overrides)
 *
 * IMPORTANT: Do not store JWT/API secrets in env; store only Vault pointers and Vault token.
 */
export async function loadMyIdSecrets(opts = {}) {
  const VAULT_ADDR = (process.env.VAULT_ADDR || "").replace(/\\/+$/, "");
  const VAULT_TOKEN = process.env.VAULT_TOKEN || "";
  const MOUNT = process.env.VAULT_KV_MOUNT || "kv-v2";
  if (!VAULT_ADDR || !VAULT_TOKEN) throw new Error("VAULT_ADDR/VAULT_TOKEN must be set");

  const paths = {
    pwaJwt: process.env.VAULT_PATH_PWA_JWT || "myid/pwa/jwt",
    pwaApi: process.env.VAULT_PATH_PWA_API || "myid/pwa/api",
    hsmJwt: process.env.VAULT_PATH_HSM_JWT || "myid/hsm/jwt",
    hsmApi: process.env.VAULT_PATH_HSM_API || "myid/hsm/api"
  };

  async function kv2read(p) {
    const url = \`\${VAULT_ADDR}/v1/\${MOUNT}/data/\${p}\`;
    const res = await fetch(url, { headers: { "X-Vault-Token": VAULT_TOKEN } });
    const text = await res.text();
    if (!res.ok) throw new Error(\`Vault read failed \${MOUNT}/\${p}: HTTP \${res.status} \${text.slice(0,200)}\`);
    const j = JSON.parse(text);
    return j?.data?.data || {};
  }

  const [pwaJwt, pwaApi, hsmJwt, hsmApi] = await Promise.all([
    kv2read(paths.pwaJwt),
    kv2read(paths.pwaApi),
    kv2read(paths.hsmJwt),
    kv2read(paths.hsmApi)
  ]);

  // Required keys
  const jwt_secret = String(pwaJwt.jwt_secret || "").trim();
  const api_key = String(pwaApi.api_key || "").trim();
  const hsm_jwt_secret = String(hsmJwt.jwt_secret || "").trim();
  const hsm_api_key = String(hsmApi.api_key || "").trim();

  if (!jwt_secret || !api_key || !hsm_jwt_secret || !hsm_api_key) {
    throw new Error("Vault secrets missing: jwt_secret/api_key in one or more required paths");
  }

  return {
    jwt_secret,
    api_key,
    hsm_jwt_secret,
    hsm_api_key,
    paths
  };
}
`);

const guidance = `
PATCH REQUIRED (manual but fast; no stubs):
1) Import and call loadMyIdSecrets() at server startup for:
   - /perform1/srv/work/www/html/myid/pwa-app/server/index.js
   - /perform1/srv/work/myid-app/backend/server.mjs (myid-hsm)
2) Replace any use of process.env.JWT_SECRET / process.env.API_KEY with the loaded values in memory.
3) Remove JWT_SECRET/API_KEY from any ecosystem.config.* and from git-tracked files.
4) Keep only VAULT_ADDR, VAULT_TOKEN, VAULT_KV_MOUNT, and VAULT_PATH_* in PM2 env.

Created module:
  ${modPath}

Next: Run Agent02 again to ensure no hardcoded secrets remain.
`;

writeText("vault-runtime-patch-guidance.txt", guidance);

// Optional: show candidate files containing JWT_SECRET/API_KEY right now (so you can edit quickly)
await execCmd("bash", ["-lc", "grep -RIn --exclude-dir=node_modules --exclude-dir=.git -E 'JWT_SECRET\\s*[:=]|API_KEY\\s*[:=]' /perform1/srv/work/myid-app /perform1/srv/work/www/html/myid/pwa-app 2>/dev/null || true"]);

ok("Vault loader module created and patch guidance written. Apply edits, then rerun orchestrator.");
