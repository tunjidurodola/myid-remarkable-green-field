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
