import fs from "node:fs";
import { vaultKvV2Read } from "../lib/vault.mjs";
import { fail, ok, writeJson } from "../lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/fixpack/policy/fixpack.json","utf-8"));
const mount = process.env.VAULT_KV_MOUNT || policy.vault.kv_mount;

const paths = policy.vault.paths;
const keys = policy.vault.keys;

const checks = [
  { p: paths.pwa_jwt, k: keys.jwt_secret },
  { p: paths.pwa_api, k: keys.api_key },
  { p: paths.hsm_jwt, k: keys.jwt_secret },
  { p: paths.hsm_api, k: keys.api_key }
];

const evidence = {};
for (const c of checks) {
  const d = await vaultKvV2Read(mount, c.p);
  evidence[c.p] = Object.keys(d);
  if (!(c.k in d)) fail(`Vault missing key '${c.k}' at ${mount}/${c.p}`);
  if (!String(d[c.k] || "").trim()) fail(`Vault key '${c.k}' empty at ${mount}/${c.p}`);
}

writeJson("vault-required-ok.json", { mount, evidence });
ok("Vault required secrets present (kv-v2)");
