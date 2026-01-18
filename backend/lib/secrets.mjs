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
 */
export async function getAPIKeyVersions() {
  const mount = process.env.VAULT_KV_MOUNT || 'kv-v2';
  const apiPath = process.env.VAULT_PATH_HSM_API || 'myid/hsm/api';

  // Read metadata to get current version
  const metadata = await vaultReadMetadata({ mount, path: apiPath });
  const currentVersion = metadata.data.current_version;

  if (!currentVersion || currentVersion < 1) {
    throw new Error(`Invalid current_version for ${mount}/${apiPath}`);
  }

  // Read current version (N)
  const current = await vaultReadKv2Versioned({ mount, path: apiPath, version: currentVersion });
  const currentKey = must(`vault:${mount}/${apiPath}[v${currentVersion}] api_key`, current.data.api_key);

  // Read previous version (N-1) if it exists
  let previousKey = null;
  let previousMetadata = null;

  if (currentVersion > 1) {
    try {
      const previous = await vaultReadKv2Versioned({ mount, path: apiPath, version: currentVersion - 1 });
      previousKey = previous.data.api_key || null;
      previousMetadata = previous.metadata;
    } catch (err) {
      // N-1 may not exist or be destroyed, which is OK
      console.warn(`[Vault] Could not read N-1 version: ${err.message}`);
    }
  }

  return {
    currentKey,
    currentVersion,
    currentMetadata: current.metadata,
    previousKey,
    previousVersion: currentVersion > 1 ? currentVersion - 1 : null,
    previousMetadata
  };
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
