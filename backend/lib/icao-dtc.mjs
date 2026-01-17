/**
 * ICAO Digital Travel Credential (DTC) Module
 * Implements ICAO Doc 9303 standards for machine-readable travel documents
 *
 * Namespace: icao.9303.dtc
 */

import crypto from 'crypto';

// ICAO DTC Namespace
export const ICAO_NAMESPACE = 'icao.9303.dtc';

// Document types (TD1, TD2, TD3 for different card sizes)
export const DOCUMENT_TYPES = {
  PASSPORT: 'P',
  PASSPORT_CARD: 'PC',
  VISA: 'V',
  TRAVEL_DOCUMENT: 'TD',
  ID_CARD: 'I',
  RESIDENCE_PERMIT: 'R',
  CREW_MEMBER: 'AC',
  DIPLOMAT: 'D',
};

// MRZ formats
export const MRZ_FORMATS = {
  TD1: { lines: 3, charsPerLine: 30 }, // ID cards
  TD2: { lines: 2, charsPerLine: 36 }, // Travel documents
  TD3: { lines: 2, charsPerLine: 44 }, // Passports
};

// Data groups
export const DATA_GROUPS = {
  DG1: 'MRZ Data',
  DG2: 'Facial Image',
  DG3: 'Fingerprints',
  DG4: 'Iris',
  DG5: 'Portrait',
  DG7: 'Signature',
  DG11: 'Additional Personal Details',
  DG12: 'Additional Document Details',
  DG14: 'Security Features',
  DG15: 'Active Authentication Public Key',
  DG16: 'Persons to Notify',
};

/**
 * MRZ Parser and Validator
 */
export class MRZParser {
  /**
   * Parse MRZ from raw string
   */
  static parse(mrzString) {
    const lines = mrzString.trim().split('\n').map((l) => l.trim());

    if (lines.length === 2 && lines[0].length >= 44) {
      return this.parseTD3(lines);
    } else if (lines.length === 2 && lines[0].length >= 36) {
      return this.parseTD2(lines);
    } else if (lines.length === 3 && lines[0].length >= 30) {
      return this.parseTD1(lines);
    }

    throw new Error('Invalid MRZ format');
  }

  /**
   * Parse TD3 format (Passports)
   */
  static parseTD3(lines) {
    const line1 = lines[0].padEnd(44, '<');
    const line2 = lines[1].padEnd(44, '<');

    const documentType = line1.substring(0, 2).replace(/<+$/, '');
    const issuingCountry = line1.substring(2, 5).replace(/<+$/, '');
    const names = line1.substring(5, 44).split('<<');
    const familyName = (names[0] || '').replace(/<+$/, '').replace(/</g, ' ').trim();
    const givenNames = (names[1] || '').replace(/<+$/, '').replace(/</g, ' ').trim();

    const documentNumber = line2.substring(0, 9).replace(/<+$/, '');
    const docNumCheck = line2.substring(9, 10);
    const nationality = line2.substring(10, 13).replace(/<+$/, '');
    const dateOfBirth = line2.substring(13, 19);
    const dobCheck = line2.substring(19, 20);
    const sex = line2.substring(20, 21);
    const dateOfExpiry = line2.substring(21, 27);
    const expCheck = line2.substring(27, 28);
    const personalNumber = line2.substring(28, 42).replace(/<+$/, '');
    const personalNumCheck = line2.substring(42, 43);
    const overallCheck = line2.substring(43, 44);

    return {
      format: 'TD3',
      documentType,
      issuingCountry,
      familyName,
      givenNames,
      documentNumber,
      nationality,
      dateOfBirth: this.formatDate(dateOfBirth),
      sex: this.formatSex(sex),
      dateOfExpiry: this.formatDate(dateOfExpiry),
      personalNumber: personalNumber || null,
      checkDigits: {
        documentNumber: docNumCheck,
        dateOfBirth: dobCheck,
        dateOfExpiry: expCheck,
        personalNumber: personalNumCheck,
        overall: overallCheck,
      },
      raw: { line1, line2 },
    };
  }

  /**
   * Parse TD2 format
   */
  static parseTD2(lines) {
    const line1 = lines[0].padEnd(36, '<');
    const line2 = lines[1].padEnd(36, '<');

    const documentType = line1.substring(0, 2).replace(/<+$/, '');
    const issuingCountry = line1.substring(2, 5).replace(/<+$/, '');
    const names = line1.substring(5, 36).split('<<');
    const familyName = (names[0] || '').replace(/<+$/, '').replace(/</g, ' ').trim();
    const givenNames = (names[1] || '').replace(/<+$/, '').replace(/</g, ' ').trim();

    const documentNumber = line2.substring(0, 9).replace(/<+$/, '');
    const docNumCheck = line2.substring(9, 10);
    const nationality = line2.substring(10, 13).replace(/<+$/, '');
    const dateOfBirth = line2.substring(13, 19);
    const dobCheck = line2.substring(19, 20);
    const sex = line2.substring(20, 21);
    const dateOfExpiry = line2.substring(21, 27);
    const expCheck = line2.substring(27, 28);
    const optionalData = line2.substring(28, 35).replace(/<+$/, '');
    const overallCheck = line2.substring(35, 36);

    return {
      format: 'TD2',
      documentType,
      issuingCountry,
      familyName,
      givenNames,
      documentNumber,
      nationality,
      dateOfBirth: this.formatDate(dateOfBirth),
      sex: this.formatSex(sex),
      dateOfExpiry: this.formatDate(dateOfExpiry),
      optionalData: optionalData || null,
      checkDigits: {
        documentNumber: docNumCheck,
        dateOfBirth: dobCheck,
        dateOfExpiry: expCheck,
        overall: overallCheck,
      },
      raw: { line1, line2 },
    };
  }

  /**
   * Parse TD1 format (ID Cards)
   */
  static parseTD1(lines) {
    const line1 = lines[0].padEnd(30, '<');
    const line2 = lines[1].padEnd(30, '<');
    const line3 = lines[2].padEnd(30, '<');

    const documentType = line1.substring(0, 2).replace(/<+$/, '');
    const issuingCountry = line1.substring(2, 5).replace(/<+$/, '');
    const documentNumber = line1.substring(5, 14).replace(/<+$/, '');
    const docNumCheck = line1.substring(14, 15);
    const optionalData1 = line1.substring(15, 30).replace(/<+$/, '');

    const dateOfBirth = line2.substring(0, 6);
    const dobCheck = line2.substring(6, 7);
    const sex = line2.substring(7, 8);
    const dateOfExpiry = line2.substring(8, 14);
    const expCheck = line2.substring(14, 15);
    const nationality = line2.substring(15, 18).replace(/<+$/, '');
    const optionalData2 = line2.substring(18, 29).replace(/<+$/, '');
    const overallCheck = line2.substring(29, 30);

    const names = line3.split('<<');
    const familyName = (names[0] || '').replace(/<+$/, '').replace(/</g, ' ').trim();
    const givenNames = (names[1] || '').replace(/<+$/, '').replace(/</g, ' ').trim();

    return {
      format: 'TD1',
      documentType,
      issuingCountry,
      familyName,
      givenNames,
      documentNumber,
      nationality,
      dateOfBirth: this.formatDate(dateOfBirth),
      sex: this.formatSex(sex),
      dateOfExpiry: this.formatDate(dateOfExpiry),
      optionalData: [optionalData1, optionalData2].filter(Boolean).join(' ') || null,
      checkDigits: {
        documentNumber: docNumCheck,
        dateOfBirth: dobCheck,
        dateOfExpiry: expCheck,
        overall: overallCheck,
      },
      raw: { line1, line2, line3 },
    };
  }

  /**
   * Format date from YYMMDD to ISO
   */
  static formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 6) return null;

    const yy = parseInt(dateStr.substring(0, 2), 10);
    const mm = dateStr.substring(2, 4);
    const dd = dateStr.substring(4, 6);

    // Use 2000 cutoff for year determination
    const century = yy > 50 ? 19 : 20;
    const year = century * 100 + yy;

    return `${year}-${mm}-${dd}`;
  }

  /**
   * Format sex field
   */
  static formatSex(sex) {
    const mapping = {
      M: 'male',
      F: 'female',
      '<': 'unspecified',
      X: 'unspecified',
    };
    return mapping[sex] || 'unspecified';
  }

  /**
   * Calculate check digit using ICAO algorithm
   */
  static calculateCheckDigit(value) {
    const weights = [7, 3, 1];
    let sum = 0;

    for (let i = 0; i < value.length; i++) {
      const char = value.charAt(i);
      let charValue;

      if (char === '<') {
        charValue = 0;
      } else if (char >= '0' && char <= '9') {
        charValue = parseInt(char, 10);
      } else if (char >= 'A' && char <= 'Z') {
        charValue = char.charCodeAt(0) - 65 + 10;
      } else {
        charValue = 0;
      }

      sum += charValue * weights[i % 3];
    }

    return String(sum % 10);
  }

  /**
   * Validate MRZ check digits
   */
  static validateCheckDigits(parsed) {
    const errors = [];

    // Validate document number
    if (parsed.documentNumber) {
      const calcDocNum = this.calculateCheckDigit(
        parsed.documentNumber.padEnd(9, '<'),
      );
      if (calcDocNum !== parsed.checkDigits.documentNumber && parsed.checkDigits.documentNumber !== '<') {
        errors.push('Invalid document number check digit');
      }
    }

    // Validate date of birth
    if (parsed.dateOfBirth) {
      const dobRaw = parsed.dateOfBirth.replace(/-/g, '').substring(2);
      const calcDob = this.calculateCheckDigit(dobRaw);
      if (calcDob !== parsed.checkDigits.dateOfBirth) {
        errors.push('Invalid date of birth check digit');
      }
    }

    // Validate expiry date
    if (parsed.dateOfExpiry) {
      const expRaw = parsed.dateOfExpiry.replace(/-/g, '').substring(2);
      const calcExp = this.calculateCheckDigit(expRaw);
      if (calcExp !== parsed.checkDigits.dateOfExpiry) {
        errors.push('Invalid expiry date check digit');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * ICAO DTC (Digital Travel Credential) Manager
 */
export class ICAODTCManager {
  /**
   * Create a Digital Travel Credential
   */
  static create(documentData, masterCode, trustCode) {
    const now = new Date();
    const credentialId = crypto.randomUUID();

    const dtc = {
      version: '1.0',
      namespace: ICAO_NAMESPACE,
      credentialId,
      createdAt: now.toISOString(),

      // Document information
      documentType: documentData.documentType || DOCUMENT_TYPES.PASSPORT,
      issuingState: documentData.issuingState,
      documentNumber: documentData.documentNumber,

      // Holder information
      holderInfo: {
        primaryIdentifier: documentData.familyName,
        secondaryIdentifier: documentData.givenNames,
        nationality: documentData.nationality,
        dateOfBirth: documentData.dateOfBirth,
        sex: documentData.sex,
        placeOfBirth: documentData.placeOfBirth || null,
      },

      // Document validity
      documentInfo: {
        dateOfIssue: documentData.dateOfIssue,
        dateOfExpiry: documentData.dateOfExpiry,
        issuingAuthority: documentData.issuingAuthority,
      },

      // Data Groups
      dataGroups: {},

      // Security Object Data (SOD)
      securityObject: {
        hashAlgorithm: 'SHA-256',
        signatureAlgorithm: 'RSA-SHA256',
        dataGroupHashes: {},
        certificate: null, // To be filled by issuer
        signature: null, // To be filled by HSM
      },

      // Active Authentication data
      activeAuthentication: {
        publicKey: null, // AA public key
        algorithm: 'RSA-2048',
      },

      // pocketOne extensions
      extensions: {
        masterCode,
        masterCodeHash: crypto.createHash('sha256').update(masterCode).digest('hex'),
        trustCode,
        trustCodeHash: crypto.createHash('sha256').update(trustCode).digest('hex'),
      },
    };

    // Generate DG1 (MRZ)
    dtc.dataGroups.DG1 = this.createDataGroup(1, this.generateMRZ(documentData));

    // Generate DG2 (Facial image) if provided
    if (documentData.facialImage) {
      dtc.dataGroups.DG2 = this.createDataGroup(2, {
        imageType: 'JPEG2000',
        imageData: documentData.facialImage,
        featurePoints: documentData.featurePoints || null,
      });
    }

    // Generate DG7 (Signature) if provided
    if (documentData.signature) {
      dtc.dataGroups.DG7 = this.createDataGroup(7, {
        signatureImage: documentData.signature,
        format: 'PNG',
      });
    }

    // Generate DG11 (Additional details) if provided
    if (documentData.additionalDetails) {
      dtc.dataGroups.DG11 = this.createDataGroup(11, documentData.additionalDetails);
    }

    // Update SOD with data group hashes
    for (const [dgName, dg] of Object.entries(dtc.dataGroups)) {
      dtc.securityObject.dataGroupHashes[dgName] = dg.hash;
    }

    return dtc;
  }

  /**
   * Create a data group with hash
   */
  static createDataGroup(dgNumber, content) {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const hash = crypto.createHash('sha256').update(contentStr).digest('hex');

    return {
      dataGroupNumber: dgNumber,
      dataGroupName: DATA_GROUPS[`DG${dgNumber}`] || `DG${dgNumber}`,
      hash,
      content,
    };
  }

  /**
   * Generate MRZ string from document data (TD3 format for passports)
   */
  static generateMRZ(data) {
    const docType = (data.documentType || 'P').substring(0, 2);
    const country = (data.issuingState || '').substring(0, 3).toUpperCase();
    const familyName = (data.familyName || '').toUpperCase().replace(/[^A-Z]/g, '<');
    const givenNames = (data.givenNames || '').toUpperCase().replace(/[^A-Z]/g, '<').replace(/ /g, '<');

    // Line 1: Document type, country, names
    let line1 = `${docType.padEnd(2, '<')}${country.padEnd(3, '<')}`;
    line1 += `${familyName}<<${givenNames}`;
    line1 = line1.padEnd(44, '<').substring(0, 44);

    // Line 2: Document number, nationality, DOB, sex, expiry, optional data
    const docNum = (data.documentNumber || '').substring(0, 9).padEnd(9, '<').toUpperCase();
    const docNumCheck = MRZParser.calculateCheckDigit(docNum);

    const nationality = (data.nationality || country).substring(0, 3).toUpperCase().padEnd(3, '<');

    const dob = (data.dateOfBirth || '').replace(/-/g, '').substring(2, 8);
    const dobCheck = MRZParser.calculateCheckDigit(dob);

    const sex = (data.sex === 'male' ? 'M' : data.sex === 'female' ? 'F' : '<').charAt(0);

    const expiry = (data.dateOfExpiry || '').replace(/-/g, '').substring(2, 8);
    const expiryCheck = MRZParser.calculateCheckDigit(expiry);

    const personalNum = (data.personalNumber || '').substring(0, 14).padEnd(14, '<').toUpperCase();
    const personalCheck = MRZParser.calculateCheckDigit(personalNum);

    let line2 = `${docNum}${docNumCheck}${nationality}${dob}${dobCheck}${sex}${expiry}${expiryCheck}${personalNum}${personalCheck}`;

    // Calculate overall check digit
    const forOverallCheck = docNum + docNumCheck + dob + dobCheck + expiry + expiryCheck + personalNum + personalCheck;
    const overallCheck = MRZParser.calculateCheckDigit(forOverallCheck);
    line2 = line2 + overallCheck;

    return `${line1}\n${line2}`;
  }

  /**
   * Verify DTC integrity using SOD
   */
  static verifyIntegrity(dtc) {
    const errors = [];

    // Verify all data group hashes
    for (const [dgName, dg] of Object.entries(dtc.dataGroups)) {
      const expectedHash = dtc.securityObject.dataGroupHashes[dgName];
      const contentStr = typeof dg.content === 'string' ? dg.content : JSON.stringify(dg.content);
      const actualHash = crypto.createHash('sha256').update(contentStr).digest('hex');

      if (actualHash !== expectedHash) {
        errors.push(`${dgName} hash mismatch`);
      }
    }

    // Verify expiry
    if (dtc.documentInfo.dateOfExpiry) {
      const expiry = new Date(dtc.documentInfo.dateOfExpiry);
      if (expiry < new Date()) {
        errors.push('Document has expired');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Chip Authentication Simulator
 * Simulates eMRTD chip authentication protocols
 */
export class ChipAuthSimulator {
  /**
   * Simulate Basic Access Control (BAC) key derivation
   * Uses MRZ data to derive session keys
   */
  static deriveBAC(mrzInfo) {
    const { documentNumber, dateOfBirth, dateOfExpiry } = mrzInfo;

    // Format as per ICAO 9303
    const docNum = documentNumber.padEnd(9, '<');
    const docNumCheck = MRZParser.calculateCheckDigit(docNum);
    const dob = dateOfBirth.replace(/-/g, '').substring(2);
    const dobCheck = MRZParser.calculateCheckDigit(dob);
    const exp = dateOfExpiry.replace(/-/g, '').substring(2);
    const expCheck = MRZParser.calculateCheckDigit(exp);

    // Keyseed = SHA-1(MRZ_information)[0:16]
    const mrzInfo1 = docNum + docNumCheck + dob + dobCheck + exp + expCheck;
    const keySeed = crypto.createHash('sha1').update(mrzInfo1).digest().slice(0, 16);

    // Derive encryption and MAC keys
    const kEnc = this.kdf(keySeed, 1);
    const kMac = this.kdf(keySeed, 2);

    return {
      keySeed: keySeed.toString('hex'),
      kEnc: kEnc.toString('hex'),
      kMac: kMac.toString('hex'),
      mrzData: mrzInfo1,
    };
  }

  /**
   * Key Derivation Function (simplified)
   */
  static kdf(keySeed, counter) {
    const c = Buffer.alloc(4);
    c.writeUInt32BE(counter, 0);

    const d = Buffer.concat([keySeed, c]);
    const hash = crypto.createHash('sha1').update(d).digest();

    // Adjust parity bits for 3DES (simplified)
    const key = Buffer.alloc(16);
    hash.copy(key, 0, 0, 16);

    return key;
  }

  /**
   * Simulate PACE (Password Authenticated Connection Establishment)
   * More secure than BAC
   */
  static derivePACE(mrzInfo, domainParams = 'brainpoolP256r1') {
    const { documentNumber, dateOfBirth, dateOfExpiry } = mrzInfo;

    // K = SHA-1(MRZ info)
    const mrzInput = documentNumber + dateOfBirth.replace(/-/g, '') + dateOfExpiry.replace(/-/g, '');
    const k = crypto.createHash('sha1').update(mrzInput).digest();

    // In real implementation, this would perform ECDH key agreement
    // For simulation, we generate session keys deterministically
    const sessionKey = crypto.createHash('sha256').update(k).digest();

    return {
      protocol: 'PACE',
      domainParams,
      sharedSecret: k.toString('hex'),
      sessionKey: sessionKey.toString('hex'),
    };
  }

  /**
   * Simulate Active Authentication challenge-response
   */
  static performActiveAuthentication(dtc, challenge) {
    const challengeBuffer = Buffer.from(challenge, 'hex');

    // In real implementation, the chip would sign the challenge with its AA private key
    // For simulation, we create a deterministic response
    const response = crypto
      .createHash('sha256')
      .update(Buffer.concat([
        challengeBuffer,
        Buffer.from(dtc.documentNumber || ''),
        Buffer.from(dtc.extensions?.masterCode || ''),
      ]))
      .digest();

    return {
      challenge: challenge,
      response: response.toString('hex'),
      algorithm: 'RSA-SHA256',
      verified: true, // In production, would verify signature
    };
  }

  /**
   * Simulate Chip Authentication (CA)
   * Provides stronger authentication than AA
   */
  static performChipAuthentication(dtc, ephemeralPublicKey) {
    // In real implementation:
    // 1. Terminal sends ephemeral ECDH public key
    // 2. Chip uses its CA private key and terminal's public key for ECDH
    // 3. Derive session keys from shared secret

    const sharedSecret = crypto
      .createHash('sha256')
      .update(ephemeralPublicKey + (dtc.credentialId || ''))
      .digest();

    return {
      protocol: 'ChipAuthentication',
      sharedSecret: sharedSecret.toString('hex'),
      sessionKeyEnc: crypto.createHash('sha256').update(sharedSecret + 'enc').digest('hex'),
      sessionKeyMac: crypto.createHash('sha256').update(sharedSecret + 'mac').digest('hex'),
      verified: true,
    };
  }

  /**
   * Generate random challenge for AA
   */
  static generateChallenge() {
    return crypto.randomBytes(8).toString('hex');
  }
}

/**
 * DTC Selective Disclosure
 */
export class DTCSelectiveDisclosure {
  /**
   * Extract specific data groups for disclosure
   */
  static extract(dtc, requestedDataGroups) {
    const extracted = {
      version: dtc.version,
      namespace: dtc.namespace,
      credentialId: dtc.credentialId,
      documentType: dtc.documentType,
      issuingState: dtc.issuingState,
      dataGroups: {},
      securityObject: {
        hashAlgorithm: dtc.securityObject.hashAlgorithm,
        dataGroupHashes: {},
        signature: dtc.securityObject.signature,
      },
    };

    for (const dgName of requestedDataGroups) {
      if (dtc.dataGroups[dgName]) {
        extracted.dataGroups[dgName] = dtc.dataGroups[dgName];
        extracted.securityObject.dataGroupHashes[dgName] = dtc.securityObject.dataGroupHashes[dgName];
      }
    }

    return extracted;
  }

  /**
   * Create presentation proof
   */
  static createPresentation(dtc, requestedDataGroups, challenge) {
    const disclosed = this.extract(dtc, requestedDataGroups);

    return {
      presentation: disclosed,
      proof: {
        challenge,
        timestamp: new Date().toISOString(),
        holderSignature: crypto
          .createHash('sha256')
          .update(challenge + JSON.stringify(disclosed))
          .digest('hex'),
      },
    };
  }
}

export default {
  ICAO_NAMESPACE,
  DOCUMENT_TYPES,
  MRZ_FORMATS,
  DATA_GROUPS,
  MRZParser,
  ICAODTCManager,
  ChipAuthSimulator,
  DTCSelectiveDisclosure,
};
