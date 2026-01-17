import { encode, decode } from 'cbor';
import { Blake3Crypto } from '../crypto/blake3';
import { OID_NAMESPACE, CREDENTIAL_FORMATS } from '../constants';

/**
 * ISO 18013-5 Mobile Driving License (mDL) implementation
 * Uses CBOR encoding and selective disclosure
 */

export interface MDLNamespace {
  'org.iso.18013.5.1': {
    family_name: string;
    given_name: string;
    birth_date: string;
    issue_date: string;
    expiry_date: string;
    issuing_country: string;
    issuing_authority: string;
    document_number: string;
    portrait?: string; // Base64 encoded image
    driving_privileges?: Array<{
      vehicle_category_code: string;
      issue_date: string;
      expiry_date: string;
    }>;
  };
  'com.pocketone.claims': {
    master_code: string;
    trust_code: string;
  };
}

export interface MDLDocument {
  version: string;
  docType: string;
  namespaces: MDLNamespace;
  issuerAuth: {
    signature: string;
    certificate: string;
    algorithm: string;
  };
  deviceAuth?: {
    deviceSignature?: string;
  };
}

export class MDLCredential {
  /**
   * Create a new mDL credential
   */
  static create(
    userData: {
      familyName: string;
      givenName: string;
      birthDate: string;
      documentNumber: string;
      issuingCountry: string;
      issuingAuthority: string;
      issueDate: string;
      expiryDate: string;
      portrait?: string;
      drivingPrivileges?: Array<any>;
    },
    masterCode: string,
    trustCode: string
  ): MDLDocument {
    const doc: MDLDocument = {
      version: '1.0',
      docType: CREDENTIAL_FORMATS.MDOC,
      namespaces: {
        'org.iso.18013.5.1': {
          family_name: userData.familyName,
          given_name: userData.givenName,
          birth_date: userData.birthDate,
          issue_date: userData.issueDate,
          expiry_date: userData.expiryDate,
          issuing_country: userData.issuingCountry,
          issuing_authority: userData.issuingAuthority,
          document_number: userData.documentNumber,
          portrait: userData.portrait,
          driving_privileges: userData.drivingPrivileges,
        },
        'com.pocketone.claims': {
          master_code: masterCode,
          trust_code: trustCode,
        },
      },
      issuerAuth: {
        signature: '', // To be filled by HSM
        certificate: '', // Issuer certificate
        algorithm: 'ES256',
      },
    };

    return doc;
  }

  /**
   * Encode mDL to CBOR format
   */
  static encodeCBOR(doc: MDLDocument): Buffer {
    return encode(doc);
  }

  /**
   * Decode mDL from CBOR format
   */
  static decodeCBOR(data: Buffer): MDLDocument {
    return decode(data) as MDLDocument;
  }

  /**
   * Create selective disclosure of specific data elements
   */
  static createSelectiveDisclosure(
    doc: MDLDocument,
    requestedElements: string[]
  ): Partial<MDLDocument> {
    const disclosed: any = {
      version: doc.version,
      docType: doc.docType,
      namespaces: {},
      issuerAuth: doc.issuerAuth,
    };

    // Only include requested elements
    requestedElements.forEach((element) => {
      const [namespace, key] = element.split('.');
      if (!disclosed.namespaces[namespace]) {
        disclosed.namespaces[namespace] = {};
      }
      const namespaceData = (doc.namespaces as any)[namespace];
      if (namespaceData?.[key]) {
        (disclosed.namespaces as any)[namespace][key] = namespaceData[key];
      }
    });

    return disclosed;
  }

  /**
   * Verify mDL signature
   */
  static verify(doc: MDLDocument): boolean {
    // In production, verify the issuerAuth signature against the certificate
    return !!doc.issuerAuth.signature && !!doc.issuerAuth.certificate;
  }

  /**
   * Generate age-over verification without revealing birth date
   */
  static createAgeOverProof(doc: MDLDocument, ageThreshold: number): {
    isOver: boolean;
    proof: string;
  } {
    const birthDate = new Date(doc.namespaces['org.iso.18013.5.1'].birth_date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();

    const isOver = age >= ageThreshold;

    // Create zero-knowledge proof (simplified)
    const proof = Blake3Crypto.hash(
      `${doc.namespaces['org.iso.18013.5.1'].birth_date}:${ageThreshold}:${isOver}`
    );

    return { isOver, proof };
  }
}
