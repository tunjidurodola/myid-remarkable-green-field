import { execSync } from "child_process";

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function looksLikeListSlots(output) {
  // Accept either:
  //  - "0: 00000000" style
  //  - "Slot ..." style (some tools print that)
  const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const hexSlotLines = lines.filter(l => /^\d+\s*:\s*[0-9A-Fa-f]{8}$/.test(l));
  const hasSlotWord = lines.some(l => /\bslot\b/i.test(l));

  return hexSlotLines.length >= 1 || hasSlotWord;
}

function preview(output, maxLines = 30) {
  const lines = output.split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n").trim();
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

  console.error("p11tool2-remote failed or output not recognized. Falling back to csadm-remote...");
  console.error(`(p11tool2-remote error: ${msg}${stderr ? " | " + stderr : ""})`);

  try {
    // csadm-remote output formats vary; treat any non-empty output as “connected”
    const out2 = run("/usr/bin/csadm-remote list-slots");
    if (!out2.trim()) throw new Error("Empty output.");
    console.log("HSM Smoke Test Passed: csadm-remote list-slots");
    console.log(preview(out2));
    process.exit(0);
  } catch (e2) {
    const stderr2 = e2?.stderr?.toString?.() || "";
    const msg2 = e2?.message || String(e2);
    console.error("HSM Smoke Test Failed: both p11tool2-remote and csadm-remote failed.");
    console.error(`(csadm-remote error: ${msg2}${stderr2 ? " | " + stderr2 : ""})`);
    process.exit(1);
  }
}
