import fs from "node:fs";
import path from "node:path";

const OUT = "/perform1/srv/work/myid-app/reports/fixpack";
fs.mkdirSync(OUT, { recursive: true });

export function writeJson(name, obj) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}
export function writeText(name, text) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, text);
  return p;
}
export function fail(msg) {
  console.error(`[FAIL] ${msg}`);
  process.exit(1);
}
export function ok(msg) {
  console.log(`[OK] ${msg}`);
}
