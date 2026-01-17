import { Blake3Crypto } from '../crypto/blake3';
import { CREDENTIAL_FORMATS } from '../constants';

/**
 * eIDAS2 Wallet Credential implementation
 * European Digital Identity Wallet format
 */

export interface eIDAS2Credential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: {
    id: string;
    name: string;
    country: string;
  };
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string; // DID of the holder
    familyName: string;
    givenName: string;
    birthDate: string;
    birthPlace?: string;
    currentAddress?: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
    nationality: string;
    personalIdentifier: string; // National ID number
    // pocketOne extensions
    masterCode: string;
    trustCode: string;
  };
  proof: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    jws?: string; // JSON Web Signature
  };
  credentialSchema: {
    id: string;
    type: string;
  };
}

export class eIDAS2Wallet {
  /**
   * Create eIDAS2 PID (Person Identification Data) credential
   */
  static createPID(
    userData: {
      did: string;
      familyName: string;
      givenName: string;
      birthDate: string;
      birthPlace?: string;
      nationality: string;
      personalIdentifier: string;
      currentAddress?: any;
    },
    issuer: {
      id: string;
      name: string;
      country: string;
    },
    masterCode: string,
    trustCode: string
  ): eIDAS2Credential {
    const now = new Date().toISOString();
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 5);

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://europa.eu/eudi/wallet/v1',
      ],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'EuropeanDigitalIdentityCredential', 'PID'],
      issuer: {
        id: issuer.id,
        name: issuer.name,
        country: issuer.country,
      },
      issuanceDate: now,
      expirationDate: expiry.toISOString(),
      credentialSubject: {
        id: userData.did,
        familyName: userData.familyName,
        givenName: userData.givenName,
        birthDate: userData.birthDate,
        birthPlace: userData.birthPlace,
        currentAddress: userData.currentAddress,
        nationality: userData.nationality,
        personalIdentifier: userData.personalIdentifier,
        masterCode,
        trustCode,
      },
      proof: {
        type: 'JsonWebSignature2020',
        created: now,
        proofPurpose: 'assertionMethod',
        verificationMethod: `${issuer.id}#keys-1`,
        jws: '', // To be filled by HSM signing
      },
      credentialSchema: {
        id: 'https://europa.eu/eudi/wallet/pid/v1',
        type: 'JsonSchemaValidator2018',
      },
    };
  }

  /**
   * Create Qualified Electronic Attestation of Attributes (QEAA)
   */
  static createQEAA(
    attributes: Record<string, any>,
    issuer: any,
    holderDID: string
  ): eIDAS2Credential {
    const now = new Date().toISOString();

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://europa.eu/eudi/wallet/v1',
      ],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'QualifiedElectronicAttestationOfAttributes'],
      issuer,
      issuanceDate: now,
      credentialSubject: {
        id: holderDID,
        ...attributes,
      } as any,
      proof: {
        type: 'JsonWebSignature2020',
        created: now,
        proofPurpose: 'assertionMethod',
        verificationMethod: `${issuer.id}#keys-1`,
      },
      credentialSchema: {
        id: 'https://europa.eu/eudi/wallet/qeaa/v1',
        type: 'JsonSchemaValidator2018',
      },
    };
  }

  /**
   * Verify eIDAS2 credential
   */
  static async verify(credential: eIDAS2Credential): Promise<boolean> {
    // In production, verify the JWS signature
    if (!credential.proof.jws) return false;

    // Verify expiration
    if (credential.expirationDate) {
      const expiry = new Date(credential.expirationDate);
      if (expiry < new Date()) return false;
    }

    // Verify issuer is trusted
    // This would check against a registry of trusted eIDAS issuers

    return true;
  }

  /**
   * Create presentation of credential (selective disclosure)
   */
  static createPresentation(
    credential: eIDAS2Credential,
    disclosedFields: string[]
  ): Partial<eIDAS2Credential> {
    const presentation: any = {
      '@context': credential['@context'],
      type: credential.type,
      issuer: credential.issuer,
      credentialSubject: {
        id: credential.credentialSubject.id,
      },
      proof: credential.proof,
    };

    // Only include requested fields
    disclosedFields.forEach((field) => {
      if ((credential.credentialSubject as any)[field]) {
        (presentation.credentialSubject as any)[field] = (credential.credentialSubject as any)[field];
      }
    });

    return presentation;
  }
}
