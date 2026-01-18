import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { vaultReadKvV2 } from "../lib/vault.mjs";

const { policy, runId } = loadPolicyFromEnv();
const required = policy.vault.requiredPaths || [];

const found = [];
for (const p of required) {
  const data = await vaultReadKvV2(policy, p);
  const keys = Object.keys(data?.data?.data || {});
  if (!keys.length) throw new Error(`Vault secret empty or missing keys: ${p}`);
  found.push({ path: p, keys });
}

await evidence(runId, "vault-required.json", { ok: true, found });
console.log(`Vault secrets present: ${found.length}/${required.length}`);
process.exit(0);
