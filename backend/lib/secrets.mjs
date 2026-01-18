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

async function vaultReadKv2Versioned({ mount, path, version }) {
  const addr = must('VAULT_ADDR', process.env.VAULT_ADDR).replace(/\/+$/, '');
  const token = must('VAULT_TOKEN', process.env.VAULT_TOKEN);
  const url = version
    ? `${addr}/v1/${mount}/data/${path}?version=${version}`
    : `${addr}/v1/${mount}/data/${path}`;

  const res = await fetch(url, { headers: { 'X-Vault-Token': token } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vault read failed ${res.status} ${res.statusText}: ${url} ${body}`);
  }
  const json = await res.json();
  return {
    data: json?.data?.data ?? {},
    metadata: json?.data?.metadata ?? {}
  };
}

async function vaultReadMetadata({ mount, path }) {
  const addr = must('VAULT_ADDR', process.env.VAULT_ADDR).replace(/\/+$/, '');
  const token = must('VAULT_TOKEN', process.env.VAULT_TOKEN);
  const url = `${addr}/v1/${mount}/metadata/${path}`;

  const res = await fetch(url, { headers: { 'X-Vault-Token': token } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vault metadata read failed ${res.status} ${res.statusText}: ${url} ${body}`);
  }
  return await res.json();
}

/**
 * Read API key with N and N-1 version support for rotation
 * Returns both current and previous API keys with metadata
 *
 * Schema: current_key, previous_key (not versioned reads, but from single secret)
 */
export async function getAPIKeyVersions() {
  const mount = process.env.VAULT_KV_MOUNT || 'kv-v2';
  const apiPath = process.env.VAULT_PATH_PWA_API || 'myid/pwa/api';

  // Read current secret (not versioned)
  const secret = await vaultReadKv2({ mount, path: apiPath });

  const currentKey = must(`vault:${mount}/${apiPath} current_key`, secret.current_key);
  const previousKey = secret.previous_key === 'n/a' ? null : secret.previous_key;

  return {
    currentKey,
    currentVersion: null, // Not using versioned approach
    currentMetadata: null,
    previousKey,
    previousVersion: null,
    previousMetadata: null,
    rotatedAt: secret.rotated_at || null
  };
}

let _cache = null;

export async function getBackendSecrets() {
  if (_cache) return _cache;

  const mount = process.env.VAULT_KV_MOUNT || 'kv-v2';
  const jwtPath = process.env.VAULT_PATH_HSM_JWT || 'myid/hsm/jwt';

  const jwt = await vaultReadKv2({ mount, path: jwtPath });
  const jwt_secret = must(`vault:${mount}/${jwtPath} jwt_secret`, jwt.jwt_secret);

  _cache = { jwt_secret, mount, jwtPath };
  return _cache;
}
