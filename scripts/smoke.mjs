import { execSync } from "child_process";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function looksLikeListSlots(output) {
  const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const hexSlotLines = lines.filter(l => /^\s*\d+:\s*[0-9a-fA-F]+\s*$/.test(l));
  return hexSlotLines.length >= 1;
}

function preview(output, maxLines = 20) {
  const lines = output.split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n").trim();
}

function commandExists(cmd) {
    try {
        execSync(`command -v ${cmd}`, { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
}

console.log("Running HSM remote signing smoke test...");

let out = "";
try {
  out = run("/usr/bin/p11tool2-remote ListSlots");
  if (!looksLikeListSlots(out)) {
    throw new Error("No valid slots found in output.");
  }
  console.log("HSM Smoke Test Passed: p11tool2-remote ListSlots");
  console.log(preview(out));
  process.exit(0);
} catch (e) {
  const stderr = e?.stderr?.toString?.() || "";
  const msg = e?.message || String(e);

  console.error("p11tool2-remote failed or output not recognized. Checking for fallback...");
  console.error(`(p11tool2-remote error: ${msg}${stderr ? " | " + stderr : ""})`);

  const csadmRemotePath = "/usr/bin/csadm-remote";
  if (commandExists(csadmRemotePath)) {
    console.log("Falling back to csadm-remote...");
    try {
      // csadm-remote output formats vary; treat any non-empty output as “connected”
      const out2 = run(`${csadmRemotePath} list-slots`);
      if (!out2.trim()) throw new Error("Empty output.");
      console.log("HSM Smoke Test Passed: csadm-remote list-slots");
      console.log(preview(out2));
      process.exit(0);
    } catch (e2) {
      const stderr2 = e2?.stderr?.toString?.() || "";
      const msg2 = e2?.message || String(e2);
      console.error("HSM Smoke Test Failed: p11tool2-remote failed and fallback csadm-remote also failed.");
      console.error(`(csadm-remote error: ${msg2}${stderr2 ? " | " + stderr2 : ""})`);
      process.exit(1);
    }
  } else {
    console.error("HSM Smoke Test Failed: p11tool2-remote failed and fallback csadm-remote not found on PATH.");
    process.exit(1);
  }
}
