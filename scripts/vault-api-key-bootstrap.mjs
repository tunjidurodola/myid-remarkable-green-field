#!/usr/bin/env node
/**
 * Vault API Key Bootstrap and Rotation Script
 * Manages API key lifecycle in Vault kv-v2 store
 *
 * Commands:
 *   --init    : Initialize API key if missing (fail-safe, won't overwrite)
 *   --rotate  : Rotate API key (current -> previous, generate new current)
 *   --status  : Show masked status of keys
 */

import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const VAULT_MOUNT = process.env.VAULT_KV_MOUNT || 'kv-v2';
const API_PATH = process.env.VAULT_PATH_PWA_API || 'myid/pwa/api';

/**
 * Generate a cryptographically strong API key
 * @returns {string} 64-character hex string (32 bytes)
 */
function generateKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Execute vault command
 */
async function vaultExec(args) {
  const { stdout, stderr } = await execFileAsync('vault', args);
  if (stderr && !stderr.includes('Success')) {
    console.error('[Vault]', stderr);
  }
  return stdout;
}

/**
 * Read current API key from Vault
 */
async function readAPIKey() {
  try {
    const output = await vaultExec(['kv', 'get', '-mount=' + VAULT_MOUNT, '-format=json', API_PATH]);
    const data = JSON.parse(output);
    return data.data.data;
  } catch (err) {
    if (err.message.includes('No value found')) {
      return null;
    }
    throw err;
  }
}

/**
 * Write API key to Vault
 */
async function writeAPIKey(data) {
  const args = ['kv', 'put', `-mount=${VAULT_MOUNT}`, API_PATH];
  for (const [key, value] of Object.entries(data)) {
    args.push(`${key}=${value}`);
  }
  await vaultExec(args);
}

/**
 * Mask key for display (show first 8 and last 4 chars)
 */
function maskKey(key) {
  if (!key || key === 'n/a') return 'n/a';
  if (key.length < 16) return '***';
  return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
}

/**
 * Initialize API key if missing
 */
async function initAPIKey() {
  console.log('[INIT] Checking Vault API key...');

  const existing = await readAPIKey();

  if (existing && existing.current_key && existing.current_key !== 'n/a') {
    console.log('[INIT] ✓ API key already exists');
    console.log(`       Current: ${maskKey(existing.current_key)}`);
    console.log(`       Previous: ${maskKey(existing.previous_key)}`);
    console.log('[INIT] No action needed (use --rotate to rotate keys)');
    return;
  }

  console.log('[INIT] Generating new API key...');
  const currentKey = generateKey();

  const data = {
    current_key: currentKey,
    previous_key: 'n/a',
    rotated_at: new Date().toISOString()
  };

  await writeAPIKey(data);
  console.log('[INIT] ✓ API key initialized');
  console.log(`       Current: ${maskKey(currentKey)}`);
  console.log(`       Path: ${VAULT_MOUNT}/${API_PATH}`);
}

/**
 * Rotate API key (current -> previous, generate new current)
 */
async function rotateAPIKey() {
  console.log('[ROTATE] Reading current API key...');

  const existing = await readAPIKey();

  if (!existing || !existing.current_key || existing.current_key === 'n/a') {
    console.error('[ROTATE] ERROR: No current key found. Run --init first.');
    process.exit(1);
  }

  console.log('[ROTATE] Current key: ' + maskKey(existing.current_key));
  console.log('[ROTATE] Generating new key...');

  const newCurrentKey = generateKey();
  const data = {
    current_key: newCurrentKey,
    previous_key: existing.current_key, // Old current becomes previous
    rotated_at: new Date().toISOString()
  };

  await writeAPIKey(data);
  console.log('[ROTATE] ✓ API key rotated');
  console.log(`         New current: ${maskKey(newCurrentKey)}`);
  console.log(`         Previous: ${maskKey(data.previous_key)}`);
  console.log('[ROTATE] Both keys will be accepted for API calls (N/N-1 validation)');
}

/**
 * Show status of API keys
 */
async function showStatus() {
  console.log('[STATUS] Vault API Key Status');
  console.log(`         Path: ${VAULT_MOUNT}/${API_PATH}`);

  const existing = await readAPIKey();

  if (!existing) {
    console.log('[STATUS] ⚠ No API key found (run --init)');
    return;
  }

  console.log(`         Current: ${maskKey(existing.current_key)}`);
  console.log(`         Previous: ${maskKey(existing.previous_key)}`);
  console.log(`         Rotated: ${existing.rotated_at || 'unknown'}`);

  if (!existing.current_key || existing.current_key === 'n/a') {
    console.log('[STATUS] ⚠ No valid current key (run --init)');
  } else if (!existing.previous_key || existing.previous_key === 'n/a') {
    console.log('[STATUS] ℹ No previous key (rotate to enable N-1 validation)');
  } else {
    console.log('[STATUS] ✓ Both N and N-1 keys available');
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    console.log('Vault API Key Bootstrap & Rotation');
    console.log('');
    console.log('Usage:');
    console.log('  node vault-api-key-bootstrap.mjs --init     # Initialize if missing');
    console.log('  node vault-api-key-bootstrap.mjs --rotate   # Rotate keys');
    console.log('  node vault-api-key-bootstrap.mjs --status   # Show status');
    console.log('');
    console.log('Environment:');
    console.log(`  VAULT_KV_MOUNT=${VAULT_MOUNT}`);
    console.log(`  VAULT_PATH_PWA_API=${API_PATH}`);
    return;
  }

  try {
    if (args.includes('--init')) {
      await initAPIKey();
    } else if (args.includes('--rotate')) {
      await rotateAPIKey();
    } else if (args.includes('--status')) {
      await showStatus();
    } else {
      console.error('Unknown command. Use --help for usage.');
      process.exit(1);
    }
  } catch (err) {
    console.error('[ERROR]', err.message);
    process.exit(1);
  }
}

main();
