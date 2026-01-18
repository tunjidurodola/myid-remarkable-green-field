import fs from "node:fs";
import path from "node:path";
import { runAgent, fail, ok, writeEvidence, nowIso } from "./lib/report.mjs";

const POLICY_PATH = path.join("/perform1/srv/work/myid-app/agents/policy/compliance.json");
const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf-8"));

const AGENTS = [
  "01-pm2-presence-agent.mjs",
  "02-legal-pages-agent.mjs",
  "03-health-agent.mjs",
  "04-vault-secrets-agent.mjs",
  "05-hsm-wrapper-agent.mjs",
  "06-no-hardcoded-secrets-agent.mjs",
  "07-dependency-audit-agent.mjs",
  "08-summary-agent.mjs"
];

const results = [];

for (const a of AGENTS) {
  console.log(`\n▶ Running ${a}`);
  const okRun = await runAgent(path.join("/perform1/srv/work/myid-app/agents/agents", a));
  results.push({ agent: a, ok: okRun });
  if (!okRun) {
    writeEvidence(`orchestrator-results-${nowIso().replace(/[:.]/g, "-")}.json`, { policy, results });
    fail(`BLOCKED by ${a}`);
  }
}

writeEvidence(`orchestrator-results-${nowIso().replace(/[:.]/g, "-")}.json`, { policy, results });
ok("ALL CHECKS PASSED — SYSTEM GREEN");
