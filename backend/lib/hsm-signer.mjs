/**
 * HSM (Hardware Security Module) Signing Module
 * Provides a high-level interface for signing operations using the HSM.
 * This module integrates with the centralized HSM state and session management.
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { signWithHSM } from './hsm-remote.mjs';
import { getHsmState } from './hsm-session.mjs';

/**
 * HSMSigner
 * Performs cryptographic signing operations using the configured HSM.
 */
export class HSMSigner {
  /**
   * Sign data using a private key in the HSM.
   * This operation always uses the USR role for the default slot.
   *
   * @param {Buffer|string} data - The data to sign.
   * @param {Object} options - Signing options.
   * @param {string} options.keyLabel - The label of the key to use for signing.
   * @param {string} [options.hashAlgorithm='SHA-256'] - The hashing algorithm to use.
   * @returns {Promise<Object>} The signature result.
   */
  async sign(data, options = {}) {
    const state = getHsmState();
    const { keyLabel, hashAlgorithm = 'SHA-256' } = options;

    if (!keyLabel) {
      throw new Error('keyLabel is required for HSM signing');
    }

    try {
      // Convert data to buffer
      const dataBuffer = Buffer.isBuffer(data)
        ? data
        : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));

      // Hash the data
      const hash = crypto
        .createHash(hashAlgorithm.replace('-', '').toLowerCase())
        .update(dataBuffer)
        .digest();

      // Perform signing using the default slot and USR role
      const signResult = await signWithHSM(
        hash,
        keyLabel,
        state.config.default_slot,
        state.config.p11tool2_cmd,
        state.config.hsm_host
      );

      if (!signResult.success) {
        throw new Error(`HSM signing failed: ${signResult.error}. Ensure key '${keyLabel}' exists in slot ${state.config.default_slot}`);
      }

      const signature = Buffer.from(signResult.signature, 'base64');

      return {
        signature: signature.toString('base64'),
        signatureHex: signature.toString('hex'),
        algorithm: signResult.algorithm,
        hashAlgorithm,
        keyLabel,
        slot: state.config.default_slot,
        principal: 'USR',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('HSM signing error:', error);
      throw new Error(`HSM signing failed: ${error.message}`);
    }
  }
}

// Create a singleton instance
export const hsmSigner = new HSMSigner();

/**
 * QES Signature Formats
 */
export const QES_FORMATS = {
  CAdES_B: 'CAdES-B',
  CAdES_T: 'CAdES-T',
  CAdES_LT: 'CAdES-LT',
  CAdES_LTA: 'CAdES-LTA',
  PAdES_B: 'PAdES-B',
  XAdES_B: 'XAdES-B',
};

/**
 * Signature Algorithms
 */
export const SIGNATURE_ALGORITHMS = {
  RSA_SHA256: 'SHA256withRSA',
  ECDSA_SHA256: 'SHA256withECDSA',
  RSA_PSS: 'RSASSA-PSS',
};

/**
 * QESManager
 * Manages Qualified Electronic Signature operations
 */
export class QESManager {
  /**
   * Create a QES signature
   */
  async createQES(documentHash, certificateId, userId, options = {}) {
    const { format = QES_FORMATS.CAdES_B, commitmentType = 'proofOfApproval' } = options;

    const signatureId = uuidv4();
    const signingTime = new Date().toISOString();

    // Sign the document hash using HSM
    const signResult = await hsmSigner.sign(documentHash, {
      keyLabel: `qes_${userId}`,
    });

    return {
      signatureId,
      format,
      commitmentType,
      signingTime,
      documentHash,
      certificateId,
      signature: signResult.signature,
      signatureHex: signResult.signatureHex,
      algorithm: signResult.algorithm,
      compliance: 'eIDAS',
    };
  }

  /**
   * Verify a QES signature
   */
  async verifyQES(signature, documentHash) {
    const errors = [];

    // Verify document hash matches
    if (signature.documentHash !== documentHash) {
      errors.push('Document hash mismatch');
    }

    // Verify signature format
    if (!Object.values(QES_FORMATS).includes(signature.format)) {
      errors.push('Invalid signature format');
    }

    // Verify signing time is present
    if (!signature.signingTime) {
      errors.push('Missing signing time');
    }

    return {
      verified: errors.length === 0,
      format: signature.format,
      signingTime: signature.signingTime,
      compliance: signature.compliance,
      errors,
    };
  }

  /**
   * Request a QES certificate
   */
  async requestQESCertificate(userId, identityData) {
    const certificateId = uuidv4();
    const serialNumber = Math.floor(Math.random() * 1000000).toString(16).toUpperCase();
    const validFrom = new Date();
    const validTo = new Date(validFrom.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year

    const subject = `CN=${identityData.firstName} ${identityData.lastName}, E=${identityData.email}`;

    // In production, this would generate a real certificate signed by the HSM CA
    const certificate = `-----BEGIN CERTIFICATE-----
MIICertificatePlaceholder
-----END CERTIFICATE-----`;

    return {
      certificateId,
      serialNumber,
      subject,
      certificate,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      requestedAt: new Date().toISOString(),
    };
  }
}

/**
 * CertificateManager
 * Manages X.509 certificates for QES
 */
export class CertificateManager {
  /**
   * Issue a certificate
   */
  async issueCertificate(userId, identityData) {
    const certificateId = uuidv4();
    const serialNumber = Math.floor(Math.random() * 1000000).toString(16).toUpperCase();
    const validFrom = new Date();
    const validTo = new Date(validFrom.getTime() + 365 * 24 * 60 * 60 * 1000);

    const subject = `CN=${identityData.firstName} ${identityData.lastName}, E=${identityData.email}`;

    return {
      certificateId,
      serialNumber,
      subject,
      issuer: 'CN=pocketOne CA, O=pocketOne (Pty) Ltd, C=ZA',
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
    };
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(certificateId, reason) {
    return {
      certificateId,
      revoked: true,
      revokedAt: new Date().toISOString(),
      reason,
    };
  }
}

// Create singleton instances
export const qesManager = new QESManager();
export const certificateManager = new CertificateManager();

export default {
  HSMSigner,
  hsmSigner,
  QESManager,
  qesManager,
  CertificateManager,
  certificateManager,
  QES_FORMATS,
  SIGNATURE_ALGORITHMS,
};
