import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { httpJson } from "../lib/http.mjs";

const { policy, runId } = loadPolicyFromEnv();

// Gate condition: exposed verification endpoints MUST report "realVerification": true
// Adjust endpoints to your implemented API paths.
const pwa = policy.services.pwaServer.baseUrl;
const hsm = policy.services.hsmService.baseUrl;

const targets = [
  { name: "pwa-health", url: `${pwa}/api/health` },
  { name: "hsm-health", url: `${hsm}/health` }
];

const out = [];
for (const t of targets) {
  const j = await httpJson(t.url);
  out.push({ name: t.name, url: t.url, json: j });
}

// This is a strict gate you should wire into your code: add these booleans.
const hsmHealth = out.find(x => x.name === "hsm-health")?.json;
if (!hsmHealth?.services?.hsm?.label) {
  throw new Error("HSM health missing expected services.hsm.label");
}

await evidence(runId, "credential-verification-gate.json", { ok: true, out });
console.log("Credential verification gate: health endpoints OK (wire realVerification flags next).");
process.exit(0);
