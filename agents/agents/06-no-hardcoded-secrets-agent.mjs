import fs from "node:fs";
import { execCmd } from "../lib/exec.mjs";
import { fail, ok, writeText } from "../lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/agents/policy/compliance.json", "utf-8"));
const re = policy.security.disallow_hardcoded_secrets_regex;

// Scan only relevant config/code directories to avoid noise
const cmd = `grep -RIn --exclude-dir=node_modules --exclude-dir=.git -E '${re}' /perform1/srv/work/myid-app /perform1/srv/work/www/html/myid/pwa-app 2>/dev/null || true`;
const r = await execCmd("bash", ["-lc", cmd]);

writeText("hardcoded-secrets-scan.txt", r.out);

if (r.out.trim().length > 0) {
  fail(`Hardcoded secret patterns detected. See reports/evidence/hardcoded-secrets-scan.txt`);
}

ok("No hardcoded JWT_SECRET/API_KEY patterns detected in scanned paths");
