import fs from "node:fs";
import { vaultKvV2Read } from "../lib/vault.mjs";
import { fail, ok, writeEvidence } from "../lib/report.mjs";

const policy = JSON.parse(fs.readFileSync("/perform1/srv/work/myid-app/agents/policy/compliance.json", "utf-8"));
const mount = process.env.VAULT_KV_MOUNT || policy.vault.kv_mount;

const required = policy.vault.required_paths;
const found = {};

for (const p of required) {
  const data = await vaultKvV2Read(mount, p);
  found[p] = Object.keys(data);
}

writeEvidence("vault-keys.json", { mount, found });

const mustHave = [
  { path: "myid/pwa/jwt", key: "jwt_secret" },
  { path: "myid/pwa/api", key: "api_key" },
  { path: "myid/hsm/jwt", key: "jwt_secret" },
  { path: "myid/hsm/api", key: "api_key" }
];

for (const m of mustHave) {
  const keys = found[m.path] || [];
  if (!keys.includes(m.key)) fail(`Vault secret missing key '${m.key}' at ${mount}/${m.path}`);
}

ok(`Vault KV v2 secrets present under mount '${mount}'`);
