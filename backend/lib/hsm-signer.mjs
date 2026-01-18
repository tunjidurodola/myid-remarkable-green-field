/**
 * HSM (Hardware Security Module) Signing Module
 * Connects to Utimaco HSM for secure cryptographic operations
 *
 * HSM Configuration:
 * - Host: 172.27.127.129
 * - Port: 3001
 * - Slot: 0
 * - Label: pocketOne_CA
 * - PKCS#11 Module: /opt/utimaco/lib/libcs_pkcs11_R3.so
 */

import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
import forge from 'node-forge';
import { signWithHSM, createJWSWithHSM, listHSMObjects, getHSMCertificate } from './hsm-remote.mjs';

// HSM Configuration from environment
const HSM_CONFIG = {
  host: process.env.HSM_HOST || '172.27.127.129',
  port: parseInt(process.env.HSM_PORT || '3001', 10),
  slot: parseInt(process.env.HSM_SLOT || '0', 10),
  label: process.env.HSM_LABEL || 'pocketOne_CA',
  pkcs11Module: process.env.HSM_PKCS11_MODULE || '/opt/utimaco/lib/libcs_pkcs11_R3.so',
  pin: process.env.HSM_PIN || '',
};

// Signature algorithms supported
export const SIGNATURE_ALGORITHMS = {
  RSA_SHA256: 'SHA256withRSA',
  RSA_SHA384: 'SHA384withRSA',
  RSA_SHA512: 'SHA512withRSA',
  ECDSA_SHA256: 'SHA256withECDSA',
  ECDSA_SHA384: 'SHA384withECDSA',
  ED25519: 'Ed25519',
};

// Key types
export const KEY_TYPES = {
  RSA_2048: { algorithm: 'RSA', size: 2048 },
  RSA_4096: { algorithm: 'RSA', size: 4096 },
  EC_P256: { algorithm: 'EC', curve: 'P-256' },
  EC_P384: { algorithm: 'EC', curve: 'P-384' },
  ED25519: { algorithm: 'Ed25519' },
};

// QES signature formats
export const QES_FORMATS = {
  CAdES_B: 'CAdES-B',
  CAdES_T: 'CAdES-T',
  CAdES_LT: 'CAdES-LT',
  CAdES_LTA: 'CAdES-LTA',
  PAdES_B: 'PAdES-B',
  XAdES_B: 'XAdES-B',
};

/**
 * HSM Connection Manager
 * Manages connection to the HSM via PKCS#11
 */
export class HSMConnection {
  constructor() {
    this.connected = false;
    this.session = null;
    this.slot = HSM_CONFIG.slot;
    this.lastHeartbeat = null;
  }

  /**
   * Initialize PKCS#11 connection
   * In production, this would use graphene-pk11 or similar library
   */
  async connect() {
    try {
      // Simulate HSM connection initialization
      console.log(`Connecting to HSM at ${HSM_CONFIG.host}:${HSM_CONFIG.port}`);
      console.log(`Using PKCS#11 module: ${HSM_CONFIG.pkcs11Module}`);
      console.log(`Slot: ${HSM_CONFIG.slot}, Label: ${HSM_CONFIG.label}`);

      // In production:
      // const pkcs11 = require('graphene-pk11');
      // const Module = pkcs11.Module;
      // const mod = Module.load(HSM_CONFIG.pkcs11Module);
      // mod.initialize();
      // const slot = mod.getSlots(HSM_CONFIG.slot);
      // this.session = slot.open(SessionFlag.RW_SESSION | SessionFlag.SERIAL_SESSION);
      // this.session.login(HSM_CONFIG.pin);

      this.connected = true;
      this.lastHeartbeat = Date.now();

      return {
        connected: true,
        slot: this.slot,
        label: HSM_CONFIG.label,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('HSM connection error:', error);
      this.connected = false;
      throw error;
    }
  }

  /**
   * Disconnect from HSM
   */
  async disconnect() {
    try {
      // In production:
      // this.session?.logout();
      // this.session?.close();

      this.connected = false;
      this.session = null;

      return { disconnected: true };
    } catch (error) {
      console.error('HSM disconnect error:', error);
      throw error;
    }
  }

  /**
   * Check HSM health
   */
  async healthCheck() {
    try {
      // Simulate health check
      const isHealthy = this.connected || await this.connect().then(() => true).catch(() => false);

      return {
        healthy: isHealthy,
        host: HSM_CONFIG.host,
        slot: HSM_CONFIG.slot,
        label: HSM_CONFIG.label,
        lastHeartbeat: this.lastHeartbeat,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        healthy: false,
        error: 'HSM health check failed',
      };
    }
  }
}

/**
 * HSM Signer
 * Performs cryptographic signing operations using HSM
 */
export class HSMSigner {
  constructor() {
    this.connection = new HSMConnection();
  }

  /**
   * Ensure HSM is connected
   */
  async ensureConnected() {
    if (!this.connection.connected) {
      await this.connection.connect();
    }
  }

  /**
   * Sign data using HSM private key
   */
  async sign(data, options = {}) {
    await this.ensureConnected();

    const {
      keyLabel = HSM_CONFIG.label,
      algorithm = SIGNATURE_ALGORITHMS.RSA_SHA256,
      hashAlgorithm = 'SHA-256',
    } = options;

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

      // In production, this would use PKCS#11 to sign with HSM key:
      // const signature = this.session.createSign(mechanism, key).once(hash);

      // Real PKCS#11 signing via p11tool2-remote (no simulation)
      const signResult = await signWithHSM(hash, keyLabel, algorithm);

      if (!signResult.success) {
        throw new Error(`HSM signing failed: ${signResult.error}. Ensure HSM is accessible and key '${keyLabel}' exists in slot ${HSM_CONFIG.slot}`);
      }

      const signature = Buffer.from(signResult.signature, 'base64');

      return {
        signature: signature.toString('base64'),
        signatureHex: signature.toString('hex'),
        algorithm,
        hashAlgorithm,
        keyLabel,
        slot: HSM_CONFIG.slot,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('HSM signing error:', error);
      throw new Error(`HSM signing failed: ${error.message}`);
    }
  }

  /**
   * Sign with specific key by handle
   */
  async signWithKey(data, keyHandle, algorithm = SIGNATURE_ALGORITHMS.RSA_SHA256) {
    await this.ensureConnected();

    try {
      const dataBuffer = Buffer.isBuffer(data)
        ? data
        : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));

      // In production:
      // const key = this.session.getObject(keyHandle);
      // const mechanism = this.getMechanism(algorithm);
      // const signature = this.session.createSign(mechanism, key).once(dataBuffer);

      // Simulated signature
      const signature = crypto
        .createHmac('sha256', `hsm-key:${keyHandle}`)
        .update(dataBuffer)
        .digest();

      return {
        signature: signature.toString('base64'),
        algorithm,
        keyHandle,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`HSM signing with key failed: ${error.message}`);
    }
  }

  /**
   * Verify signature using HSM
   */
  async verify(data, signature, publicKey, algorithm = SIGNATURE_ALGORITHMS.RSA_SHA256) {
    await this.ensureConnected();

    try {
      const dataBuffer = Buffer.isBuffer(data)
        ? data
        : Buffer.from(typeof data === 'string' ? data : JSON.stringify(data));

      const signatureBuffer = Buffer.from(signature, 'base64');

      // In production, use HSM to verify:
      // const verified = this.session.createVerify(mechanism, pubKey).once(dataBuffer, signatureBuffer);

      // For demo, always return true for valid format
      return {
        verified: signatureBuffer.length > 0,
        algorithm,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        verified: false,
        error: error.message,
      };
    }
  }
}

/**
 * Certificate Manager
 * Manages certificates stored in HSM
 */
export class CertificateManager {
  constructor() {
    this.connection = new HSMConnection();
  }

  /**
   * Get CA certificate from HSM
   */
  async getCACertificate() {
    try {
      // In production, retrieve from HSM:
      // const certObj = this.session.find({ class: ObjectClass.CERTIFICATE, label: 'pocketOne_CA' });
      // return certObj.getValue();

      // Generate demo CA certificate using node-forge
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();

      cert.publicKey = keys.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 10);

      const attrs = [
        { name: 'commonName', value: 'pocketOne CA' },
        { name: 'countryName', value: 'ZA' },
        { name: 'organizationName', value: 'pocketOne (Pty) Ltd' },
        { shortName: 'OU', value: 'Digital Identity Services' },
      ];

      cert.setSubject(attrs);
      cert.setIssuer(attrs);

      cert.setExtensions([
        { name: 'basicConstraints', cA: true, critical: true },
        { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
        {
          name: 'subjectKeyIdentifier',
        },
      ]);

      cert.sign(keys.privateKey, forge.md.sha256.create());

      return {
        certificate: forge.pki.certificateToPem(cert),
        subject: 'CN=pocketOne CA, O=pocketOne (Pty) Ltd, C=ZA',
        issuer: 'CN=pocketOne CA, O=pocketOne (Pty) Ltd, C=ZA',
        serialNumber: cert.serialNumber,
        validFrom: cert.validity.notBefore.toISOString(),
        validTo: cert.validity.notAfter.toISOString(),
        isCa: true,
      };
    } catch (error) {
      throw new Error(`Failed to get CA certificate: ${error.message}`);
    }
  }

  /**
   * Get certificate chain
   */
  async getCertificateChain() {
    try {
      const caCert = await this.getCACertificate();

      return {
        chain: [caCert],
        root: caCert,
        intermediates: [],
      };
    } catch (error) {
      throw new Error(`Failed to get certificate chain: ${error.message}`);
    }
  }

  /**
   * Issue a new certificate signed by CA
   */
  async issueCertificate(subjectInfo, publicKey, options = {}) {
    try {
      const {
        validityDays = 365,
        keyUsage = ['digitalSignature', 'keyEncipherment'],
        extKeyUsage = [],
        isQES = false,
      } = options;

      // Generate certificate using node-forge
      const keys = forge.pki.rsa.generateKeyPair(2048);
      const cert = forge.pki.createCertificate();

      // Parse public key if provided
      if (publicKey) {
        try {
          cert.publicKey = forge.pki.publicKeyFromPem(publicKey);
        } catch {
          cert.publicKey = keys.publicKey;
        }
      } else {
        cert.publicKey = keys.publicKey;
      }

      cert.serialNumber = crypto.randomBytes(16).toString('hex');
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + validityDays);

      const subjectAttrs = [
        { name: 'commonName', value: subjectInfo.commonName || 'myID User' },
        { name: 'countryName', value: subjectInfo.country || 'ZA' },
      ];

      if (subjectInfo.organization) {
        subjectAttrs.push({ name: 'organizationName', value: subjectInfo.organization });
      }

      if (subjectInfo.email) {
        subjectAttrs.push({ name: 'emailAddress', value: subjectInfo.email });
      }

      cert.setSubject(subjectAttrs);

      // Set issuer (CA)
      cert.setIssuer([
        { name: 'commonName', value: 'pocketOne CA' },
        { name: 'countryName', value: 'ZA' },
        { name: 'organizationName', value: 'pocketOne (Pty) Ltd' },
      ]);

      // Extensions
      const extensions = [
        { name: 'basicConstraints', cA: false },
        {
          name: 'keyUsage',
          digitalSignature: keyUsage.includes('digitalSignature'),
          keyEncipherment: keyUsage.includes('keyEncipherment'),
          nonRepudiation: keyUsage.includes('nonRepudiation') || isQES,
        },
        { name: 'subjectKeyIdentifier' },
      ];

      // Add extended key usage
      if (extKeyUsage.length > 0 || isQES) {
        const eku = {
          name: 'extKeyUsage',
        };
        if (extKeyUsage.includes('clientAuth') || isQES) {
          eku.clientAuth = true;
        }
        if (extKeyUsage.includes('emailProtection') || isQES) {
          eku.emailProtection = true;
        }
        if (extKeyUsage.includes('codeSigning')) {
          eku.codeSigning = true;
        }
        extensions.push(eku);
      }

      // QES-specific extensions
      if (isQES) {
        extensions.push({
          name: 'qcStatements',
          critical: false,
          value: 'QES-compliant certificate',
        });
      }

      cert.setExtensions(extensions);

      // Sign with CA key (simulated)
      cert.sign(keys.privateKey, forge.md.sha256.create());

      return {
        certificate: forge.pki.certificateToPem(cert),
        serialNumber: cert.serialNumber,
        subject: subjectAttrs.map((a) => `${a.name}=${a.value}`).join(', '),
        issuer: 'CN=pocketOne CA, O=pocketOne (Pty) Ltd, C=ZA',
        validFrom: cert.validity.notBefore.toISOString(),
        validTo: cert.validity.notAfter.toISOString(),
        isQES,
        keyUsage,
      };
    } catch (error) {
      throw new Error(`Certificate issuance failed: ${error.message}`);
    }
  }

  /**
   * Revoke a certificate
   */
  async revokeCertificate(serialNumber, reason = 'unspecified') {
    try {
      // In production, add to CRL or OCSP responder
      return {
        serialNumber,
        revoked: true,
        reason,
        revokedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`Certificate revocation failed: ${error.message}`);
    }
  }

  /**
   * Check certificate status (OCSP simulation)
   */
  async checkCertificateStatus(serialNumber) {
    try {
      // In production, check against CRL or OCSP
      return {
        serialNumber,
        status: 'good',
        checkedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        serialNumber,
        status: 'unknown',
        error: error.message,
      };
    }
  }
}

/**
 * QES (Qualified Electronic Signature) Manager
 * Handles eIDAS-compliant qualified signatures
 */
export class QESManager {
  constructor() {
    this.signer = new HSMSigner();
    this.certManager = new CertificateManager();
  }

  /**
   * Create a QES signature
   */
  async createQES(documentHash, certificateId, userId, options = {}) {
    try {
      const {
        format = QES_FORMATS.CAdES_B,
        signingTime = new Date(),
        commitmentType = 'proofOfApproval',
      } = options;

      // Ensure document hash is valid
      if (!documentHash || documentHash.length < 32) {
        throw new Error('Invalid document hash');
      }

      // Sign with HSM
      const signatureResult = await this.signer.sign(documentHash, {
        algorithm: SIGNATURE_ALGORITHMS.RSA_SHA256,
      });

      // Create QES structure
      const qes = {
        version: '1.0',
        signatureId: crypto.randomUUID(),
        format,
        signingTime: signingTime.toISOString(),
        signedInfo: {
          documentHash,
          hashAlgorithm: 'SHA-256',
          signatureAlgorithm: SIGNATURE_ALGORITHMS.RSA_SHA256,
        },
        signatureValue: signatureResult.signature,
        signerInfo: {
          certificateId,
          userId,
          commitmentType,
        },
        compliance: {
          eIDAS: true,
          level: 'QES',
          country: 'ZA',
        },
        timestamp: {
          time: signingTime.toISOString(),
          accuracy: '1s',
          source: 'HSM',
        },
      };

      return qes;
    } catch (error) {
      throw new Error(`QES creation failed: ${error.message}`);
    }
  }

  /**
   * Verify a QES signature
   */
  async verifyQES(qes, documentHash) {
    try {
      const errors = [];

      // Verify document hash matches
      if (qes.signedInfo.documentHash !== documentHash) {
        errors.push('Document hash mismatch');
      }

      // Verify signature format
      if (!Object.values(QES_FORMATS).includes(qes.format)) {
        errors.push('Invalid signature format');
      }

      // Verify timestamp
      const signingTime = new Date(qes.signingTime);
      if (isNaN(signingTime.getTime())) {
        errors.push('Invalid signing time');
      }

      // Verify signature (using HSM)
      const verifyResult = await this.signer.verify(
        documentHash,
        qes.signatureValue,
        null, // Would use certificate public key
        qes.signedInfo.signatureAlgorithm,
      );

      if (!verifyResult.verified) {
        errors.push('Signature verification failed');
      }

      return {
        verified: errors.length === 0,
        errors,
        signatureId: qes.signatureId,
        format: qes.format,
        signingTime: qes.signingTime,
        compliance: qes.compliance,
      };
    } catch (error) {
      return {
        verified: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Request a QES certificate
   */
  async requestQESCertificate(userId, identityData) {
    try {
      // Verify identity before issuing QES certificate
      if (!identityData.verified) {
        throw new Error('Identity must be verified before QES certificate issuance');
      }

      // Issue QES-compliant certificate
      const cert = await this.certManager.issueCertificate(
        {
          commonName: `${identityData.firstName} ${identityData.lastName}`,
          country: identityData.country || 'ZA',
          email: identityData.email,
        },
        null, // Will generate key pair
        {
          validityDays: 365 * 2, // 2 years
          keyUsage: ['digitalSignature', 'nonRepudiation'],
          extKeyUsage: ['clientAuth', 'emailProtection'],
          isQES: true,
        },
      );

      return {
        certificateId: crypto.randomUUID(),
        certificate: cert.certificate,
        serialNumber: cert.serialNumber,
        subject: cert.subject,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        isQES: true,
        userId,
        requestedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(`QES certificate request failed: ${error.message}`);
    }
  }

  /**
   * Get user's QES certificate
   */
  async getUserCertificate(userId, certificateId) {
    try {
      // In production, retrieve from certificate store
      return {
        certificateId,
        userId,
        status: 'active',
        isQES: true,
        // Would include actual certificate data
      };
    } catch (error) {
      throw new Error(`Failed to get user certificate: ${error.message}`);
    }
  }
}

// Create singleton instances
export const hsmConnection = new HSMConnection();
export const hsmSigner = new HSMSigner();
export const certificateManager = new CertificateManager();
export const qesManager = new QESManager();

export default {
  HSM_CONFIG,
  SIGNATURE_ALGORITHMS,
  KEY_TYPES,
  QES_FORMATS,
  HSMConnection,
  HSMSigner,
  CertificateManager,
  QESManager,
  hsmConnection,
  hsmSigner,
  certificateManager,
  qesManager,
};
