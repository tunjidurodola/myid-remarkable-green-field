import { execCmd } from "../lib/exec.mjs";
import { fail, ok, writeText } from "../lib/report.mjs";

// Run from backend root if package.json exists; else skip
const backend = "/perform1/srv/work/myid-app/backend";
const pkg = await execCmd("bash", ["-lc", `test -f ${backend}/package.json && echo yes || echo no`]);
if (pkg.out.trim() !== "yes") {
  ok("No backend/package.json detected; skipping npm audit");
  process.exit(0);
}

const audit = await execCmd("bash", ["-lc", `cd ${backend} && npm audit --omit=dev --json || true`]);
writeText("npm-audit.json", audit.out || audit.err);

let j;
try { j = JSON.parse(audit.out); } catch {
  // npm may output non-json on older configs; treat as failure
  fail("npm audit did not return JSON. Review reports/evidence/npm-audit.json");
}

// Enforce: no high/critical vulnerabilities
const meta = j?.metadata?.vulnerabilities;
if (!meta) fail("npm audit JSON missing metadata.vulnerabilities");

const high = meta.high ?? 0;
const critical = meta.critical ?? 0;

if (critical > 0 || high > 0) {
  fail(`npm audit has vulnerabilities (high=${high}, critical=${critical}). Fix required.`);
}

ok("npm audit clean (no high/critical vulnerabilities)");
