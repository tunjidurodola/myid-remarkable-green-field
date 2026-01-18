import fs from "node:fs";
import { execCmd } from "../lib/exec.mjs";
import { fail, ok, writeText } from "../lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/fixpack/policy/fixpack.json","utf-8"));
const backend = policy.backend.path;

const hasPkg = await execCmd("bash", ["-lc", `test -f '${backend}/package.json' && echo yes || echo no`]);
if (hasPkg.out.trim() !== "yes") {
  ok("backend/package.json not found; skipping dependency fixes");
  process.exit(0);
}

// Provide deterministic instructions rather than auto-upgrading blindly
const audit = await execCmd("bash", ["-lc", `cd '${backend}' && npm audit --omit=dev || true`]);
writeText("npm-audit-human.txt", audit.out + "\n" + audit.err);

if ((audit.out + audit.err).match(/HIGH|CRITICAL/i)) {
  fail("High/Critical vulnerabilities present. Update dependencies (e.g. glob via eslint-config-next upgrade) then rerun.");
}

ok("No high/critical vulnerabilities detected (or audit clean).");
