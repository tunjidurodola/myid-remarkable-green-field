import { fail, ok } from "./report.mjs";

function env(name) {
  const v = process.env[name];
  if (!v) fail(`${name} is not set`);
  return v;
}

export async function vaultKvV2Read(mount, p) {
  const base = env("VAULT_ADDR").replace(/\/+$/, "");
  const token = env("VAULT_TOKEN");
  const url = `${base}/v1/${mount}/data/${p}`;

  const res = await fetch(url, { headers: { "X-Vault-Token": token } });
  const text = await res.text();
  if (!res.ok) fail(`Vault read failed ${mount}/${p} HTTP ${res.status}: ${text.slice(0,200)}`);

  let json;
  try { json = JSON.parse(text); } catch { fail(`Vault non-JSON response for ${mount}/${p}`); }

  const data = json?.data?.data;
  if (!data) fail(`Vault missing data at ${mount}/${p}`);
  ok(`Vault OK: ${mount}/${p}`);
  return data;
}
