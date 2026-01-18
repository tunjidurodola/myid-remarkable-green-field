import { fail, ok } from "./report.mjs";

function env(name) {
  const v = process.env[name];
  if (!v) fail(`${name} is not set`);
  return v;
}

export function vaultKvV2ReadUrl(mount, p) {
  const base = env("VAULT_ADDR").replace(/\/+$/, "");
  // KV v2 read endpoint: /v1/<mount>/data/<path>
  return `${base}/v1/${mount}/data/${p}`;
}

export async function vaultKvV2Read(mount, p) {
  const url = vaultKvV2ReadUrl(mount, p);
  const token = env("VAULT_TOKEN");

  const res = await fetch(url, {
    method: "GET",
    headers: { "X-Vault-Token": token }
  });

  const text = await res.text();
  if (!res.ok) {
    fail(`Vault read failed for ${mount}/${p} (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }

  let json;
  try { json = JSON.parse(text); } catch {
    fail(`Vault returned non-JSON for ${mount}/${p}`);
  }

  const data = json?.data?.data;
  if (!data || typeof data !== "object") fail(`Vault secret missing data at ${mount}/${p}`);
  ok(`Vault secret readable: ${mount}/${p}`);
  return data;
}
