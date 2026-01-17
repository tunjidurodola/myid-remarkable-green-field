/**
 * eIDAS2 PID (Personal Identification Data) Credential Module
 * Implements EU Digital Identity Wallet standards for PID credentials
 *
 * Namespace: eu.europa.ec.eudi.pid.1
 */

import crypto from 'crypto';

// eIDAS2 PID Namespace
export const EIDAS2_NAMESPACE = 'eu.europa.ec.eudi.pid.1';

// Supported document types
export const PID_DOC_TYPES = {
  PID: 'eu.europa.ec.eudi.pid.1',
  MDL: 'org.iso.18013.5.1.mDL',
  EHIC: 'eu.europa.ec.eudi.ehic.1',
  POR: 'eu.europa.ec.eudi.por.1', // Proof of Residence
};

// Age verification predicates
export const AGE_PREDICATES = {
  over_12: 12,
  over_14: 14,
  over_16: 16,
  over_18: 18,
  over_21: 21,
  over_25: 25,
  over_65: 65,
};

// Country-specific claim mappings
export const COUNTRY_CLAIM_MAPPINGS = {
  // South Africa
  ZA: {
    nationalId: 'national_identity_number',
    firstName: 'given_name',
    lastName: 'family_name',
    dateOfBirth: 'birth_date',
    gender: 'sex',
    address: 'resident_address',
    province: 'resident_state',
    citizenship: 'nationality',
  },
  // European Union Common
  EU: {
    nationalId: 'personal_identifier',
    firstName: 'given_name',
    lastName: 'family_name',
    dateOfBirth: 'birth_date',
    gender: 'gender',
    birthPlace: 'birth_place',
    address: 'address',
    nationality: 'nationality',
    issuingCountry: 'issuing_country',
    issuingAuthority: 'issuing_authority',
    issuanceDate: 'issuance_date',
    expiryDate: 'expiry_date',
  },
  // Germany
  DE: {
    nationalId: 'personal_identification_number',
    firstName: 'given_name',
    lastName: 'family_name',
    dateOfBirth: 'birth_date',
    birthPlace: 'place_of_birth',
    address: 'residential_address',
    nationality: 'nationality',
  },
  // France
  FR: {
    nationalId: 'insee_code',
    firstName: 'prenom',
    lastName: 'nom',
    dateOfBirth: 'date_naissance',
    birthPlace: 'lieu_naissance',
    address: 'adresse',
    nationality: 'nationalite',
  },
  // United Kingdom
  GB: {
    nationalId: 'national_insurance_number',
    firstName: 'given_name',
    lastName: 'family_name',
    dateOfBirth: 'date_of_birth',
    address: 'registered_address',
    nationality: 'nationality',
  },
};

/**
 * PID Credential Structure following eIDAS2 specification
 */
export class EiDAS2PID {
  /**
   * Create a new PID credential
   * @param {Object} personalData - Personal identification data
   * @param {string} masterCode - pocketOne MasterCode
   * @param {string} issuingCountry - ISO 3166-1 alpha-2 country code
   */
  static create(personalData, masterCode, issuingCountry = 'ZA') {
    const now = new Date();
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 5); // 5-year validity

    const credentialId = crypto.randomUUID();

    const pid = {
      version: '1.0',
      namespace: EIDAS2_NAMESPACE,
      docType: PID_DOC_TYPES.PID,
      credentialId,
      issuanceDate: now.toISOString(),
      expiryDate: expiry.toISOString(),
      issuingCountry,
      issuingAuthority: this.getIssuingAuthority(issuingCountry),

      // Personal Identification Data
      claims: {
        // Mandatory claims
        family_name: personalData.lastName,
        given_name: personalData.firstName,
        birth_date: personalData.dateOfBirth,

        // Optional claims
        family_name_birth: personalData.birthName || null,
        given_name_birth: personalData.birthGivenName || null,
        birth_place: personalData.birthPlace || null,
        birth_city: personalData.birthCity || null,
        birth_state: personalData.birthState || null,
        birth_country: personalData.birthCountry || null,
        gender: personalData.gender || null,
        nationality: personalData.nationality || issuingCountry,

        // Resident address (optional)
        resident_address: personalData.address || null,
        resident_city: personalData.city || null,
        resident_postal_code: personalData.postalCode || null,
        resident_state: personalData.state || null,
        resident_country: personalData.country || issuingCountry,

        // National identifier
        personal_identifier: this.generatePersonalIdentifier(personalData, issuingCountry),

        // Age verification predicates (computed)
        ...this.computeAgePredicates(personalData.dateOfBirth),

        // Document metadata
        document_number: personalData.documentNumber || null,
        administrative_number: personalData.adminNumber || null,
        issuing_jurisdiction: personalData.jurisdiction || issuingCountry,
      },

      // pocketOne extensions
      extensions: {
        masterCode,
        masterCodeHash: crypto.createHash('sha256').update(masterCode).digest('hex'),
        biometricBinding: personalData.biometricHash || null,
        deviceBinding: personalData.deviceId || null,
      },

      // Validity information
      validity: {
        signed: now.toISOString(),
        validFrom: now.toISOString(),
        validUntil: expiry.toISOString(),
      },

      // Security features
      security: {
        hashAlgorithm: 'SHA-256',
        signatureAlgorithm: 'ES256',
        issuerSignature: null, // To be filled by HSM
        subjectConfirmation: 'holder-of-key',
      },
    };

    return pid;
  }

  /**
   * Generate personal identifier based on country
   */
  static generatePersonalIdentifier(personalData, country) {
    const mapping = COUNTRY_CLAIM_MAPPINGS[country] || COUNTRY_CLAIM_MAPPINGS.EU;
    const idField = mapping.nationalId || 'personal_identifier';

    // Use provided national ID or generate a pseudonymous identifier
    if (personalData.nationalId) {
      return personalData.nationalId;
    }

    // Generate pseudonymous identifier
    const data = `${personalData.lastName}:${personalData.firstName}:${personalData.dateOfBirth}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Get issuing authority for a country
   */
  static getIssuingAuthority(country) {
    const authorities = {
      ZA: 'Department of Home Affairs, Republic of South Africa',
      DE: 'Bundesrepublik Deutschland',
      FR: 'Republique Francaise',
      NL: 'Koninkrijk der Nederlanden',
      BE: 'Kingdom of Belgium',
      IT: 'Repubblica Italiana',
      ES: 'Reino de Espana',
      PT: 'Republica Portuguesa',
      AT: 'Republik Osterreich',
      GB: 'United Kingdom of Great Britain and Northern Ireland',
      EU: 'European Union Digital Identity',
    };
    return authorities[country] || `Government of ${country}`;
  }

  /**
   * Compute age verification predicates from date of birth
   */
  static computeAgePredicates(dateOfBirth) {
    const dob = new Date(dateOfBirth);
    const today = new Date();

    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    const predicates = {
      age_in_years: age,
      age_birth_year: dob.getFullYear(),
    };

    // Compute all age predicates
    for (const [predicate, threshold] of Object.entries(AGE_PREDICATES)) {
      predicates[predicate] = age >= threshold;
    }

    return predicates;
  }

  /**
   * Verify age predicate without revealing actual age
   */
  static verifyAgePredicate(pid, predicate) {
    if (!AGE_PREDICATES[predicate]) {
      throw new Error(`Unknown age predicate: ${predicate}`);
    }

    return pid.claims[predicate] === true;
  }

  /**
   * Create selective disclosure response
   * Only includes requested claims
   */
  static selectiveDisclosure(pid, requestedClaims) {
    const disclosed = {
      version: pid.version,
      namespace: pid.namespace,
      credentialId: pid.credentialId,
      issuanceDate: pid.issuanceDate,
      issuingCountry: pid.issuingCountry,
      claims: {},
      security: pid.security,
    };

    for (const claim of requestedClaims) {
      if (pid.claims[claim] !== undefined) {
        disclosed.claims[claim] = pid.claims[claim];
      }
    }

    return disclosed;
  }

  /**
   * Map claims between country formats
   */
  static mapClaims(claims, fromCountry, toCountry) {
    const fromMapping = COUNTRY_CLAIM_MAPPINGS[fromCountry] || COUNTRY_CLAIM_MAPPINGS.EU;
    const toMapping = COUNTRY_CLAIM_MAPPINGS[toCountry] || COUNTRY_CLAIM_MAPPINGS.EU;

    const mapped = {};

    // Create reverse mapping (value -> key) for source country
    const reverseFrom = Object.entries(fromMapping).reduce((acc, [key, value]) => {
      acc[value] = key;
      return acc;
    }, {});

    for (const [claimName, claimValue] of Object.entries(claims)) {
      // Find generic key from source country format
      const genericKey = reverseFrom[claimName] || claimName;

      // Map to target country format
      const targetClaimName = toMapping[genericKey] || claimName;
      mapped[targetClaimName] = claimValue;
    }

    return mapped;
  }

  /**
   * Validate PID credential structure
   */
  static validate(pid) {
    const errors = [];

    // Required fields
    if (!pid.namespace || pid.namespace !== EIDAS2_NAMESPACE) {
      errors.push('Invalid or missing namespace');
    }

    if (!pid.claims) {
      errors.push('Missing claims');
      return { valid: false, errors };
    }

    // Mandatory claims
    const mandatoryClaims = ['family_name', 'given_name', 'birth_date'];
    for (const claim of mandatoryClaims) {
      if (!pid.claims[claim]) {
        errors.push(`Missing mandatory claim: ${claim}`);
      }
    }

    // Validate date format
    if (pid.claims.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(pid.claims.birth_date)) {
      errors.push('Invalid birth_date format (expected YYYY-MM-DD)');
    }

    // Validate expiry
    if (pid.expiryDate) {
      const expiry = new Date(pid.expiryDate);
      if (expiry < new Date()) {
        errors.push('PID has expired');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create presentation request
   */
  static createPresentationRequest(requestedClaims, verifierInfo, nonce) {
    return {
      version: '1.0',
      namespace: EIDAS2_NAMESPACE,
      nonce: nonce || crypto.randomUUID(),
      verifier: {
        id: verifierInfo.id,
        name: verifierInfo.name,
        logo: verifierInfo.logo || null,
        purpose: verifierInfo.purpose,
        privacyPolicy: verifierInfo.privacyPolicy || null,
      },
      requestedClaims,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minute expiry
    };
  }

  /**
   * Serialize PID for CBOR encoding (ISO 18013-5 compatible)
   */
  static toCBORStructure(pid) {
    return {
      docType: pid.docType || PID_DOC_TYPES.PID,
      namespaces: {
        [EIDAS2_NAMESPACE]: Object.entries(pid.claims)
          .filter(([_, value]) => value !== null)
          .map(([name, value]) => ({
            digestId: crypto.randomInt(0, 0xffffffff),
            elementIdentifier: name,
            elementValue: value,
          })),
      },
      issuerAuth: pid.security?.issuerSignature || null,
    };
  }
}

/**
 * PID Verifier utilities
 */
export class PIDVerifier {
  /**
   * Verify PID signature (placeholder - real implementation uses HSM)
   */
  static async verifySignature(pid, publicKey) {
    if (!pid.security?.issuerSignature) {
      return { verified: false, error: 'No signature present' };
    }

    // In production, verify using the issuer's public key
    // For now, return structure for HSM verification
    return {
      verified: true,
      algorithm: pid.security.signatureAlgorithm,
      issuer: pid.issuingAuthority,
      signedAt: pid.validity?.signed,
    };
  }

  /**
   * Verify PID is not expired
   */
  static isValid(pid) {
    const now = new Date();

    if (!pid.validity) {
      return false;
    }

    const validFrom = new Date(pid.validity.validFrom);
    const validUntil = new Date(pid.validity.validUntil);

    return now >= validFrom && now <= validUntil;
  }

  /**
   * Check if PID was issued by trusted authority
   */
  static isTrustedIssuer(pid, trustedIssuers) {
    return trustedIssuers.includes(pid.issuingAuthority);
  }
}

export default { EiDAS2PID, PIDVerifier, EIDAS2_NAMESPACE, PID_DOC_TYPES, AGE_PREDICATES, COUNTRY_CLAIM_MAPPINGS };
