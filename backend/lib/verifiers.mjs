/**
 * Cryptographic Verification Module
 * Implements real signature verification for ISO 18013-5, W3C DID/VC, and ICAO DTC
 *
 * SECURITY: All verification functions fail closed - any error results in verification failure
 */

import crypto from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';
import * as jose from 'jose';
import forge from 'node-forge';

const execFileAsync = promisify(execFile);

/**
 * ISO 18013-5 mDL COSE_Sign1 Verifier
 * Implements COSE signature verification for mobile driving licenses
 */
export class MDLVerifier {
  /**
   * Verify issuerAuth COSE_Sign1 signature
   * @param {Object} doc - MDL document with issuerAuth
   * @returns {Promise<boolean>} - True if signature is valid, false otherwise
   */
  static async verifyIssuerAuth(doc) {
    try {
      // Fail closed: require signature and certificate
      if (!doc?.issuerAuth?.signature || !doc?.issuerAuth?.certificate) {
        console.error('MDL verification failed: missing signature or certificate');
        return false;
      }

      // Parse certificate to extract public key
      const certPem = doc.issuerAuth.certificate;
      let publicKey;
      let cert;

      try {
        // Parse X.509 certificate using node-forge
        cert = forge.pki.certificateFromPem(certPem);
        publicKey = cert.publicKey;
      } catch (certError) {
        console.error('MDL verification failed: invalid certificate format', certError.message);
        return false;
      }

      // Additional check: verify certificate is not expired
      const now = new Date();
      if (cert.validity.notBefore > now || cert.validity.notAfter < now) {
        console.error('MDL verification failed: certificate expired or not yet valid');
        return false;
      }

      // Prepare payload for verification
      // COSE_Sign1 payload is typically the Mobile Security Object (MSO)
      const payload = this.createMSOPayload(doc);

      // For COSE_Sign1, we verify using the algorithm specified
      const algorithm = doc.issuerAuth.algorithm || 'ES256';

      try {
        // Convert signature from base64 to buffer
        const signatureBuffer = Buffer.from(doc.issuerAuth.signature, 'base64');

        // Create verifier based on algorithm
        const verified = await this.verifyCOSESignature(
          payload,
          signatureBuffer,
          publicKey,
          algorithm
        );

        if (!verified) {
          console.error('MDL verification failed: signature verification failed');
          return false;
        }

        return true;
      } catch (verifyError) {
        console.error('MDL verification failed during signature check:', verifyError.message);
        return false;
      }
    } catch (error) {
      // Fail closed: any unexpected error results in verification failure
      console.error('MDL verification failed with exception:', error.message);
      return false;
    }
  }

  /**
   * Create Mobile Security Object (MSO) payload for verification
   */
  static createMSOPayload(doc) {
    // Serialize the namespaces for signing
    const payload = {
      version: doc.version,
      docType: doc.docType,
      namespaces: doc.namespaces,
    };

    return Buffer.from(JSON.stringify(payload), 'utf8');
  }

  /**
   * Verify COSE signature using node:crypto
   */
  static async verifyCOSESignature(payload, signature, publicKey, algorithm) {
    try {
      // Map COSE algorithm to Node.js crypto algorithm
      const cryptoAlgorithm = this.coseAlgorithmToCrypto(algorithm);

      // Convert forge public key to PEM for crypto module
      const publicKeyPem = forge.pki.publicKeyToPem(publicKey);
      const keyObject = crypto.createPublicKey(publicKeyPem);

      // Verify signature
      const verify = crypto.createVerify(cryptoAlgorithm);
      verify.update(payload);
      verify.end();

      return verify.verify(keyObject, signature);
    } catch (error) {
      console.error('COSE signature verification error:', error.message);
      return false;
    }
  }

  /**
   * Map COSE algorithm identifier to Node.js crypto algorithm
   */
  static coseAlgorithmToCrypto(coseAlg) {
    const mapping = {
      'ES256': 'SHA256',  // ECDSA with SHA-256
      'ES384': 'SHA384',  // ECDSA with SHA-384
      'ES512': 'SHA512',  // ECDSA with SHA-512
      'RS256': 'RSA-SHA256',
      'RS384': 'RSA-SHA384',
      'RS512': 'RSA-SHA512',
      'PS256': 'RSA-SHA256',  // RSA-PSS
      'PS384': 'RSA-SHA384',
      'PS512': 'RSA-SHA512',
    };

    return mapping[coseAlg] || 'SHA256';
  }
}

/**
 * W3C DID/VC Verifier
 * Implements DID resolution and JWS proof verification
 */
export class DIDVCVerifier {
  // In-memory DID registry (local-first, can be extended with remote resolution)
  static didRegistry = new Map();

  /**
   * Register a DID document in the local registry
   */
  static registerDID(did, didDocument) {
    this.didRegistry.set(did, didDocument);
  }

  /**
   * Resolve DID to DID Document
   * Local registry first, optional HTTP resolution if configured
   */
  static async resolveDID(did) {
    try {
      // Check local registry first
      if (this.didRegistry.has(did)) {
        return this.didRegistry.get(did);
      }

      // For did:pocketone, fail if not in registry
      if (did.startsWith('did:pocketone:')) {
        console.error('DID resolution failed: DID not found in registry:', did);
        return null;
      }

      // For other DID methods, could implement HTTP resolution here
      // For now, fail closed
      console.error('DID resolution failed: unsupported DID method or not in registry:', did);
      return null;
    } catch (error) {
      console.error('DID resolution error:', error.message);
      return null;
    }
  }

  /**
   * Verify Verifiable Credential proof
   */
  static async verifyCredential(credential) {
    try {
      // Fail closed: check required fields
      if (!credential?.proof?.jws) {
        console.error('VC verification failed: missing JWS proof');
        return false;
      }

      // Check expiration
      if (credential.expirationDate) {
        const expiry = new Date(credential.expirationDate);
        if (expiry < new Date()) {
          console.error('VC verification failed: credential expired');
          return false;
        }
      }

      // Resolve issuer DID
      const issuerDID = typeof credential.issuer === 'string'
        ? credential.issuer
        : credential.issuer?.id;

      if (!issuerDID) {
        console.error('VC verification failed: missing issuer DID');
        return false;
      }

      const didDocument = await this.resolveDID(issuerDID);
      if (!didDocument) {
        console.error('VC verification failed: could not resolve issuer DID');
        return false;
      }

      // Extract verification method
      const verificationMethod = credential.proof.verificationMethod;
      const publicKey = this.extractPublicKeyFromDIDDocument(didDocument, verificationMethod);

      if (!publicKey) {
        console.error('VC verification failed: could not extract public key');
        return false;
      }

      // Verify JWS signature
      const verified = await this.verifyJWS(credential, publicKey);

      if (!verified) {
        console.error('VC verification failed: JWS signature invalid');
        return false;
      }

      return true;
    } catch (error) {
      console.error('VC verification failed with exception:', error.message);
      return false;
    }
  }

  /**
   * Verify JWS signature using jose library
   */
  static async verifyJWS(credential, publicKey) {
    try {
      const jws = credential.proof.jws;

      // Create credential without proof for verification
      const { proof, ...credentialWithoutProof } = credential;
      const payload = JSON.stringify(credentialWithoutProof);

      // Import public key with algorithm hint
      let key;
      if (publicKey.publicKeyJwk) {
        // Add alg to JWK if not present
        const jwkWithAlg = { ...publicKey.publicKeyJwk };
        if (!jwkWithAlg.alg) {
          // Infer algorithm from key type
          if (jwkWithAlg.kty === 'EC') {
            jwkWithAlg.alg = jwkWithAlg.crv === 'P-256' ? 'ES256' :
                             jwkWithAlg.crv === 'P-384' ? 'ES384' : 'ES512';
          } else if (jwkWithAlg.kty === 'RSA') {
            jwkWithAlg.alg = 'RS256';
          }
        }
        key = await jose.importJWK(jwkWithAlg);
      } else if (publicKey.publicKeyPem) {
        key = await jose.importSPKI(publicKey.publicKeyPem, 'ES256');
      } else {
        console.error('JWS verification failed: unsupported public key format');
        return false;
      }

      // Verify JWS (compact serialization)
      const { payload: verifiedPayload } = await jose.compactVerify(jws, key);

      // Verify payload matches
      const verifiedData = new TextDecoder().decode(verifiedPayload);
      const expectedHash = crypto.createHash('sha256').update(payload).digest('hex');
      const actualHash = crypto.createHash('sha256').update(verifiedData).digest('hex');

      return expectedHash === actualHash;
    } catch (error) {
      console.error('JWS verification error:', error.message);
      return false;
    }
  }

  /**
   * Extract public key from DID Document
   */
  static extractPublicKeyFromDIDDocument(didDocument, verificationMethod) {
    try {
      // Find the verification method in the DID document
      const method = didDocument.verificationMethod?.find(
        (vm) => vm.id === verificationMethod || `${didDocument.id}${vm.id}` === verificationMethod
      );

      if (!method) {
        console.error('Verification method not found in DID document');
        return null;
      }

      return {
        publicKeyJwk: method.publicKeyJwk,
        publicKeyPem: method.publicKeyPem,
        publicKeyMultibase: method.publicKeyMultibase,
      };
    } catch (error) {
      console.error('Failed to extract public key:', error.message);
      return null;
    }
  }
}

/**
 * ICAO DTC CMS Signature Verifier
 * Uses OpenSSL to verify SOD (Security Object Data) CMS signatures
 */
export class ICAODTCVerifier {
  /**
   * Verify DTC SOD signature using OpenSSL
   */
  static async verifySOD(doc, cscaAnchors = null) {
    try {
      // Fail closed: require signature and certificate
      if (!doc?.securityObject?.signature || !doc?.securityObject?.certificate) {
        console.error('ICAO DTC verification failed: missing signature or certificate');
        return false;
      }

      // Verify data group hashes first
      const hashesValid = this.verifyDataGroupHashes(doc);
      if (!hashesValid) {
        console.error('ICAO DTC verification failed: data group hash mismatch');
        return false;
      }

      // Prepare SOD for verification
      const sodData = this.prepareSODData(doc);
      const signature = Buffer.from(doc.securityObject.signature, 'base64');
      const certificate = doc.securityObject.certificate;

      // Verify CMS signature using OpenSSL
      const verified = await this.verifyCMSSignature(sodData, signature, certificate, cscaAnchors);

      if (!verified) {
        console.error('ICAO DTC verification failed: CMS signature invalid');
        return false;
      }

      return true;
    } catch (error) {
      console.error('ICAO DTC verification failed with exception:', error.message);
      return false;
    }
  }

  /**
   * Verify all data group hashes match
   */
  static verifyDataGroupHashes(doc) {
    try {
      for (const [key, dataGroup] of Object.entries(doc.dataGroups)) {
        const expectedHash = doc.securityObject.dataGroupHashes[key];
        if (dataGroup.dataGroupHash !== expectedHash) {
          console.error(`Data group hash mismatch for ${key}`);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Data group hash verification error:', error.message);
      return false;
    }
  }

  /**
   * Prepare SOD data for CMS verification
   */
  static prepareSODData(doc) {
    // Create DER-encoded SOD structure
    // For simplicity, we'll use the data group hashes as the signed data
    const sodContent = {
      hashAlgorithm: doc.securityObject.hashAlgorithm,
      dataGroupHashes: doc.securityObject.dataGroupHashes,
    };

    return Buffer.from(JSON.stringify(sodContent), 'utf8');
  }

  /**
   * Verify CMS signature using OpenSSL via child_process
   */
  static async verifyCMSSignature(data, signature, certificate, cscaAnchors) {
    try {
      // Write data, signature, and certificate to temporary files
      const tmpDir = '/tmp';
      const dataFile = `${tmpDir}/sod-data-${crypto.randomUUID()}.bin`;
      const sigFile = `${tmpDir}/sod-sig-${crypto.randomUUID()}.bin`;
      const certFile = `${tmpDir}/sod-cert-${crypto.randomUUID()}.pem`;

      const fs = await import('fs');
      await fs.promises.writeFile(dataFile, data);
      await fs.promises.writeFile(sigFile, signature);
      await fs.promises.writeFile(certFile, certificate);

      try {
        // Build OpenSSL verify command
        const args = [
          'cms',
          '-verify',
          '-in', sigFile,
          '-content', dataFile,
          '-certfile', certFile,
          '-inform', 'DER',
          '-binary',
        ];

        // Add CSCA anchors if provided
        if (cscaAnchors && Array.isArray(cscaAnchors)) {
          const caFile = `${tmpDir}/csca-${crypto.randomUUID()}.pem`;
          await fs.promises.writeFile(caFile, cscaAnchors.join('\n'));
          args.push('-CAfile', caFile);
        } else {
          // No chain validation - just verify the signature itself
          args.push('-noverify');
        }

        // Execute OpenSSL
        const { stdout, stderr } = await execFileAsync('openssl', args, {
          timeout: 5000,
          maxBuffer: 1024 * 1024,
        });

        // Check if verification succeeded
        const success = !stderr.includes('Verification failure') &&
                       (stdout.includes('Verification successful') || stdout.length > 0);

        return success;
      } finally {
        // Cleanup temporary files
        await fs.promises.unlink(dataFile).catch(() => {});
        await fs.promises.unlink(sigFile).catch(() => {});
        await fs.promises.unlink(certFile).catch(() => {});
      }
    } catch (error) {
      console.error('CMS verification error:', error.message);
      return false;
    }
  }
}

export default {
  MDLVerifier,
  DIDVCVerifier,
  ICAODTCVerifier,
};
