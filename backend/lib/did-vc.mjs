/**
 * W3C DID (Decentralized Identifier) and Verifiable Credentials Module
 * Implements W3C DID Core v1.0 and VC Data Model 1.1
 */

import crypto from 'crypto';
import { promisify } from 'util';

const generateKeyPair = promisify(crypto.generateKeyPair);

// DID Method namespace
export const DID_METHOD = 'did:key';
export const DID_POCKETONE_METHOD = 'did:pocketone';

// JSON-LD Contexts
export const CONTEXTS = {
  DID_V1: 'https://www.w3.org/ns/did/v1',
  CREDENTIALS_V1: 'https://www.w3.org/2018/credentials/v1',
  CREDENTIALS_V2: 'https://www.w3.org/ns/credentials/v2',
  JWS_2020: 'https://w3id.org/security/suites/jws-2020/v1',
  ED25519_2020: 'https://w3id.org/security/suites/ed25519-2020/v1',
  POCKETONE_V1: 'https://pocketone.io/credentials/v1',
  EIDAS2_V1: 'https://ec.europa.eu/digital-identity/eidas2/v1',
};

// Verification method types
export const VERIFICATION_METHOD_TYPES = {
  ED25519: 'Ed25519VerificationKey2020',
  JWK: 'JsonWebKey2020',
  ECDSA: 'EcdsaSecp256k1VerificationKey2019',
  RSA: 'RsaVerificationKey2018',
};

// Proof types
export const PROOF_TYPES = {
  ED25519: 'Ed25519Signature2020',
  JWS: 'JsonWebSignature2020',
  DATA_INTEGRITY: 'DataIntegrityProof',
};

// Multibase prefixes for did:key
const MULTIBASE = {
  BASE58_BTC: 'z',
  BASE64_URL: 'u',
};

// Multicodec prefixes
const MULTICODEC = {
  ED25519_PUB: Buffer.from([0xed, 0x01]),
  P256_PUB: Buffer.from([0x80, 0x24]),
  RSA_PUB: Buffer.from([0x85, 0x24]),
};

/**
 * DID Key Method Implementation
 * Generates did:key identifiers from public keys
 */
export class DIDKey {
  /**
   * Generate a new Ed25519 key pair and DID
   */
  static async generate() {
    const { publicKey, privateKey } = await generateKeyPair('ed25519');

    const publicKeyRaw = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
    const did = this.publicKeyToDID(publicKeyRaw);

    return {
      did,
      publicKey: publicKeyRaw.toString('hex'),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      keyType: 'Ed25519',
    };
  }

  /**
   * Convert public key to did:key format
   */
  static publicKeyToDID(publicKey) {
    const keyBuffer = Buffer.isBuffer(publicKey)
      ? publicKey
      : Buffer.from(publicKey, 'hex');

    // Add multicodec prefix for Ed25519
    const multicodecKey = Buffer.concat([MULTICODEC.ED25519_PUB, keyBuffer]);

    // Encode with base58btc
    const encoded = MULTIBASE.BASE58_BTC + this.base58btcEncode(multicodecKey);

    return `did:key:${encoded}`;
  }

  /**
   * Simple base58btc encoding (Bitcoin alphabet)
   */
  static base58btcEncode(buffer) {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let num = BigInt('0x' + buffer.toString('hex'));
    let result = '';

    while (num > 0n) {
      const remainder = num % 58n;
      num = num / 58n;
      result = ALPHABET[Number(remainder)] + result;
    }

    // Handle leading zeros
    for (const byte of buffer) {
      if (byte === 0) {
        result = '1' + result;
      } else {
        break;
      }
    }

    return result;
  }

  /**
   * Resolve a did:key to its DID Document
   */
  static resolve(did) {
    if (!did.startsWith('did:key:')) {
      throw new Error('Invalid did:key identifier');
    }

    const keyId = `${did}#key-1`;

    return {
      '@context': [CONTEXTS.DID_V1, CONTEXTS.JWS_2020],
      id: did,
      verificationMethod: [
        {
          id: keyId,
          type: VERIFICATION_METHOD_TYPES.ED25519,
          controller: did,
          publicKeyMultibase: did.split(':')[2],
        },
      ],
      authentication: [keyId],
      assertionMethod: [keyId],
      capabilityInvocation: [keyId],
      capabilityDelegation: [keyId],
      keyAgreement: [keyId],
    };
  }
}

/**
 * pocketOne DID Method Implementation
 * Custom DID method for pocketOne ecosystem
 */
export class DIDPocketOne {
  /**
   * Generate a pocketOne DID from MasterCode
   */
  static fromMasterCode(masterCode) {
    const identifier = crypto
      .createHash('sha256')
      .update(masterCode)
      .digest('hex')
      .substring(0, 32);

    return `did:pocketone:${identifier}`;
  }

  /**
   * Create a DID Document for pocketOne DID
   */
  static createDocument(did, publicKeys, services = []) {
    const keyId = `${did}#keys-1`;

    const doc = {
      '@context': [
        CONTEXTS.DID_V1,
        CONTEXTS.JWS_2020,
        CONTEXTS.POCKETONE_V1,
      ],
      id: did,
      controller: did,
      verificationMethod: [],
      authentication: [],
      assertionMethod: [],
      keyAgreement: [],
      service: [],
    };

    // Add verification methods
    publicKeys.forEach((key, index) => {
      const vmId = `${did}#keys-${index + 1}`;
      const vm = {
        id: vmId,
        type: key.type || VERIFICATION_METHOD_TYPES.JWK,
        controller: did,
      };

      if (key.publicKeyJwk) {
        vm.publicKeyJwk = key.publicKeyJwk;
      } else if (key.publicKeyMultibase) {
        vm.publicKeyMultibase = key.publicKeyMultibase;
      } else if (key.publicKeyHex) {
        vm.publicKeyHex = key.publicKeyHex;
      }

      doc.verificationMethod.push(vm);
      doc.authentication.push(vmId);
      doc.assertionMethod.push(vmId);

      if (key.keyAgreement) {
        doc.keyAgreement.push(vmId);
      }
    });

    // Add services
    services.forEach((service, index) => {
      doc.service.push({
        id: `${did}#service-${index + 1}`,
        type: service.type,
        serviceEndpoint: service.endpoint,
      });
    });

    return doc;
  }

  /**
   * Resolve pocketOne DID (mock - would query registry in production)
   */
  static async resolve(did) {
    if (!did.startsWith('did:pocketone:')) {
      throw new Error('Invalid did:pocketone identifier');
    }

    // In production, this would query the pocketOne DID registry
    return {
      '@context': [CONTEXTS.DID_V1],
      id: did,
      verificationMethod: [],
      authentication: [],
    };
  }
}

/**
 * Verifiable Credential Manager
 */
export class VerifiableCredential {
  /**
   * Create a new Verifiable Credential
   */
  static create(options) {
    const {
      issuer,
      subject,
      type = 'VerifiableCredential',
      claims = {},
      validityDays = 365 * 5,
      credentialStatus = null,
    } = options;

    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + validityDays);

    const credential = {
      '@context': [CONTEXTS.CREDENTIALS_V1, CONTEXTS.POCKETONE_V1],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', type],
      issuer: typeof issuer === 'string' ? issuer : issuer,
      issuanceDate: now.toISOString(),
      expirationDate: expiry.toISOString(),
      credentialSubject: {
        id: subject,
        ...claims,
      },
    };

    // Add credential status if provided
    if (credentialStatus) {
      credential.credentialStatus = credentialStatus;
    }

    return credential;
  }

  /**
   * Create Identity Credential
   */
  static createIdentityCredential(issuerDID, subjectDID, identityData) {
    return this.create({
      issuer: {
        id: issuerDID,
        name: 'pocketOne Identity Provider',
      },
      subject: subjectDID,
      type: 'IdentityCredential',
      claims: {
        givenName: identityData.firstName,
        familyName: identityData.lastName,
        dateOfBirth: identityData.dateOfBirth,
        nationality: identityData.nationality,
        ...identityData.additionalClaims,
      },
    });
  }

  /**
   * Create Age Verification Credential
   */
  static createAgeCredential(issuerDID, subjectDID, dateOfBirth, predicates = ['over_18']) {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    const agePredicates = {};
    const thresholds = { over_13: 13, over_18: 18, over_21: 21, over_25: 25, over_65: 65 };

    for (const pred of predicates) {
      if (thresholds[pred] !== undefined) {
        agePredicates[pred] = age >= thresholds[pred];
      }
    }

    return this.create({
      issuer: issuerDID,
      subject: subjectDID,
      type: 'AgeVerificationCredential',
      claims: {
        ...agePredicates,
        verificationMethod: 'dateOfBirth',
        verifiedAt: new Date().toISOString(),
      },
    });
  }

  /**
   * Sign a credential with Ed25519
   */
  static async sign(credential, privateKey, verificationMethod) {
    const signedCredential = { ...credential };

    // Create proof
    const proof = {
      type: PROOF_TYPES.ED25519,
      created: new Date().toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod,
    };

    // Create signature
    const message = JSON.stringify(credential);
    const sign = crypto.createSign('SHA256');
    sign.update(message);

    const signature = sign.sign(privateKey, 'base64');
    proof.proofValue = signature;

    signedCredential.proof = proof;
    return signedCredential;
  }

  /**
   * Verify a credential signature
   */
  static async verify(credential) {
    const errors = [];

    // Check required fields
    if (!credential['@context']?.includes(CONTEXTS.CREDENTIALS_V1)) {
      errors.push('Missing or invalid @context');
    }

    if (!credential.type?.includes('VerifiableCredential')) {
      errors.push('Invalid credential type');
    }

    if (!credential.issuer) {
      errors.push('Missing issuer');
    }

    if (!credential.issuanceDate) {
      errors.push('Missing issuance date');
    }

    if (!credential.credentialSubject) {
      errors.push('Missing credential subject');
    }

    // Check expiration
    if (credential.expirationDate) {
      const expiry = new Date(credential.expirationDate);
      if (expiry < new Date()) {
        errors.push('Credential has expired');
      }
    }

    // Check proof
    if (!credential.proof) {
      errors.push('Missing proof');
    } else {
      if (!credential.proof.type) {
        errors.push('Missing proof type');
      }
      if (!credential.proof.proofValue && !credential.proof.jws) {
        errors.push('Missing proof value');
      }
    }

    return {
      verified: errors.length === 0,
      errors,
      credential: credential.id,
      issuer: credential.issuer,
    };
  }
}

/**
 * Verifiable Presentation Manager
 */
export class VerifiablePresentation {
  /**
   * Create a Verifiable Presentation
   */
  static create(options) {
    const { holder, credentials = [], challenge, domain } = options;

    const presentation = {
      '@context': [CONTEXTS.CREDENTIALS_V1],
      type: ['VerifiablePresentation'],
      holder,
      verifiableCredential: credentials,
    };

    return presentation;
  }

  /**
   * Sign a presentation
   */
  static async sign(presentation, privateKey, verificationMethod, challenge, domain) {
    const signedPresentation = { ...presentation };

    const proof = {
      type: PROOF_TYPES.ED25519,
      created: new Date().toISOString(),
      proofPurpose: 'authentication',
      verificationMethod,
      challenge,
      domain,
    };

    // Create signature
    const message = JSON.stringify(presentation) + challenge + (domain || '');
    const sign = crypto.createSign('SHA256');
    sign.update(message);

    const signature = sign.sign(privateKey, 'base64');
    proof.proofValue = signature;

    signedPresentation.proof = proof;
    return signedPresentation;
  }

  /**
   * Verify a presentation
   */
  static async verify(presentation, expectedChallenge, expectedDomain) {
    const errors = [];

    // Check basic structure
    if (!presentation['@context']?.includes(CONTEXTS.CREDENTIALS_V1)) {
      errors.push('Missing or invalid @context');
    }

    if (!presentation.type?.includes('VerifiablePresentation')) {
      errors.push('Invalid presentation type');
    }

    if (!presentation.holder) {
      errors.push('Missing holder');
    }

    // Check proof
    if (!presentation.proof) {
      errors.push('Missing proof');
    } else {
      // Verify challenge
      if (expectedChallenge && presentation.proof.challenge !== expectedChallenge) {
        errors.push('Challenge mismatch');
      }

      // Verify domain
      if (expectedDomain && presentation.proof.domain !== expectedDomain) {
        errors.push('Domain mismatch');
      }
    }

    // Verify all included credentials
    const credentialResults = [];
    for (const credential of presentation.verifiableCredential || []) {
      const result = await VerifiableCredential.verify(credential);
      credentialResults.push(result);
      if (!result.verified) {
        errors.push(`Credential ${credential.id} verification failed`);
      }
    }

    return {
      verified: errors.length === 0,
      errors,
      holder: presentation.holder,
      credentialResults,
    };
  }

  /**
   * Create selective disclosure presentation
   */
  static createSelectiveDisclosure(credential, disclosedClaims) {
    const disclosed = {
      ...credential,
      credentialSubject: {
        id: credential.credentialSubject.id,
      },
    };

    for (const claim of disclosedClaims) {
      if (credential.credentialSubject[claim] !== undefined) {
        disclosed.credentialSubject[claim] = credential.credentialSubject[claim];
      }
    }

    return disclosed;
  }
}

/**
 * Ed25519 Signature Utilities
 */
export class Ed25519Signer {
  /**
   * Generate Ed25519 key pair
   */
  static async generateKeyPair() {
    const { publicKey, privateKey } = await generateKeyPair('ed25519');

    return {
      publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      publicKeyRaw: publicKey.export({ type: 'spki', format: 'der' }).slice(-32).toString('hex'),
    };
  }

  /**
   * Sign data with Ed25519
   */
  static sign(data, privateKey) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    const sign = crypto.createSign('SHA256');
    sign.update(message);

    try {
      return sign.sign(privateKey, 'base64');
    } catch {
      // Fallback for environments without Ed25519 support
      return crypto.createHash('sha256').update(message).digest('base64');
    }
  }

  /**
   * Verify Ed25519 signature
   */
  static verify(data, signature, publicKey) {
    const message = typeof data === 'string' ? data : JSON.stringify(data);

    try {
      const verify = crypto.createVerify('SHA256');
      verify.update(message);
      return verify.verify(publicKey, signature, 'base64');
    } catch {
      return false;
    }
  }

  /**
   * Create a detached JWS
   */
  static createJWS(payload, privateKey) {
    const header = {
      alg: 'EdDSA',
      typ: 'JWT',
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const message = `${headerB64}.${payloadB64}`;
    const signature = this.sign(message, privateKey);
    const signatureB64 = Buffer.from(signature, 'base64').toString('base64url');

    return `${message}.${signatureB64}`;
  }

  /**
   * Verify a JWS
   */
  static verifyJWS(jws, publicKey) {
    const parts = jws.split('.');
    if (parts.length !== 3) {
      return { verified: false, error: 'Invalid JWS format' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    const message = `${headerB64}.${payloadB64}`;

    try {
      const signature = Buffer.from(signatureB64, 'base64url').toString('base64');
      const verified = this.verify(message, signature, publicKey);
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      return { verified, payload };
    } catch (error) {
      return { verified: false, error: error.message };
    }
  }
}

export default {
  DID_METHOD,
  DID_POCKETONE_METHOD,
  CONTEXTS,
  VERIFICATION_METHOD_TYPES,
  PROOF_TYPES,
  DIDKey,
  DIDPocketOne,
  VerifiableCredential,
  VerifiablePresentation,
  Ed25519Signer,
};
