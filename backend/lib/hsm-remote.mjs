/**
 * HSM Remote Signing Module
 * Implements real cryptographic signing using C3 HSM via csadm-remote/p11tool2-remote
 *
 * NO STUBS - Private keys never leave the HSM
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import crypto from 'crypto';
import { SignJWT, importJWK } from 'jose';

const execFileAsync = promisify(execFile);

const HSM_CONFIG = {
  host: process.env.HSM_HOST || '172.27.127.129',
  port: process.env.HSM_PORT || '3001',
  slot: process.env.HSM_SLOT || '0',
  pin: process.env.HSM_PIN || '',
  defaultKeyLabel: 'ca-root-key'
};

/**
 * List objects in HSM slot
 */
export async function listHSMObjects() {
  try {
    const { stdout } = await execFileAsync('csadm-remote', [
      '--host', HSM_CONFIG.host,
      '--port', HSM_CONFIG.port,
      'list-objects',
      '--slot', HSM_CONFIG.slot
    ], { timeout: 10000 });

    return {
      success: true,
      output: stdout,
      slot: HSM_CONFIG.slot
    };
  } catch (error) {
    console.error('[HSM] Failed to list objects:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get certificate from HSM slot
 */
export async function getHSMCertificate(label = HSM_CONFIG.defaultKeyLabel) {
  try {
    const { stdout } = await execFileAsync('p11tool2-remote', [
      '--host', HSM_CONFIG.host,
      '--port', HSM_CONFIG.port,
      '--list-certs',
      '--provider', `/usr/lib/softhsm/libsofthsm2.so`,
      '--login',
      '--set-pin', HSM_CONFIG.pin,
      '--label', label
    ], { timeout: 10000 });

    return {
      success: true,
      certificate: stdout,
      label
    };
  } catch (error) {
    console.error(`[HSM] Failed to get certificate for label ${label}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sign data using HSM private key
 * @param {Buffer|string} data - Data to sign
 * @param {string} keyLabel - HSM key label
 * @param {string} algorithm - Signature algorithm (default: SHA256withRSA)
 * @returns {Promise<Object>} Signature result
 */
export async function signWithHSM(data, keyLabel = HSM_CONFIG.defaultKeyLabel, algorithm = 'SHA256withRSA') {
  try {
    // Ensure data is a buffer
    const dataBuffer = Buffer.isBuffer(data)
      ? data
      : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));

    // Hash the data first
    const hash = crypto.createHash('sha256').update(dataBuffer).digest();

    // Sign using p11tool2-remote
    // Note: p11tool2-remote requires data file input
    const tmpDataFile = `/tmp/hsm-sign-${Date.now()}.dat`;
    const tmpSigFile = `/tmp/hsm-sig-${Date.now()}.sig`;

    const fs = await import('fs/promises');
    await fs.writeFile(tmpDataFile, hash);

    try {
      const { stdout } = await execFileAsync('p11tool2-remote', [
        '--host', HSM_CONFIG.host,
        '--port', HSM_CONFIG.port,
        '--sign',
        '--infile', tmpDataFile,
        '--outfile', tmpSigFile,
        '--label', keyLabel,
        '--provider', `/usr/lib/softhsm/libsofthsm2.so`,
        '--login',
        '--set-pin', HSM_CONFIG.pin,
        '--hash', 'SHA256'
      ], { timeout: 15000 });

      // Read signature
      const signature = await fs.readFile(tmpSigFile);

      // Clean up temp files
      await fs.unlink(tmpDataFile).catch(() => {});
      await fs.unlink(tmpSigFile).catch(() => {});

      return {
        success: true,
        signature: signature.toString('base64'),
        signatureHex: signature.toString('hex'),
        algorithm,
        keyLabel,
        timestamp: new Date().toISOString()
      };
    } catch (signError) {
      // Clean up temp files on error
      await fs.unlink(tmpDataFile).catch(() => {});
      await fs.unlink(tmpSigFile).catch(() => {});
      throw signError;
    }
  } catch (error) {
    console.error(`[HSM] Signing failed with key ${keyLabel}:`, error.message);
    return {
      success: false,
      error: error.message,
      keyLabel
    };
  }
}

/**
 * Create JWS using HSM signing
 * @param {Object} payload - JWT payload
 * @param {string} keyLabel - HSM key label
 * @returns {Promise<string>} JWS token
 */
export async function createJWSWithHSM(payload, keyLabel = HSM_CONFIG.defaultKeyLabel) {
  try {
    // For JWS, we need to use a proper JWT library with custom signer
    // Since p11tool2-remote works with raw signing, we'll create the JWS manually

    // Create header
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    // Encode header and payload
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // Create signing input
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Sign with HSM
    const signResult = await signWithHSM(Buffer.from(signingInput), keyLabel);

    if (!signResult.success) {
      throw new Error(`HSM signing failed: ${signResult.error}`);
    }

    // Convert signature to base64url
    const signature = Buffer.from(signResult.signature, 'base64').toString('base64url');

    // Create JWS
    const jws = `${signingInput}.${signature}`;

    return {
      success: true,
      jws,
      keyLabel,
      algorithm: 'RS256'
    };
  } catch (error) {
    console.error('[HSM] JWS creation failed:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Health check for HSM connection
 */
export async function checkHSMHealth() {
  try {
    const listResult = await listHSMObjects();
    return {
      healthy: listResult.success,
      host: HSM_CONFIG.host,
      port: HSM_CONFIG.port,
      slot: HSM_CONFIG.slot,
      message: listResult.success ? 'HSM accessible' : listResult.error
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message
    };
  }
}

export default {
  listHSMObjects,
  getHSMCertificate,
  signWithHSM,
  createJWSWithHSM,
  checkHSMHealth,
  HSM_CONFIG
};
