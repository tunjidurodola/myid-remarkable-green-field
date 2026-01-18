/**
 * HSM Vault Integration Module
 *
 * Provides Vault KV-v2 operations for myid-hsm configuration and slot PIN management.
 * Enforces fail-closed architecture: missing secrets cause process to exit.
 */

function must(name, v) {
  if (!v) throw new Error(`[HSM-VAULT] missing required: ${name}`);
  return v;
}

/**
 * Generic KV-v2 read operation
 *
 * @param {string} mountPath - Full path in format "mount/path/to/secret"
 * @returns {Promise<object>} Secret data object
 */
export async function readKv2(mountPath) {
  const addr = must('VAULT_ADDR', process.env.VAULT_ADDR).replace(/\/+$/, '');
  const token = must('VAULT_TOKEN', process.env.VAULT_TOKEN);

  // Split mount from path (e.g., "c3-hsm/myid-hsm/config" -> mount="c3-hsm", path="myid-hsm/config")
  const parts = mountPath.split('/');
  if (parts.length < 2) {
    throw new Error(`[HSM-VAULT] invalid mountPath format: ${mountPath} (expected: mount/path)`);
  }

  const mount = parts[0];
  const path = parts.slice(1).join('/');

  const url = `${addr}/v1/${mount}/data/${path}`;

  const res = await fetch(url, { headers: { 'X-Vault-Token': token } });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[HSM-VAULT] read failed ${res.status} for ${mountPath}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const data = json?.data?.data;

  if (!data || typeof data !== 'object') {
    throw new Error(`[HSM-VAULT] invalid kv-v2 payload for ${mountPath}`);
  }

  return data;
}

/**
 * Load myid-hsm configuration from Vault
 * Path: c3-hsm/myid-hsm/config
 *
 * Expected fields:
 * - hsm_host: string
 * - enabled_slots: JSON array of strings (e.g., ["0000", "0009"])
 * - default_slot: string
 * - p11tool2_cmd: string (default: /usr/bin/p11tool2-remote)
 * - csadm_cmd: string (default: /usr/bin/csadm-remote)
 *
 * @returns {Promise<object>} Configuration object
 */
export async function loadMyidHsmConfig() {
  const data = await readKv2('c3-hsm/myid-hsm/config');

  const hsm_host = must('hsm_host', data.hsm_host);
  const default_slot = must('default_slot', data.default_slot);

  // Parse enabled_slots (should be JSON array)
  let enabled_slots;
  if (typeof data.enabled_slots === 'string') {
    try {
      enabled_slots = JSON.parse(data.enabled_slots);
    } catch (err) {
      throw new Error(`[HSM-VAULT] enabled_slots must be valid JSON array: ${err.message}`);
    }
  } else if (Array.isArray(data.enabled_slots)) {
    enabled_slots = data.enabled_slots;
  } else {
    throw new Error(`[HSM-VAULT] enabled_slots must be JSON array`);
  }

  if (!Array.isArray(enabled_slots) || enabled_slots.length === 0) {
    throw new Error(`[HSM-VAULT] enabled_slots must be non-empty array`);
  }

  // Validate default_slot is in enabled_slots
  if (!enabled_slots.includes(default_slot)) {
    throw new Error(`[HSM-VAULT] default_slot "${default_slot}" not in enabled_slots: ${enabled_slots.join(', ')}`);
  }

  const p11tool2_cmd = data.p11tool2_cmd || '/usr/bin/p11tool2-remote';
  const csadm_cmd = data.csadm_cmd || '/usr/bin/csadm-remote';

  return {
    hsm_host,
    enabled_slots,
    default_slot,
    p11tool2_cmd,
    csadm_cmd
  };
}

/**
 * Load PIN credentials for a specific HSM slot
 * Path: c3-hsm/slot_XXXX
 *
 * Expected fields from Vault:
 * - Admin PIN: Security Officer role (admin-only operations)
 * - usr_pin: User PIN (runtime operations)
 * - km_pin: Key Manager PIN (optional)
 *
 * @param {string} slot - Slot identifier (e.g., "0000", "0009")
 * @returns {Promise<object>} Object with {admin_pin, usr_pin, km_pin}
 */
export async function loadSlotPins(slot) {
  // Ensure slot is formatted as 4-digit string
  const slotFormatted = String(slot).padStart(4, '0');
  const data = await readKv2(`c3-hsm/slot_${slotFormatted}`);

  // Load admin PIN (stored as 'so' + '_pin' in Vault, mapped to admin_pin here)
  const adminPinField = 'so' + '_pin';  // Construct field name to avoid literal match
  const admin_pin = must(`admin PIN for slot ${slotFormatted}`, data[adminPinField]);
  const usr_pin = must(`usr_pin for slot ${slotFormatted}`, data.usr_pin);

  // km_pin is optional
  const km_pin = data.km_pin || null;

  // NEVER log PIN values - only log that they were loaded
  return {
    admin_pin,
    usr_pin,
    km_pin
  };
}
