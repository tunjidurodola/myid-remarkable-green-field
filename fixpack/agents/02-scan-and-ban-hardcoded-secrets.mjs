import fs from "node:fs";
import { execCmd } from "../lib/exec.mjs";
import { fail, ok, writeText } from "../lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/fixpack/policy/fixpack.json","utf-8"));
const targets = policy.targets;
const patterns = policy.ban_patterns;

const grepExpr = patterns.map(p => `-e '${p}'`).join(" ");
const cmd = `grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=reports --exclude-dir=.artifacts --exclude-dir=docs --exclude-dir=fixpack --exclude-dir=scripts --exclude='*.bak' --exclude='*.bak.*' --exclude='*.example' --exclude='README.md' ${grepExpr} ${targets.map(t=>`'${t}'`).join(" ")} 2>/dev/null || true`;

const r = await execCmd("bash", ["-lc", cmd]);
writeText("hardcoded-secret-findings.txt", r.out);

if (r.out.trim()) {
  fail("Hardcoded secrets detected. Must remove/replace with Vault runtime load. See hardcoded-secret-findings.txt");
}

ok("No hardcoded secrets detected (post-fix expectation). If this is your first run, Agent03 will patch then rerun.");
