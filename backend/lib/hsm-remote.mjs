/**
 * HSM Remote Signing Module
 * Implements real cryptographic signing using C3 HSM via p11tool2-remote.
 *
 * This module is designed to be used with the new HSM operational profile,
 * enforcing role separation and centralized configuration.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { getUsrSession } from './hsm-session.mjs';
import { audit } from '../lib/audit.mjs';

const execFileAsync = promisify(execFile);

/**
 * Sign data using HSM private key with a USR_ session.
 *
 * @param {Buffer|string} data - Data to sign.
 * @param {string} keyLabel - HSM key label.
 * @param {string} slot - The HSM slot to use.
 * @param {string} p11tool2_cmd - Path to the p11tool2-remote binary.
 * @param {string} hsm_host - The HSM host.
 * @param {string} algorithm - Signature algorithm (default: SHA256withRSA).
 * @returns {Promise<Object>} Signature result.
 */
export async function signWithHSM(data, keyLabel, slot, p11tool2_cmd, hsm_host, algorithm = 'SHA256withRSA') {
  try {
    const session = getUsrSession(slot);

    // Ensure data is a buffer
    const dataBuffer = Buffer.isBuffer(data)
      ? data
      : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));

    // Hash the data first
    const hash = crypto.createHash('sha256').update(dataBuffer).digest();

    const tmpDataFile = `/tmp/hsm-sign-${Date.now()}.dat`;
    const tmpSigFile = `/tmp/hsm-sig-${Date.now()}.sig`;

    const fs = await import('fs/promises');
    await fs.writeFile(tmpDataFile, hash);

    try {
      await execFileAsync(p11tool2_cmd, [
        '--host', hsm_host,
        '--sign',
        '--infile', tmpDataFile,
        '--outfile', tmpSigFile,
        '--label', keyLabel,
        '--login', `${session.user},${session.pin}`,
        '--hash', 'SHA256'
      ], { timeout: 15000 });

      const signature = await fs.readFile(tmpSigFile);

      await fs.unlink(tmpDataFile).catch(() => {});
      await fs.unlink(tmpSigFile).catch(() => {});

      audit({
        op: 'sign',
        slot,
        principal: 'USR',
        result: 'OK',
        payload: { keyLabel, algorithm },
      });

      return {
        success: true,
        signature: signature.toString('base64'),
        signatureHex: signature.toString('hex'),
        algorithm,
        keyLabel,
        slot,
        principal: 'USR',
        timestamp: new Date().toISOString()
      };
    } catch (signError) {
      await fs.unlink(tmpDataFile).catch(() => {});
      await fs.unlink(tmpSigFile).catch(() => {});
      throw signError;
    }
  } catch (error) {
    console.error(`[HSM] Signing failed with key ${keyLabel} in slot ${slot}:`, error.message);
    audit({
      op: 'sign',
      slot,
      principal: 'USR',
      result: 'FAIL',
      error_code: 'signing_error',
      payload: { keyLabel, algorithm },
    });
    return {
      success: false,
      error: error.message,
      keyLabel,
      slot,
      principal: 'USR'
    };
  }
}
