import { Blake3Crypto } from '../crypto/blake3';

/**
 * ICAO 9303 Digital Travel Credential (DTC) implementation
 * Based on ICAO Doc 9303 standards for machine-readable travel documents
 */

export interface ICAODataGroup {
  dataGroupNumber: number;
  dataGroupHash: string;
  content?: any;
}

export interface DTCDocument {
  version: string;
  documentType: string; // 'P' for passport, 'V' for visa, etc.
  issuingState: string;
  documentNumber: string;
  holderInfo: {
    primaryIdentifier: string; // Family name
    secondaryIdentifier: string; // Given names
    nationality: string;
    dateOfBirth: string;
    sex: string;
    placeOfBirth?: string;
  };
  documentInfo: {
    dateOfIssue: string;
    dateOfExpiry: string;
    issuingAuthority: string;
  };
  // Data Groups (DG1-DG16)
  dataGroups: {
    DG1?: ICAODataGroup; // MRZ data
    DG2?: ICAODataGroup; // Facial image
    DG3?: ICAODataGroup; // Fingerprints
    DG4?: ICAODataGroup; // Iris
    DG5?: ICAODataGroup; // Portrait image
    DG7?: ICAODataGroup; // Signature image
    DG11?: ICAODataGroup; // Additional personal details
    DG12?: ICAODataGroup; // Additional document details
    DG14?: ICAODataGroup; // Security features
    DG15?: ICAODataGroup; // Active authentication public key
  };
  // Security Object Data (SOD)
  securityObject: {
    hashAlgorithm: string;
    signatureAlgorithm: string;
    dataGroupHashes: Record<string, string>;
    certificate: string;
    signature: string;
  };
  // pocketOne extensions
  extensions: {
    masterCode: string;
    trustCode: string;
  };
}

export class ICAODTCCredential {
  /**
   * Create a Digital Travel Credential
   */
  static create(
    documentData: {
      documentType: string;
      issuingState: string;
      documentNumber: string;
      familyName: string;
      givenNames: string;
      nationality: string;
      dateOfBirth: string;
      sex: string;
      placeOfBirth?: string;
      dateOfIssue: string;
      dateOfExpiry: string;
      issuingAuthority: string;
      facialImage?: string;
      signature?: string;
    },
    masterCode: string,
    trustCode: string
  ): DTCDocument {
    const doc: DTCDocument = {
      version: '1.0',
      documentType: documentData.documentType,
      issuingState: documentData.issuingState,
      documentNumber: documentData.documentNumber,
      holderInfo: {
        primaryIdentifier: documentData.familyName,
        secondaryIdentifier: documentData.givenNames,
        nationality: documentData.nationality,
        dateOfBirth: documentData.dateOfBirth,
        sex: documentData.sex,
        placeOfBirth: documentData.placeOfBirth,
      },
      documentInfo: {
        dateOfIssue: documentData.dateOfIssue,
        dateOfExpiry: documentData.dateOfExpiry,
        issuingAuthority: documentData.issuingAuthority,
      },
      dataGroups: {},
      securityObject: {
        hashAlgorithm: 'SHA256',
        signatureAlgorithm: 'RSA-SHA256',
        dataGroupHashes: {},
        certificate: '', // To be filled
        signature: '', // To be filled by HSM
      },
      extensions: {
        masterCode,
        trustCode,
      },
    };

    // Generate DG1 (MRZ)
    doc.dataGroups.DG1 = this.createDataGroup(1, this.generateMRZ(documentData));

    // Generate DG2 (Facial image)
    if (documentData.facialImage) {
      doc.dataGroups.DG2 = this.createDataGroup(2, {
        image: documentData.facialImage,
        format: 'JPEG2000',
      });
    }

    // Generate DG7 (Signature image)
    if (documentData.signature) {
      doc.dataGroups.DG7 = this.createDataGroup(7, {
        signature: documentData.signature,
        format: 'PNG',
      });
    }

    // Generate data group hashes for SOD
    Object.entries(doc.dataGroups).forEach(([key, dataGroup]) => {
      doc.securityObject.dataGroupHashes[key] = dataGroup.dataGroupHash;
    });

    return doc;
  }

  /**
   * Create a data group with hash
   */
  private static createDataGroup(dgNumber: number, content: any): ICAODataGroup {
    const contentStr = JSON.stringify(content);
    const hash = Blake3Crypto.hash(contentStr);

    return {
      dataGroupNumber: dgNumber,
      dataGroupHash: hash,
      content,
    };
  }

  /**
   * Generate Machine Readable Zone (MRZ) data
   */
  private static generateMRZ(data: {
    documentType: string;
    issuingState: string;
    familyName: string;
    givenNames: string;
    documentNumber: string;
    nationality: string;
    dateOfBirth: string;
    sex: string;
    dateOfExpiry: string;
  }): string {
    // Simplified MRZ generation (TD3 format for passports)
    const line1 = `${data.documentType}<${data.issuingState}${data.familyName}<<${data.givenNames}`.padEnd(44, '<');

    const dob = data.dateOfBirth.replace(/-/g, '').slice(2); // YYMMDD
    const expiry = data.dateOfExpiry.replace(/-/g, '').slice(2); // YYMMDD

    const line2 = `${data.documentNumber}${data.nationality}${dob}${data.sex}${expiry}`.padEnd(44, '<');

    return `${line1}\n${line2}`;
  }

  /**
   * Verify DTC integrity using SOD
   */
  static verify(doc: DTCDocument): boolean {
    // Verify all data group hashes
    for (const [key, dataGroup] of Object.entries(doc.dataGroups)) {
      const expectedHash = doc.securityObject.dataGroupHashes[key];
      if (dataGroup.dataGroupHash !== expectedHash) {
        return false;
      }
    }

    // In production, verify the SOD signature against the certificate
    return !!doc.securityObject.signature && !!doc.securityObject.certificate;
  }

  /**
   * Perform Active Authentication (AA)
   * Proves the chip is genuine and not cloned
   */
  static performActiveAuthentication(doc: DTCDocument, challenge: string): {
    response: string;
    signature: string;
  } {
    // In production, this would use the chip's AA private key
    const response = Blake3Crypto.hash(`${challenge}:${doc.documentNumber}`);
    const signature = Blake3Crypto.hash(`${response}:${doc.extensions.masterCode}`);

    return { response, signature };
  }

  /**
   * Extract specific data for selective disclosure
   */
  static extractData(doc: DTCDocument, requestedDataGroups: string[]): Partial<DTCDocument> {
    const extracted: any = {
      version: doc.version,
      documentType: doc.documentType,
      dataGroups: {},
      securityObject: doc.securityObject,
    };

    requestedDataGroups.forEach((dg) => {
      if (doc.dataGroups[dg as keyof typeof doc.dataGroups]) {
        extracted.dataGroups[dg] = doc.dataGroups[dg as keyof typeof doc.dataGroups];
      }
    });

    return extracted;
  }
}
