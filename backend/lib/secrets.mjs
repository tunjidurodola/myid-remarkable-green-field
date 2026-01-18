import 'dotenv/config';
import fs from 'node:fs';

function must(name, v) {
  if (!v) throw new Error(`Missing required config: ${name}`);
  return v;
}

async function vaultReadKv2({ mount, path }) {
  const addr = must('VAULT_ADDR', process.env.VAULT_ADDR).replace(/\/+$/, '');
  const token = must('VAULT_TOKEN', process.env.VAULT_TOKEN);
  const url = `${addr}/v1/${mount}/data/${path}`;

  const res = await fetch(url, { headers: { 'X-Vault-Token': token } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vault read failed ${res.status} ${res.statusText}: ${url} ${body}`);
  }
  const json = await res.json();
  return json?.data?.data ?? {};
}

let _cache = null;

export async function getBackendSecrets() {
  if (_cache) return _cache;

  const mount = process.env.VAULT_KV_MOUNT || 'kv-v2';
  const jwtPath = process.env.VAULT_PATH_HSM_JWT || 'myid/hsm/jwt';
  const apiPath = process.env.VAULT_PATH_HSM_API || 'myid/hsm/api';

  const [jwt, api] = await Promise.all([
    vaultReadKv2({ mount, path: jwtPath }),
    vaultReadKv2({ mount, path: apiPath })
  ]);

  const jwt_secret = must(`vault:${mount}/${jwtPath} jwt_secret`, jwt.jwt_secret);
  const api_key = must(`vault:${mount}/${apiPath} api_key`, api.api_key);

  _cache = { jwt_secret, api_key, mount, jwtPath, apiPath };
  return _cache;
}
