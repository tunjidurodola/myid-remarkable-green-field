import { sh, writeJsonEvidence, writeTextEvidence } from "../lib/report.mjs";

export function loadPolicyFromEnv() {
  const runId = process.env.MYID_RUN_ID || "run-unknown";
  const raw = process.env.MYID_POLICY_JSON;
  if (!raw) throw new Error("Missing MYID_POLICY_JSON");
  const policy = JSON.parse(raw);
  return { policy, runId };
}

export async function evidence(runId, name, data) {
  return writeJsonEvidence(runId, name, data);
}

export async function runCmd(cmd, args, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const allowFail = !!opts.allowFail;
  try {
    const res = await sh(cmd, args, { cwd });
    return { ran: true, cmd, args, cwd, code: res.code, stdout: res.out, stderr: res.err, ok: res.code === 0 || allowFail };
  } catch (e) {
    if (allowFail) return { ran: false, cmd, args, cwd, code: 127, stdout: "", stderr: String(e), ok: true };
    throw e;
  }
}
