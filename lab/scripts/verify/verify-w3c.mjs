/**
 * W3C DID/VC Verifier
 * Validates DID Documents and Verifiable Credentials
 */

import { decodeJwt, decodeProtectedHeader } from 'jose';

/**
 * Verify a W3C DID/VC payload
 * @param {object} w3cPayload - The W3C payload to verify
 * @returns {object} Verification result
 */
export async function verifyW3C(w3cPayload) {
  const errors = [];
  const warnings = [];
  const checks = {};

  try {
    // Check 1: Validate payload structure
    checks.structure = validateStructure(w3cPayload, errors);

    // Check 2: Validate required claims (tc, mc)
    checks.claims = validateClaims(w3cPayload, errors);

    // Check 3: Validate DID Documents
    if (w3cPayload.data?.didDocuments) {
      checks.didDocuments = validateDIDDocuments(w3cPayload.data.didDocuments, errors, warnings);
    }

    // Check 4: Validate Verifiable Credential structure
    checks.vcStructure = validateVCStructure(w3cPayload, errors, warnings);

    // Check 5: Validate JWT-VC format
    if (w3cPayload.data?.credentialJWT) {
      checks.jwtVC = validateJWTVC(w3cPayload, errors, warnings);
    }

    // Check 6: Validate proof
    if (w3cPayload.data?.credential?.proof) {
      checks.proof = validateProof(w3cPayload.data.credential.proof, errors, warnings);
    }

    // Check 7: Validate issuer DID
    checks.issuer = validateIssuerDID(w3cPayload, errors);

    const verified = errors.length === 0;

    return {
      success: true,
      verified,
      family: 'W3C DID/VC',
      type: 'Verifiable Credential',
      checks,
      errors,
      warnings,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      verified: false,
      family: 'W3C DID/VC',
      type: 'Verifiable Credential',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Validate W3C payload structure
 */
function validateStructure(payload, errors) {
  const required = ['success', 'family', 'type', 'data', 'claims', 'metadata'];
  const missing = required.filter(field => !(field in payload));

  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
    return false;
  }

  if (payload.family !== 'W3C DID/VC') {
    errors.push(`Invalid family: expected 'W3C DID/VC', got '${payload.family}'`);
    return false;
  }

  return true;
}

/**
 * Validate required claims (tc, mc)
 */
function validateClaims(payload, errors) {
  const claims = payload.claims || {};

  if (!claims.tc) {
    errors.push('Missing required claim: tc (trustCode)');
    return false;
  }

  if (!claims.mc) {
    errors.push('Missing required claim: mc (masterCode)');
    return false;
  }

  if (!claims.tc.startsWith('TC-')) {
    errors.push(`Invalid tc format: ${claims.tc}`);
  }

  if (!claims.mc.startsWith('MC-')) {
    errors.push(`Invalid mc format: ${claims.mc}`);
  }

  return errors.length === 0;
}

/**
 * Validate DID Documents
 */
function validateDIDDocuments(didDocuments, errors, warnings) {
  let valid = true;

  // Validate did:key document
  if (didDocuments.didKey) {
    const didKeyValid = validateDIDDocument(
      didDocuments.didKey,
      'did:key',
      errors,
      warnings
    );
    valid = valid && didKeyValid;
  } else {
    warnings.push('Missing did:key document');
  }

  // Validate did:web document
  if (didDocuments.didWeb) {
    const didWebValid = validateDIDDocument(
      didDocuments.didWeb,
      'did:web',
      errors,
      warnings
    );
    valid = valid && didWebValid;
  } else {
    warnings.push('Missing did:web document');
  }

  return valid;
}

/**
 * Validate a single DID Document
 */
function validateDIDDocument(document, expectedMethod, errors, warnings) {
  if (!document['@context']) {
    errors.push(`DID Document (${expectedMethod}) missing @context`);
    return false;
  }

  if (!document.id) {
    errors.push(`DID Document (${expectedMethod}) missing id`);
    return false;
  }

  if (!document.id.startsWith(expectedMethod)) {
    errors.push(
      `DID Document id doesn't match method: ${document.id} (expected ${expectedMethod})`
    );
  }

  if (!document.verificationMethod || !Array.isArray(document.verificationMethod)) {
    errors.push(`DID Document (${expectedMethod}) missing verificationMethod array`);
    return false;
  }

  if (document.verificationMethod.length === 0) {
    errors.push(`DID Document (${expectedMethod}) has empty verificationMethod array`);
  }

  // Validate each verification method
  for (const vm of document.verificationMethod) {
    if (!vm.id) {
      errors.push(`Verification method missing id`);
    }
    if (!vm.type) {
      errors.push(`Verification method missing type`);
    }
    if (!vm.controller) {
      errors.push(`Verification method missing controller`);
    }
  }

  // Check for authentication
  if (!document.authentication || document.authentication.length === 0) {
    warnings.push(`DID Document (${expectedMethod}) missing authentication`);
  }

  // Check for assertionMethod
  if (!document.assertionMethod || document.assertionMethod.length === 0) {
    warnings.push(`DID Document (${expectedMethod}) missing assertionMethod`);
  }

  return errors.length === 0;
}

/**
 * Validate Verifiable Credential structure
 */
function validateVCStructure(payload, errors, warnings) {
  const vc = payload.data?.credential?.vc;

  if (!vc) {
    errors.push('Missing vc in credential data');
    return false;
  }

  // W3C VC Data Model 1.1 requirements
  if (!vc['@context']) {
    errors.push('VC missing @context');
  } else if (!Array.isArray(vc['@context'])) {
    errors.push('VC @context must be an array');
  } else if (!vc['@context'].includes('https://www.w3.org/2018/credentials/v1')) {
    errors.push('VC @context must include https://www.w3.org/2018/credentials/v1');
  }

  if (!vc.type || !Array.isArray(vc.type)) {
    errors.push('VC type must be an array');
  } else if (!vc.type.includes('VerifiableCredential')) {
    errors.push('VC type must include VerifiableCredential');
  }

  if (!vc.issuer) {
    errors.push('VC missing issuer');
  }

  if (!vc.issuanceDate) {
    errors.push('VC missing issuanceDate');
  }

  if (!vc.credentialSubject) {
    errors.push('VC missing credentialSubject');
  } else {
    // Validate credential subject
    if (!vc.credentialSubject.id) {
      warnings.push('VC credentialSubject missing id');
    }

    // Check for tc/mc in credentialSubject
    if (!vc.credentialSubject.trustCode) {
      warnings.push('VC credentialSubject missing trustCode');
    }

    if (!vc.credentialSubject.masterCode) {
      warnings.push('VC credentialSubject missing masterCode');
    }
  }

  if (!vc.expirationDate) {
    warnings.push('VC missing expirationDate');
  }

  return errors.length === 0;
}

/**
 * Validate JWT-VC format
 */
function validateJWTVC(payload, errors, warnings) {
  const jwt = payload.data?.credentialJWT;

  if (!jwt) {
    errors.push('Missing credentialJWT');
    return false;
  }

  const parts = jwt.split('.');
  if (parts.length !== 3) {
    errors.push(`Invalid JWT structure: expected 3 parts, got ${parts.length}`);
    return false;
  }

  try {
    // Decode header
    const header = decodeProtectedHeader(jwt);

    if (!header.alg) {
      errors.push('JWT header missing alg');
    }

    if (!header.kid) {
      warnings.push('JWT header missing kid');
    }

    // Decode payload
    const jwtPayload = decodeJwt(jwt);

    // VC-JWT requirements
    if (!jwtPayload.iss) {
      errors.push('JWT payload missing iss');
    }

    if (!jwtPayload.sub) {
      errors.push('JWT payload missing sub');
    }

    if (!jwtPayload.iat) {
      errors.push('JWT payload missing iat');
    }

    if (!jwtPayload.exp) {
      warnings.push('JWT payload missing exp');
    }

    if (!jwtPayload.vc) {
      errors.push('JWT payload missing vc claim');
    }

    // Check for tc/mc in JWT payload
    if (!jwtPayload.tc) {
      errors.push('JWT payload missing tc claim');
    }

    if (!jwtPayload.mc) {
      errors.push('JWT payload missing mc claim');
    }

  } catch (e) {
    errors.push(`Failed to decode JWT: ${e.message}`);
    return false;
  }

  return errors.length === 0;
}

/**
 * Validate proof structure
 */
function validateProof(proof, errors, warnings) {
  if (!proof.type) {
    errors.push('Proof missing type');
  }

  if (!proof.created) {
    warnings.push('Proof missing created timestamp');
  }

  if (!proof.proofPurpose) {
    errors.push('Proof missing proofPurpose');
  }

  if (!proof.verificationMethod) {
    errors.push('Proof missing verificationMethod');
  }

  if (proof.type === 'JwtProof2020' && !proof.jws) {
    errors.push('JwtProof2020 missing jws');
  }

  return errors.length === 0;
}

/**
 * Validate issuer DID
 */
function validateIssuerDID(payload, errors) {
  const issuer = payload.claims?.issuer;

  if (!issuer) {
    errors.push('Missing issuer in claims');
    return false;
  }

  // Issuer should be a DID or HTTPS URL
  if (!issuer.startsWith('did:') && !issuer.startsWith('https://')) {
    errors.push(`Invalid issuer format: ${issuer} (must be DID or HTTPS URL)`);
    return false;
  }

  return true;
}

export default {
  verifyW3C,
};
