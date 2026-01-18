import { execCmd } from "../lib/exec.mjs";
import { fail, ok, writeText } from "../lib/report.mjs";

// Detect trivial "!!signature" or placeholder verifications
// Exclude documentation and reports - only scan actual code
const cmd = "grep -RIn --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=docs --exclude-dir=reports -E '(return\\s+!!signature|TODO\\s*:\\s*verify|mock\\s+verify|stub\\s+verify|no\\s+verification|fake\\s+verify)' /perform1/srv/work/myid-app 2>/dev/null || true";
const r = await execCmd("bash", ["-lc", cmd]);
writeText("crypto-stub-findings.txt", r.out);

if (r.out.trim()) {
  fail("Crypto verification stubs detected. Replace with real verification path (at least one) using HSM/c3 and proper libraries.");
}

ok("No obvious crypto verification stubs detected by heuristic scan.");
