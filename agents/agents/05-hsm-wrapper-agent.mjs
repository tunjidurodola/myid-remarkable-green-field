import fs from "node:fs";
import { execCmd } from "../lib/exec.mjs";
import { fail, ok, writeEvidence } from "../lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/agents/policy/compliance.json", "utf-8"));
const wrappers = policy.hsm.wrappers_required;

const results = {};
for (const w of wrappers) {
  const r = await execCmd("bash", ["-lc", `command -v ${w} || true`]);
  results[w] = r.out.trim();
  if (!results[w]) fail(`Missing required HSM wrapper in PATH: ${w}`);
}

writeEvidence("hsm-wrappers.json", results);

/*
  Note: Deep slot inventory is environment-specific. This agent only ensures:
  - wrappers exist (csadm-remote, p11tool2-remote)
  Next phase agent (you asked for it) will:
  - enumerate slots
  - verify Root CA in slot 0 label pocketOne_CA
  - verify KEK presence and attributes
*/
ok(`HSM wrappers present: ${wrappers.join(", ")}`);
