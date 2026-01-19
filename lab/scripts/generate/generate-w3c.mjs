/**
 * W3C DID/VC Generator
 * Generates DID Documents (did:key, did:web) and Verifiable Credentials (JWT-VC)
 */

import crypto from 'crypto';
import { SignJWT, importPKCS8 } from 'jose';
import { DIDKey } from '../../../backend/lib/did-vc.mjs';

const POLICY = {
  issuer: 'https://iss.trustvault.eu',
  slot: '0005',
  didWebDomain: 'iss.trustvault.eu',
};

/**
 * Generate DID Documents and Verifiable Credential
 * @param {object} options - Generation options
 * @returns {object} Generated DID/VC payload
 */
export async function generateW3CCredential(options = {}) {
  const {
    trustCode = 'TC-TEST-W3C-001',
    masterCode = 'MC-MASTER-W3C-001',
    didMethod = 'did:key', // 'did:key' or 'did:web'
    credentialType = 'UniversityDegreeCredential',
  } = options;

  try {
    // Generate DID Documents
    const didKey = await generateDIDKey();
    const didWeb = generateDIDWeb();

    // Select DID based on method
    const issuerDID = didMethod === 'did:web' ? didWeb.id : didKey.id;
    const subjectDID = didKey.id; // Subject is always did:key for testing

    // Generate Verifiable Credential
    const credential = await generateVerifiableCredential({
      issuerDID,
      subjectDID,
      trustCode,
      masterCode,
      credentialType,
    });

    return {
      success: true,
      family: 'W3C DID/VC',
      type: 'Verifiable Credential',
      data: {
        didDocuments: {
          didKey: didKey.document,
          didWeb: didWeb.document,
        },
        credential,
        credentialJWT: credential.jwt,
      },
      claims: {
        tc: trustCode,
        mc: masterCode,
        issuer: issuerDID,
        subject: subjectDID,
        credentialType,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        slot: POLICY.slot,
        didMethod,
        proofType: 'JwtProof2020',
      },
    };
  } catch (error) {
    return {
      success: false,
      family: 'W3C DID/VC',
      type: 'Verifiable Credential',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Generate a did:key DID Document
 */
async function generateDIDKey() {
  try {
    // Use the existing DIDKey class from backend
    const didKeyData = await DIDKey.generate();

    const document = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: didKeyData.did,
      verificationMethod: [
        {
          id: `${didKeyData.did}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: didKeyData.did,
          publicKeyHex: didKeyData.publicKey,
        },
      ],
      authentication: [`${didKeyData.did}#key-1`],
      assertionMethod: [`${didKeyData.did}#key-1`],
      keyAgreement: [`${didKeyData.did}#key-1`],
    };

    return {
      id: didKeyData.did,
      document,
      method: 'did:key',
    };
  } catch (error) {
    console.error('DIDKey generation error:', error);
    // Fallback: generate synthetic did:key
    const keyPair = crypto.generateKeyPairSync('ed25519');
    const publicKeyBytes = keyPair.publicKey.export({ type: 'spki', format: 'der' });
    const publicKeyMultibase = 'z' + Buffer.from(publicKeyBytes.slice(-32)).toString('base64url');
    const did = `did:key:${publicKeyMultibase}`;

    const document = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/ed25519-2020/v1',
      ],
      id: did,
      verificationMethod: [
        {
          id: `${did}#${publicKeyMultibase}`,
          type: 'Ed25519VerificationKey2020',
          controller: did,
          publicKeyMultibase,
        },
      ],
      authentication: [`${did}#${publicKeyMultibase}`],
      assertionMethod: [`${did}#${publicKeyMultibase}`],
      keyAgreement: [`${did}#${publicKeyMultibase}`],
    };

    return {
      id: did,
      document,
      method: 'did:key',
    };
  }
}

/**
 * Generate a did:web DID Document
 */
function generateDIDWeb() {
  const username = 'alice';
  const did = `did:web:${POLICY.didWebDomain}:users:${username}`;

  const document = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/suites/jws-2020/v1',
    ],
    id: did,
    verificationMethod: [
      {
        id: `${did}#key-1`,
        type: 'JsonWebKey2020',
        controller: did,
        publicKeyJwk: {
          kty: 'EC',
          crv: 'P-256',
          x: crypto.randomBytes(32).toString('base64url'),
          y: crypto.randomBytes(32).toString('base64url'),
        },
      },
    ],
    authentication: [`${did}#key-1`],
    assertionMethod: [`${did}#key-1`],
    service: [
      {
        id: `${did}#profile`,
        type: 'ProfileService',
        serviceEndpoint: `https://${POLICY.didWebDomain}/users/${username}/profile`,
      },
    ],
  };

  return {
    id: did,
    document,
    method: 'did:web',
  };
}

/**
 * Generate a W3C Verifiable Credential (JWT-VC)
 */
async function generateVerifiableCredential(options) {
  const {
    issuerDID,
    subjectDID,
    trustCode,
    masterCode,
    credentialType,
  } = options;

  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 365 * 24 * 60 * 60; // 1 year

  // W3C VC Data Model 1.1 structure
  const credentialSubject = {
    id: subjectDID,
    degree: {
      type: 'BachelorDegree',
      name: 'Bachelor of Science in Computer Science',
      university: 'University of Cape Town',
    },
    // pocketOne extensions
    trustCode,
    masterCode,
  };

  const vc = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/2018/credentials/examples/v1',
    ],
    type: ['VerifiableCredential', credentialType],
    issuer: issuerDID,
    issuanceDate: new Date(now * 1000).toISOString(),
    expirationDate: new Date((now + expiresIn) * 1000).toISOString(),
    credentialSubject,
  };

  // Create JWT payload following VC-JWT spec
  const jwtPayload = {
    iss: issuerDID,
    sub: subjectDID,
    iat: now,
    exp: now + expiresIn,
    jti: `urn:uuid:${crypto.randomUUID()}`,
    nbf: now,
    vc,
    // pocketOne claims at top level
    tc: trustCode,
    mc: masterCode,
  };

  // Generate synthetic JWT (in production, use HSM)
  const jwt = await generateSyntheticJWT(jwtPayload);

  return {
    vc,
    jwt,
    proof: {
      type: 'JwtProof2020',
      created: new Date(now * 1000).toISOString(),
      proofPurpose: 'assertionMethod',
      verificationMethod: `${issuerDID}#key-1`,
      jws: jwt,
    },
  };
}

/**
 * Generate synthetic JWT
 */
async function generateSyntheticJWT(payload) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });

  // Export private key in PEM format for jose
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  // Import the key using jose's importPKCS8
  const key = await importPKCS8(privateKeyPem, 'ES256');

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'JWT',
      kid: 'w3c_issuer_key_synthetic',
    })
    .sign(key);

  return jwt;
}

export default {
  generateW3CCredential,
};
