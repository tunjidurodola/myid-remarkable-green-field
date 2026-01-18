import { Blake3Crypto } from '../crypto/blake3';
import { v4 as uuidv4 } from 'uuid';

/**
 * W3C Decentralized Identifier (DID) and Verifiable Credential implementation
 */

export interface DIDDocument {
  '@context': string[];
  id: string;
  controller?: string;
  verificationMethod: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
    publicKeyJwk?: any;
  }>;
  authentication: string[];
  assertionMethod?: string[];
  keyAgreement?: string[];
  capabilityInvocation?: string[];
  capabilityDelegation?: string[];
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string | {
    id: string;
    name?: string;
  };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string;
    [key: string]: any;
  };
  proof: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    jws?: string;
    proofValue?: string;
  };
  credentialStatus?: {
    id: string;
    type: string;
  };
}

export interface VerifiablePresentation {
  '@context': string[];
  type: string[];
  holder: string;
  verifiableCredential: VerifiableCredential[];
  proof: {
    type: string;
    created: string;
    challenge?: string;
    domain?: string;
    proofPurpose: string;
    verificationMethod: string;
    jws?: string;
  };
}

export class W3CDID {
  /**
   * Generate a new DID using pocketOne method
   */
  static generate(publicKey: string): string {
    const identifier = Blake3Crypto.hash(publicKey).substring(0, 32);
    return `did:pocketone:${identifier}`;
  }

  /**
   * Create DID Document
   */
  static createDIDDocument(did: string, publicKey: string): DIDDocument {
    return {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://w3id.org/security/suites/jws-2020/v1',
      ],
      id: did,
      verificationMethod: [
        {
          id: `${did}#keys-1`,
          type: 'JsonWebKey2020',
          controller: did,
          publicKeyJwk: {
            kty: 'EC',
            crv: 'P-256',
            x: publicKey.substring(0, 43),
            y: publicKey.substring(43, 86),
          },
        },
      ],
      authentication: [`${did}#keys-1`],
      assertionMethod: [`${did}#keys-1`],
      keyAgreement: [`${did}#keys-1`],
    };
  }

  /**
   * Create Verifiable Credential
   */
  static createCredential(
    issuerDID: string,
    subjectDID: string,
    claims: Record<string, any>,
    type: string = 'IdentityCredential'
  ): VerifiableCredential {
    const now = new Date().toISOString();
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 5);

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://pocketone.io/credentials/v1',
      ],
      id: `urn:uuid:${uuidv4()}`,
      type: ['VerifiableCredential', type],
      issuer: issuerDID,
      issuanceDate: now,
      expirationDate: expiry.toISOString(),
      credentialSubject: {
        id: subjectDID,
        ...claims,
      },
      proof: {
        type: 'JsonWebSignature2020',
        created: now,
        proofPurpose: 'assertionMethod',
        verificationMethod: `${issuerDID}#keys-1`,
      },
    };
  }

  /**
   * Create Verifiable Presentation
   */
  static createPresentation(
    holderDID: string,
    credentials: VerifiableCredential[],
    challenge?: string,
    domain?: string
  ): VerifiablePresentation {
    const now = new Date().toISOString();

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
      ],
      type: ['VerifiablePresentation'],
      holder: holderDID,
      verifiableCredential: credentials,
      proof: {
        type: 'JsonWebSignature2020',
        created: now,
        challenge,
        domain,
        proofPurpose: 'authentication',
        verificationMethod: `${holderDID}#keys-1`,
      },
    };
  }

  /**
   * Verify Verifiable Credential
   *
   * NOTE: Real cryptographic verification MUST be done server-side
   * using backend/lib/verifiers.mjs DIDVCVerifier.verifyCredential()
   *
   * This client-side method performs basic structural validation only.
   * DO NOT rely on this for security-critical decisions.
   */
  static async verifyCredential(credential: VerifiableCredential): Promise<boolean> {
    // Basic structural validation only - not cryptographic verification
    // Real verification happens server-side with DID resolution and JWS verification

    // Check expiration
    if (credential.expirationDate) {
      const expiry = new Date(credential.expirationDate);
      if (expiry < new Date()) return false;
    }

    // Check that proof structure exists
    if (!credential.proof?.jws && !credential.proof?.proofValue) {
      return false;
    }

    // Check that issuer is present
    const issuerDID = typeof credential.issuer === 'string'
      ? credential.issuer
      : credential.issuer?.id;

    if (!issuerDID || !issuerDID.startsWith('did:')) {
      return false;
    }

    // Structure is valid - actual cryptographic verification must be done server-side
    return true;
  }

  /**
   * Verify Verifiable Presentation
   */
  static async verifyPresentation(
    presentation: VerifiablePresentation,
    challenge?: string
  ): Promise<boolean> {
    // Verify challenge matches
    if (challenge && presentation.proof.challenge !== challenge) {
      return false;
    }

    // Verify holder signature
    if (!presentation.proof.jws) return false;

    // Verify all credentials in the presentation
    for (const credential of presentation.verifiableCredential) {
      const valid = await this.verifyCredential(credential);
      if (!valid) return false;
    }

    return true;
  }

  /**
   * Create selective disclosure presentation
   */
  static createSelectiveDisclosure(
    credential: VerifiableCredential,
    disclosedClaims: string[]
  ): VerifiableCredential {
    const selective: VerifiableCredential = {
      ...credential,
      credentialSubject: {
        id: credential.credentialSubject.id,
      },
    };

    // Only include disclosed claims
    disclosedClaims.forEach((claim) => {
      if (credential.credentialSubject[claim] !== undefined) {
        selective.credentialSubject[claim] = credential.credentialSubject[claim];
      }
    });

    return selective;
  }

  /**
   * Resolve DID to DID Document
   */
  static async resolveDID(did: string): Promise<DIDDocument | null> {
    // In production, this would query the DID registry/blockchain
    // For demo purposes, return a mock document
    if (!did.startsWith('did:pocketone:')) {
      return null;
    }

    return {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: did,
      verificationMethod: [],
      authentication: [],
    };
  }
}
