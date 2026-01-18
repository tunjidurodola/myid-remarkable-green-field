import fs from "node:fs";
import path from "node:path";
import { execCmd } from "./lib/exec.mjs";
import { fail, ok, writeJson } from "./lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/fixpack/policy/fixpack.json", "utf-8"));

const AGENTS = [
  "01-vault-secrets-required.mjs",
  "02-scan-and-ban-hardcoded-secrets.mjs",
  "03-patch-runtime-to-load-secrets-from-vault.mjs",
  "04-fix-dependency-vulns.mjs",
//  "05-remove-fake-compliance-claims.mjs",
  "06-crypto-stub-detector-and-gate.mjs"
];

const results = [];

for (const a of AGENTS) {
  console.log(`\n▶ ${a}`);
  const r = await execCmd(process.execPath, [path.join("/perform1/srv/work/myid-app/fixpack/agents", a)]);
  results.push({ agent: a, code: r.code, stderr: r.err.slice(0,800) });
  if (r.code !== 0) {
    writeJson("fixpack-orchestrator-results.json", { results });
    fail(`Blocked by ${a}. See reports/fixpack for details.`);
  }
}

writeJson("fixpack-orchestrator-results.json", { results });
ok("FixPack gate is GREEN. Next step: implement real verification path(s) using c3 HSM.");
