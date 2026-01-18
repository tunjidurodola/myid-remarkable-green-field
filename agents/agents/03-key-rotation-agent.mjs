import { loadPolicyFromEnv, evidence } from "./_shared.mjs";
import { vaultReadMetadataKvV2, vaultReadKvV2 } from "../lib/vault.mjs";

const { policy, runId } = loadPolicyFromEnv();

// This agent proves N vs N-1 exists for myid/pwa/api and myid/hsm/api (or whichever you rotate).
const rotateTargets = ["myid/pwa/api", "myid/hsm/api"];

const report = [];
for (const t of rotateTargets) {
  const meta = await vaultReadMetadataKvV2(policy, t);
  const n = meta?.data?.current_version;
  if (!n || n < 1) throw new Error(`No current_version for ${t}`);
  const nData = await vaultReadKvV2(policy, t, n);
  const n1 = n - 1;

  let n1Ok = false;
  let n1Meta = null;
  if (n1 >= 1) {
    try {
      const prev = await vaultReadKvV2(policy, t, n1);
      n1Meta = prev?.data?.metadata || null;
      n1Ok = true;
    } catch {
      n1Ok = false;
    }
  }

  report.push({
    path: t,
    current_version: n,
    has_n_minus_1: n1Ok,
    n_minus_1_version: n1Ok ? n1 : null,
    n_minus_1_updated_time: n1Meta?.updated_time || null
  });

  // We require N-1 to exist to satisfy rotation no-denial proof.
  if (!n1Ok) throw new Error(`Rotation requirement failed: ${t} has no N-1`);
}

await evidence(runId, "vault-rotation.json", { ok: true, report });
console.log(`Vault rotation present for: ${rotateTargets.join(", ")}`);
process.exit(0);
