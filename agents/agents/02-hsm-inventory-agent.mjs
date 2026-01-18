import { loadPolicyFromEnv, runCmd, evidence } from "./_shared.mjs";

const { policy, runId } = loadPolicyFromEnv();
const csadm = policy.hsm.wrappers.csadm || "csadm-remote";
const p11 = policy.hsm.wrappers.p11tool || "p11tool2-remote";

const checks = [];

checks.push(await runCmd(csadm, ["--help"], { allowFail: true }));
checks.push(await runCmd(p11, ["--help"], { allowFail: true }));

// Non-fatal enumeration attempt (wrappers differ by environment). If your wrapper supports args,
// adjust these later; this is a gate to ensure wrappers exist & are callable.
const wrappersCallable =
  checks[0].ran && checks[1].ran;

if (!wrappersCallable) {
  throw new Error(`HSM wrappers not callable: need ${csadm} and ${p11} in PATH`);
}

await evidence(runId, "hsm-wrappers.json", { ok: true, csadm, p11 });
console.log(`HSM wrappers callable: ${csadm}, ${p11}`);
process.exit(0);
