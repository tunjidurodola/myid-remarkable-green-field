import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = "/perform1/srv/work/myid-app";
const REPORT_DIR = path.join(ROOT, "reports");
const EVID_DIR = path.join(REPORT_DIR, "evidence");

export function nowIso() {
  return new Date().toISOString();
}

export function ensureDirs() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(EVID_DIR, { recursive: true });
}

export function writeEvidence(name, obj) {
  ensureDirs();
  const p = path.join(EVID_DIR, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

export function writeText(name, text) {
  ensureDirs();
  const p = path.join(EVID_DIR, name);
  fs.writeFileSync(p, text);
  return p;
}

export async function runAgent(agentPath) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [agentPath], { stdio: "inherit" });
    child.on("exit", (code) => resolve(code === 0));
  });
}

export function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}

export function ok(msg) {
  console.log(`[OK] ${msg}`);
}
