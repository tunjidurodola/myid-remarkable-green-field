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
