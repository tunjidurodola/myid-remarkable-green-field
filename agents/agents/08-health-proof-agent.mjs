import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { httpJson } from "../lib/http.mjs";

const { policy, runId } = loadPolicyFromEnv();

const pwa = policy.services.pwaServer.baseUrl;
const hsm = policy.services.hsmService.baseUrl;

const pwaHealth = await httpJson(`${pwa}/api/health`);
const hsmHealth = await httpJson(`${hsm}/health`);

await evidence(runId, "health-proof.json", { ok: true, pwaHealth, hsmHealth });

console.log("Health proof collected (PWA + HSM).");
process.exit(0);
