/**
 * HSM Admin Routes Module
 *
 * Provides administrative endpoints for managing the HSM.
 * All routes in this module are protected by API key and a secondary admin header.
 */

import express from 'express';
import crypto from 'crypto';
import { readKv2 } from '../lib/hsm-vault.mjs';
import { getHsmState, getAdminSession } from '../lib/hsm-session.mjs';
import { listUsers } from '../lib/hsm-tools.mjs';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { audit } from '../lib/audit.mjs';

const execFileAsync = promisify(execFile);
const router = express.Router();

// Cache for the admin API key
let _adminApiKey = null;
let _adminApiKeyTime = 0;
const ADMIN_KEY_CACHE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch the admin operations key from Vault.
 * @returns {Promise<string|null>} The admin key.
 */
async function getAdminOpKey() {
  const now = Date.now();
  if (_adminApiKey && (now - _adminApiKeyTime < ADMIN_KEY_CACHE_MS)) {
    return _adminApiKey;
  }

  try {
    const data = await readKv2('c3-hsm/myid-hsm/admin');
    _adminApiKey = data.admin_op_key || null;
    _adminApiKeyTime = now;
    return _adminApiKey;
  } catch (error) {
    console.error('[HSM-ADMIN] Failed to load admin_op_key from Vault:', error.message);
    return null;
  }
}

/**
 * Middleware to protect admin routes.
 * Requires a valid X-Admin-Op header.
 */
const requireAdminOp = async (req, res, next) => {
  const providedKey = req.headers['x-admin-op'];
  const adminKey = await getAdminOpKey();

  if (!adminKey) {
    return res.status(503).json({
      error: 'admin_op_key_not_configured',
      message: 'HSM admin functionality is not available',
    });
  }

  if (!providedKey || !crypto.timingSafeEqual(Buffer.from(providedKey), Buffer.from(adminKey))) {
    return res.status(403).json({ error: 'forbidden' });
  }

  next();
};

/**
 * GET /api/hsm/admin/users
 * Lists users on the HSM.
 */
router.get('/users', requireAdminOp, async (req, res) => {
  const state = getHsmState();
  try {
    const output = await listUsers(state.config.csadm_cmd);
    audit({ op: 'listUsers', slot: 'N/A', principal: 'SO', result: 'OK', endpoint: req.path });
    res.type('text/plain').send(output);
  } catch (error) {
    audit({ op: 'listUsers', slot: 'N/A', principal: 'SO', result: 'FAIL', error_code: 'list_users_failed', endpoint: req.path });
    res.status(500).json({ error: 'failed_to_list_users', message: error.message });
  }
});

/**
 * GET /api/hsm/admin/slots
 * Lists available slots.
 */
router.get('/slots', requireAdminOp, async (req, res) => {
  const state = getHsmState();
  try {
    // This uses p11tool2-remote with SO credentials to list slots
    const session = getAdminSession(state.config.default_slot);
    const { stdout } = await execFileAsync(state.config.p11tool2_cmd, [
        '--host', state.config.hsm_host,
        'ListSlots',
        '--login', `${session.user},${session.pin}`
    ], { timeout: 15000 });
    audit({ op: 'listSlots', slot: state.config.default_slot, principal: 'SO', result: 'OK', endpoint: req.path });
    res.type('text/plain').send(stdout);
  } catch (error) {
    audit({ op: 'listSlots', slot: state.config.default_slot, principal: 'SO', result: 'FAIL', error_code: 'list_slots_failed', endpoint: req.path });
    res.status(500).json({ error: 'failed_to_list_slots', message: error.message });
  }
});

/**
 * GET /api/hsm/admin/objects
 * Lists objects in a specific slot.
 */
router.get('/objects', requireAdminOp, async (req, res) => {
  const { slot } = req.query;
  if (!slot) {
    return res.status(400).json({ error: 'slot_query_param_required' });
  }

  try {
    const state = getHsmState();
    const session = getAdminSession(slot);
    const { stdout } = await execFileAsync(state.config.p11tool2_cmd, [
        '--host', state.config.hsm_host,
        'ListObjects',
        '--slot', slot,
        '--login', `${session.user},${session.pin}`
    ], { timeout: 15000 });
    audit({ op: 'listObjects', slot, principal: 'SO', result: 'OK', endpoint: req.path });
    res.type('text/plain').send(stdout);
  } catch (error) {
    audit({ op: 'listObjects', slot, principal: 'SO', result: 'FAIL', error_code: 'list_objects_failed', endpoint: req.path });
    res.status(500).json({ error: 'failed_to_list_objects', message: error.message });
  }
});

export default router;
