import fs from "node:fs";
import { execCmd } from "../lib/exec.mjs";
import { fail, ok, writeEvidence } from "../lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/agents/policy/compliance.json", "utf-8"));
const required = policy.pm2.required_processes;

const r = await execCmd("pm2", ["jlist"]);
if (r.code !== 0) fail(`pm2 jlist failed: ${r.err.slice(0,200)}`);

let list;
try { list = JSON.parse(r.out); } catch { fail("pm2 jlist returned invalid JSON"); }

const names = new Set(list.map(p => p?.name).filter(Boolean));
const missing = required.filter(n => !names.has(n) && ![...names].some(x => x.startsWith(n)));

writeEvidence("pm2-jlist.json", list);

if (missing.length) fail(`Missing PM2 processes: ${missing.join(", ")}`);
ok(`PM2 processes present: ${required.join(", ")}`);
