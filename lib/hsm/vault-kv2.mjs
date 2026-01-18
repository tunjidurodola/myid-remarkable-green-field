function must(name, v) {
  if (!v) throw new Error(`[VAULT] missing ${name}`);
  return v;
}

/**
 * Reads Vault KV v2 secret:
 *   GET /v1/<mount>/data/<path>
 *
 * Example:
 *   mount: "c3-hsm"
 *   path:  "slots/0000/usr"
 */
export async function vaultReadKv2(mount, secretPath) {
  const addr = must("VAULT_ADDR", process.env.VAULT_ADDR);
  const token = must("VAULT_TOKEN", process.env.VAULT_TOKEN);

  const base = addr.replace(/\/$/, "");
  const p = String(secretPath).replace(/^\//, "");
  const url = `${base}/v1/${mount}/data/${p}`;

  const res = await fetch(url, {
    headers: { "X-Vault-Token": token }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[VAULT] read failed ${res.status} for ${mount}/data/${p}${body ? `: ${body.slice(0,300)}` : ""}`);
  }

  const j = await res.json();
  const data = j?.data?.data;
  if (!data || typeof data !== "object") throw new Error(`[VAULT] invalid kv-v2 payload for ${mount}/data/${p}`);
  return data;
}