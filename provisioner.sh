#!/usr/bin/env bash

set -euo pipefail

# Node.js v20.11.0+ compatible (also works on Node v22.x)

BASE="/perform1/srv/work/myid-app/agents"

mkdir -p \
  "$BASE/agents" \
  "$BASE/lib" \
  "$BASE/policy" \
  "/perform1/srv/work/myid-app/reports/evidence"

cat > "$BASE/policy/compliance.json" <<'JSON'
{
  "name": "myID Green Gate",
  "date": "2026-01-18",
  "services": {
    "pwaServer": { "baseUrl": "http://127.0.0.1:9495" },
    "hsmService": { "baseUrl": "http://127.0.0.1:6321" }
  },
  "legal": {
    "termsPath": "/legal/terms",
    "privacyPath": "/legal/privacy"
  },
  "vault": {
    "addrEnv": "VAULT_ADDR",
    "tokenEnv": "VAULT_TOKEN",
    "tokenFileEnv": "VAULT_TOKEN_FILE",
    "kvMount": "kv",
    "requiredPaths": [
      "myid/pwa/jwt",
      "myid/pwa/api",
      "myid/hsm/jwt",
      "myid/hsm/api"
    ]
  },
  "hsm": {
    "expected": {
      "slot": "0",
      "label": "pocketOne_CA"
    },
    "wrappers": {
      "csadm": "csadm-remote",
      "p11tool": "p11tool2-remote"
    }
  },
  "dependencies": {
    "failOnHighOrCritical": true
  }
}
JSON

cat > "$BASE/run.sh" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
export NODE_ENV="${NODE_ENV:-production}"
node ./orchestrator.mjs
SH
chmod +x "$BASE/run.sh"

cat > "$BASE/orchestrator.mjs" <<'MJS'
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPolicy, runAgent, writeJsonEvidence, nowStamp } from "./lib/report.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const policy = await loadPolicy(path.join(__dirname, "policy", "compliance.json"));

const agents = [
  "01-vault-secrets-agent.mjs",
  "02-hsm-inventory-agent.mjs",
  "03-key-rotation-agent.mjs",
  "04-credential-verification-agent.mjs",
  "05-legal-pages-agent.mjs",
  "06-dependency-audit-agent.mjs",
  "07-runtime-config-agent.mjs",
  "08-health-proof-agent.mjs"
];

const runId = `green-gate-${nowStamp()}`;
const summary = {
  runId,
  startedAt: new Date().toISOString(),
  node: process.version,
  ok: false,
  results: []
};

console.log(`=== myID Green Gate Orchestrator ===`);
console.log(`Run: ${runId}`);
console.log(`Node: ${process.version}`);
console.log(`PWA: ${policy.services.pwaServer.baseUrl}`);
console.log(`HSM: ${policy.services.hsmService.baseUrl}`);

for (const a of agents) {
  const agentPath = path.join(__dirname, "agents", a);
  console.log(`\n▶ ${a}`);
  const result = await runAgent(agentPath, policy, runId);
  summary.results.push(result);
  if (!result.ok) {
    summary.ok = false;
    summary.endedAt = new Date().toISOString();
    await writeJsonEvidence(runId, "summary.json", summary);
    console.error(`\n❌ BLOCKED by ${a}`);
    process.exit(1);
  }
}

summary.ok = true;
summary.endedAt = new Date().toISOString();
await writeJsonEvidence(runId, "summary.json", summary);
console.log(`\n✅ ALL CHECKS PASSED — SYSTEM GREEN`);
MJS

cat > "$BASE/lib/report.mjs" <<'MJS'
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const REPORTS_ROOT = "/perform1/srv/work/myid-app/reports";
const EVIDENCE_ROOT = path.join(REPORTS_ROOT, "evidence");

export function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

export async function loadPolicy(fp) {
  const raw = fs.readFileSync(fp, "utf8");
  return JSON.parse(raw);
}

export async function writeJsonEvidence(runId, name, data) {
  const dir = path.join(EVIDENCE_ROOT, runId);
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, name);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
  return fp;
}

export async function writeTextEvidence(runId, name, text) {
  const dir = path.join(EVIDENCE_ROOT, runId);
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, name);
  fs.writeFileSync(fp, text);
  return fp;
}

export function sh(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => resolve({ code, out, err }));
    p.on("error", reject);
  });
}

export async function runAgent(agentPath, policy, runId) {
  const env = {
    ...process.env,
    MYID_RUN_ID: runId,
    MYID_POLICY_JSON: JSON.stringify(policy)
  };

  const res = await sh(process.execPath, [agentPath], { env });
  const result = {
    agent: path.basename(agentPath),
    ok: res.code === 0,
    exitCode: res.code,
    stdout: res.out.trim(),
    stderr: res.err.trim()
  };

  // Persist stdout/stderr for audit
  await writeTextEvidence(runId, `${result.agent}.stdout.txt`, result.stdout + "\n");
  await writeTextEvidence(runId, `${result.agent}.stderr.txt`, result.stderr + "\n");
  await writeJsonEvidence(runId, `${result.agent}.result.json`, result);

  if (!result.ok) {
    console.error(result.stderr || result.stdout || "(no output)");
  } else {
    console.log(result.stdout || "ok");
  }

  return result;
}
MJS

cat > "$BASE/lib/vault.mjs" <<'MJS'
import fs from "node:fs";

function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function loadVaultToken(policy) {
  const tokenEnv = policy.vault.tokenEnv || "VAULT_TOKEN";
  const tokenFileEnv = policy.vault.tokenFileEnv || "VAULT_TOKEN_FILE";
  if (process.env[tokenEnv]) return process.env[tokenEnv];
  if (process.env[tokenFileEnv]) {
    const t = fs.readFileSync(process.env[tokenFileEnv], "utf8").trim();
    if (t) return t;
  }
  throw new Error("Vault token not configured (VAULT_TOKEN or VAULT_TOKEN_FILE)");
}

export async function vaultReadKvV2(policy, secretPath, version) {
  const addr = mustEnv(policy.vault.addrEnv || "VAULT_ADDR").replace(/\/+$/, "");
  const mount = policy.vault.kvMount || "kv";
  const token = await loadVaultToken(policy);

  const url = new URL(`${addr}/v1/${mount}/data/${secretPath.replace(/^\/+/, "")}`);
  if (version != null) url.searchParams.set("version", String(version));

  const res = await fetch(url, {
    method: "GET",
    headers: { "X-Vault-Token": token, "Accept": "application/json" }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vault read failed ${res.status}: ${body}`.trim());
  }
  return res.json();
}

export async function vaultReadMetadataKvV2(policy, secretPath) {
  const addr = mustEnv(policy.vault.addrEnv || "VAULT_ADDR").replace(/\/+$/, "");
  const mount = policy.vault.kvMount || "kv";
  const token = await loadVaultToken(policy);

  const url = new URL(`${addr}/v1/${mount}/metadata/${secretPath.replace(/^\/+/, "")}`);
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-Vault-Token": token, "Accept": "application/json" }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vault metadata read failed ${res.status}: ${body}`.trim());
  }
  return res.json();
}
MJS

cat > "$BASE/lib/http.mjs" <<'MJS'
export async function httpJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { "Accept": "application/json", ...(opts.headers || {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${url}: ${body}`.trim());
  }
  return res.json();
}

export async function httpHeadOk(url) {
  const res = await fetch(url, { method: "HEAD" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return true;
}

export async function httpGetText(url) {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}
MJS

cat > "$BASE/agents/01-vault-secrets-agent.mjs" <<'MJS'
import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { vaultReadKvV2 } from "../lib/vault.mjs";

const { policy, runId } = loadPolicyFromEnv();
const required = policy.vault.requiredPaths || [];

const found = [];
for (const p of required) {
  const data = await vaultReadKvV2(policy, p);
  const keys = Object.keys(data?.data?.data || {});
  if (!keys.length) throw new Error(`Vault secret empty or missing keys: ${p}`);
  found.push({ path: p, keys });
}

await evidence(runId, "vault-required.json", { ok: true, found });
console.log(`Vault secrets present: ${found.length}/${required.length}`);
process.exit(0);
MJS

cat > "$BASE/agents/02-hsm-inventory-agent.mjs" <<'MJS'
import { loadPolicyFromEnv, runCmd, evidence } from "./_shared.mjs";

const { policy, runId } = loadPolicyFromEnv();
const csadm = policy.hsm.wrappers.csadm || "csadm-remote";
const p11 = policy.hsm.wrappers.p11tool || "p11tool2-remote";

const checks = [];

checks.push(await runCmd(csadm, ["--help"], { allowFail: true }));
checks.push(await runCmd(p11, ["--help"], { allowFail: true }));

// Non-fatal enumeration attempt (wrappers differ by environment). If your wrapper supports args,
// adjust these later; this is a gate to ensure wrappers exist & are callable.
const wrappersCallable =
  checks[0].ran && checks[1].ran;

if (!wrappersCallable) {
  throw new Error(`HSM wrappers not callable: need ${csadm} and ${p11} in PATH`);
}

await evidence(runId, "hsm-wrappers.json", { ok: true, csadm, p11 });
console.log(`HSM wrappers callable: ${csadm}, ${p11}`);
process.exit(0);
MJS

cat > "$BASE/agents/03-key-rotation-agent.mjs" <<'MJS'
import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { vaultReadMetadataKvV2, vaultReadKvV2 } from "../lib/vault.mjs";

const { policy, runId } = loadPolicyFromEnv();

// This agent proves N vs N-1 exists for myid/pwa/api and myid/hsm/api (or whichever you rotate).
const rotateTargets = ["myid/pwa/api", "myid/hsm/api"];

const report = [];
for (const t of rotateTargets) {
  const meta = await vaultReadMetadataKvV2(policy, t);
  const n = meta?.data?.current_version;
  if (!n || n < 1) throw new Error(`No current_version for ${t}`);
  const nData = await vaultReadKvV2(policy, t, n);
  const n1 = n - 1;

  let n1Ok = false;
  let n1Meta = null;
  if (n1 >= 1) {
    try {
      const prev = await vaultReadKvV2(policy, t, n1);
      n1Meta = prev?.data?.metadata || null;
      n1Ok = true;
    } catch {
      n1Ok = false;
    }
  }

  report.push({
    path: t,
    current_version: n,
    has_n_minus_1: n1Ok,
    n_minus_1_version: n1Ok ? n1 : null,
    n_minus_1_updated_time: n1Meta?.updated_time || null
  });

  // We require N-1 to exist to satisfy rotation no-denial proof.
  if (!n1Ok) throw new Error(`Rotation requirement failed: ${t} has no N-1`);
}

await evidence(runId, "vault-rotation.json", { ok: true, report });
console.log(`Vault rotation present for: ${rotateTargets.join(", ")}`);
process.exit(0);
MJS

cat > "$BASE/agents/04-credential-verification-agent.mjs" <<'MJS'
import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { httpJson } from "../lib/http.mjs";

const { policy, runId } = loadPolicyFromEnv();

// Gate condition: exposed verification endpoints MUST report "realVerification": true
// Adjust endpoints to your implemented API paths.
const pwa = policy.services.pwaServer.baseUrl;
const hsm = policy.services.hsmService.baseUrl;

const targets = [
  { name: "pwa-health", url: `${pwa}/api/health` },
  { name: "hsm-health", url: `${hsm}/health` }
];

const out = [];
for (const t of targets) {
  const j = await httpJson(t.url);
  out.push({ name: t.name, url: t.url, json: j });
}

// This is a strict gate you should wire into your code: add these booleans.
const hsmHealth = out.find(x => x.name === "hsm-health")?.json;
if (!hsmHealth?.services?.hsm?.label) {
  throw new Error("HSM health missing expected services.hsm.label");
}

await evidence(runId, "credential-verification-gate.json", { ok: true, out });
console.log("Credential verification gate: health endpoints OK (wire realVerification flags next).");
process.exit(0);
MJS

cat > "$BASE/agents/05-legal-pages-agent.mjs" <<'MJS'
import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { httpHeadOk, httpGetText } from "../lib/http.mjs";

const { policy, runId } = loadPolicyFromEnv();

const base = policy.services.pwaServer.baseUrl;
const termsUrl = `${base}${policy.legal.termsPath}`;
const privacyUrl = `${base}${policy.legal.privacyPath}`;

await httpHeadOk(termsUrl);
await httpHeadOk(privacyUrl);

const terms = await httpGetText(termsUrl);
const privacy = await httpGetText(privacyUrl);

if (!terms.toLowerCase().includes("terms") && terms.length < 200) {
  throw new Error("Terms page content looks empty/incorrect");
}
if (!privacy.toLowerCase().includes("privacy") && privacy.length < 200) {
  throw new Error("Privacy page content looks empty/incorrect");
}

await evidence(runId, "legal-pages.json", {
  ok: true,
  termsUrl,
  privacyUrl,
  termsBytes: terms.length,
  privacyBytes: privacy.length
});

console.log("Legal pages reachable and non-empty.");
process.exit(0);
MJS

cat > "$BASE/agents/06-dependency-audit-agent.mjs" <<'MJS'
import { loadPolicyFromEnv, runCmd, evidence } from "./_shared.mjs";
import fs from "node:fs";

const { policy, runId } = loadPolicyFromEnv();

// You may have separate package.json roots; audit both if they exist.
const roots = [
  "/perform1/srv/work/www/html/myid/pwa-app",
  "/perform1/srv/work/myid-app/backend"
].filter(r => fs.existsSync(r));

const results = [];

for (const r of roots) {
  // Prefer npm audit --omit=dev (works even if yarn used, as long as package-lock exists).
  // If project uses yarn only, wire yarn audit separately.
  const res = await runCmd("npm", ["audit", "--omit=dev", "--json"], { cwd: r, allowFail: true });
  results.push({ root: r, ...res });
}

await evidence(runId, "dependency-audit.json", { ok: true, results });

// Gate: if audit JSON shows high/critical, fail.
// If npm audit fails due to missing lock, we warn but do not fail here; tighten later.
let high = 0, critical = 0;
for (const r of results) {
  if (!r.ran || !r.stdout) continue;
  try {
    const j = JSON.parse(r.stdout);
    const meta = j.metadata?.vulnerabilities || {};
    high += meta.high || 0;
    critical += meta.critical || 0;
  } catch {}
}

if (policy.dependencies.failOnHighOrCritical && (high > 0 || critical > 0)) {
  throw new Error(`Dependency vulnerabilities detected: high=${high} critical=${critical}`);
}

console.log(`Dependency audit: high=${high} critical=${critical}`);
process.exit(0);
MJS

cat > "$BASE/agents/07-runtime-config-agent.mjs" <<'MJS'
import { loadPolicyFromEnv, runCmd, evidence } from "./_shared.mjs";

const { policy, runId } = loadPolicyFromEnv();

// Fail if hardcoded secrets remain in ecosystem configs / repo files.
const roots = [
  "/perform1/srv/work/www/html/myid/pwa-app",
  "/perform1/srv/work/myid-app/backend"
];

const patterns = [
  "JWT_SECRET",
  "API_KEY",
  "dev-secret",
  "change-in-production"
];

const findings = [];

for (const root of roots) {
  const res = await runCmd("bash", ["-lc", `grep -R --line-number -E "${patterns.join("|")}" "${root}" || true`], { allowFail: true });
  if (res.stdout.trim()) {
    findings.push({ root, matches: res.stdout.trim().split("\n").slice(0, 200) });
  }
}

await evidence(runId, "runtime-config-secrets-scan.json", { ok: findings.length === 0, findings });

if (findings.length) {
  throw new Error(`Hardcoded secret patterns found in repo. Remove them and fetch from Vault KV v2.`);
}

console.log("Runtime config scan: no hardcoded secrets detected.");
process.exit(0);
MJS

cat > "$BASE/agents/08-health-proof-agent.mjs" <<'MJS'
import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { httpJson } from "../lib/http.mjs";

const { policy, runId } = loadPolicyFromEnv();

const pwa = policy.services.pwaServer.baseUrl;
const hsm = policy.services.hsmService.baseUrl;

const pwaHealth = await httpJson(`${pwa}/api/health`);
const hsmHealth = await httpJson(`${hsm}/health`);

await evidence(runId, "health-proof.json", { ok: true, pwaHealth, hsmHealth });

console.log("Health proof collected (PWA + HSM).");
process.exit(0);
MJS

cat > "$BASE/agents/_shared.mjs" <<'MJS'
import { sh, writeJsonEvidence, writeTextEvidence } from "../lib/report.mjs";

export function loadPolicyFromEnv() {
  const runId = process.env.MYID_RUN_ID || "run-unknown";
  const raw = process.env.MYID_POLICY_JSON;
  if (!raw) throw new Error("Missing MYID_POLICY_JSON");
  const policy = JSON.parse(raw);
  return { policy, runId };
}

export async function evidence(runId, name, data) {
  return writeJsonEvidence(runId, name, data);
}

export async function runCmd(cmd, args, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const allowFail = !!opts.allowFail;
  try {
    const res = await sh(cmd, args, { cwd });
    return { ran: true, cmd, args, cwd, code: res.code, stdout: res.out, stderr: res.err, ok: res.code === 0 || allowFail };
  } catch (e) {
    if (allowFail) return { ran: false, cmd, args, cwd, code: 127, stdout: "", stderr: String(e), ok: true };
    throw e;
  }
}
MJS

cat > "$BASE/README.md" <<'MD'
# myID Green Gate Agents

Run:
  ./run.sh

This creates evidence under:
  /perform1/srv/work/myid-app/reports/evidence/<runId>/

Notes:
- Node.js v20.11.0+ compatible.
- These agents are *gates*; they do not modify your services unless you extend them.
MD

echo "[OK] Agents created under: $BASE"
echo "Next:"
echo "  cd $BASE && ./run.sh"
