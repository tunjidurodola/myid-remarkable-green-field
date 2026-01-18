/**
 * HSM Session Management Module
 *
 * Provides functions to securely retrieve HSM session credentials (user and PIN)
 * from the pre-validated startup state. This module is the single source of
 * truth for HSM credentials and prevents PIN leakage to other parts of the application.
 */

import { adminUser, usrUser } from './hsm-tools.mjs';

// This function should be called at startup to provide the _hsmState
let _hsmState = null;
export function initHsmState(state) {
  if (!state || !state.config || !state.slotPins) {
    throw new Error('[HSM-SESSION] Invalid _hsmState provided');
  }
  _hsmState = state;
}

/**
 * Get the global HSM state.
 * Fails closed if the state is not initialized.
 *
 * @returns {object} The _hsmState object
 */
export function getHsmState() {
  if (!_hsmState) {
    throw new Error('[HSM-SESSION] HSM state not initialized');
  }
  return _hsmState;
}

/**
 * Get User session credentials for a given slot.
 * Fails closed if the slot is not enabled or PINs are not loaded.
 *
 * @param {string} slot - Slot identifier
 * @returns {{user: string, pin: string}} Session object
 */
export function getUsrSession(slot) {
  if (!_hsmState) {
    throw new Error('[HSM-SESSION] HSM state not initialized');
  }
  const slot4 = String(slot).padStart(4, '0');

  // Security check: only allow sessions for enabled slots
  if (!_hsmState.config.enabled_slots.includes(slot4)) {
    throw new Error(`[HSM-SESSION] Slot ${slot4} is not enabled`);
  }

  const pins = _hsmState.slotPins[slot4];
  if (!pins || !pins.usr_pin) {
    throw new Error(`[HSM-SESSION] User PIN not loaded for slot ${slot4}`);
  }

  return {
    user: usrUser(slot4),
    pin: pins.usr_pin
  };
}

/**
 * Get Admin session credentials for a given slot (for admin-only operations).
 * Fails closed if the slot is not enabled or PINs are not loaded.
 *
 * @param {string} slot - Slot identifier
 * @returns {{user: string, pin: string}} Session object
 */
export function getAdminSession(slot) {
  if (!_hsmState) {
    throw new Error('[HSM-SESSION] HSM state not initialized');
  }
  const slot4 = String(slot).padStart(4, '0');

  // Security check: only allow sessions for enabled slots
  if (!_hsmState.config.enabled_slots.includes(slot4)) {
    throw new Error(`[HSM-SESSION] Slot ${slot4} is not enabled`);
  }

  const pins = _hsmState.slotPins[slot4];
  if (!pins || !pins.admin_pin) {
    throw new Error(`[HSM-SESSION] Admin PIN not loaded for slot ${slot4}`);
  }

  return {
    user: adminUser(slot4),
    pin: pins.admin_pin
  };
}
