import fs from "node:fs";
import { httpGet } from "../lib/http.mjs";
import { fail, ok, writeEvidence } from "../lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/agents/policy/compliance.json", "utf-8"));
const pwa = policy.services.pwa_server.base_url + policy.health.pwa_health;
const hsm = policy.services.myid_hsm.base_url + policy.health.hsm_health;

const a = await httpGet(pwa);
const b = await httpGet(hsm);

writeEvidence("health.json", { pwa, hsm, pwaRes: { status: a.status, body: a.text.slice(0, 2000) }, hsmRes: { status: b.status, body: b.text.slice(0, 2000) } });

if (!a.ok) fail(`PWA health not OK: ${pwa} (HTTP ${a.status})`);
if (!b.ok) fail(`HSM health not OK: ${hsm} (HTTP ${b.status})`);

ok("Health endpoints OK");
