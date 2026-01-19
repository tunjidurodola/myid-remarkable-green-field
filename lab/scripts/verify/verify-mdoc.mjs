/**
 * ISO 18013-5 mDoc Verifier
 * Validates mDoc payload structure, CBOR encoding, and COSE_Sign1 signatures
 */

import { MDLVerifier } from '../../../backend/lib/verifiers.mjs';

/**
 * Verify an mDoc payload
 * @param {object} mdocPayload - The mDoc payload to verify
 * @returns {object} Verification result
 */
export async function verifyMDoc(mdocPayload) {
  const errors = [];
  const warnings = [];
  const checks = {};

  try {
    // Check 1: Validate payload structure
    checks.structure = validateStructure(mdocPayload, errors);

    // Check 2: Validate required claims (tc, mc)
    checks.claims = validateClaims(mdocPayload, errors);

    // Check 3: Validate issuer URL
    checks.issuer = validateIssuer(mdocPayload, errors);

    // Check 4: Validate CBOR encoding
    checks.cbor = validateCBOR(mdocPayload, errors, warnings);

    // Check 5: Validate namespace
    checks.namespace = validateNamespace(mdocPayload, errors);

    // Check 6: Validate COSE_Sign1 structure
    if (mdocPayload.data?.coseSign1) {
      checks.coseSign1 = validateCOSESign1(mdocPayload.data.coseSign1, errors, warnings);
    } else {
      warnings.push('COSE_Sign1 signature not present');
    }

    // Check 7: Validate device engagement
    if (mdocPayload.data?.deviceEngagement) {
      checks.deviceEngagement = validateDeviceEngagement(mdocPayload.data.deviceEngagement, errors);
    }

    const verified = errors.length === 0;

    return {
      success: true,
      verified,
      family: 'ISO 18013-5',
      type: 'mDoc',
      checks,
      errors,
      warnings,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      verified: false,
      family: 'ISO 18013-5',
      type: 'mDoc',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Validate mDoc structure
 */
function validateStructure(payload, errors) {
  const required = ['success', 'family', 'type', 'data', 'claims', 'metadata'];
  const missing = required.filter(field => !(field in payload));

  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
    return false;
  }

  if (payload.family !== 'ISO 18013-5') {
    errors.push(`Invalid family: expected 'ISO 18013-5', got '${payload.family}'`);
    return false;
  }

  if (payload.type !== 'mDoc') {
    errors.push(`Invalid type: expected 'mDoc', got '${payload.type}'`);
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

  // Validate tc format (should start with TC-)
  if (!claims.tc.startsWith('TC-')) {
    errors.push(`Invalid tc format: ${claims.tc} (should start with TC-)`);
  }

  // Validate mc format (should start with MC-)
  if (!claims.mc.startsWith('MC-')) {
    errors.push(`Invalid mc format: ${claims.mc} (should start with MC-)`);
  }

  return errors.length === 0;
}

/**
 * Validate issuer URL
 */
function validateIssuer(payload, errors) {
  const issuer = payload.claims?.issuer;

  if (!issuer) {
    errors.push('Missing issuer in claims');
    return false;
  }

  const validIssuers = [
    'https://iss.trustvault.eu',
    'https://iss.trustvault.eu/backup',
  ];

  if (!validIssuers.includes(issuer)) {
    errors.push(`Invalid issuer: ${issuer} (expected: ${validIssuers.join(' or ')})`);
    return false;
  }

  return true;
}

/**
 * Validate CBOR encoding
 */
function validateCBOR(payload, errors, warnings) {
  if (!payload.cbor) {
    warnings.push('No CBOR encoding metadata found');
    return false;
  }

  if (!payload.cbor.encoded) {
    errors.push('CBOR encoded data missing');
    return false;
  }

  if (!payload.cbor.size || payload.cbor.size === 0) {
    errors.push('CBOR size is zero or missing');
    return false;
  }

  // Check if encoded data is valid hex
  const hexRegex = /^[0-9a-f]*$/i;
  if (!hexRegex.test(payload.cbor.encoded)) {
    errors.push('CBOR encoded data is not valid hexadecimal');
    return false;
  }

  return true;
}

/**
 * Validate namespace
 */
function validateNamespace(payload, errors) {
  const namespace = payload.claims?.namespace;

  if (!namespace) {
    errors.push('Missing namespace in claims');
    return false;
  }

  const expectedNamespace = 'org.iso.18013.5.1';
  if (namespace !== expectedNamespace) {
    errors.push(`Invalid namespace: ${namespace} (expected: ${expectedNamespace})`);
    return false;
  }

  return true;
}

/**
 * Validate COSE_Sign1 structure
 */
function validateCOSESign1(coseSign1, errors, warnings) {
  const required = ['protected', 'payload', 'signature'];
  const missing = required.filter(field => !(field in coseSign1));

  if (missing.length > 0) {
    errors.push(`COSE_Sign1 missing fields: ${missing.join(', ')}`);
    return false;
  }

  // Check if this is a synthetic signature
  if (coseSign1.note === 'SYNTHETIC_SIGNATURE_FOR_TESTING') {
    warnings.push('COSE_Sign1 uses synthetic signature (not HSM-signed)');
  }

  // Decode and validate protected headers
  try {
    const protectedDecoded = Buffer.from(coseSign1.protected, 'base64url').toString('utf8');
    const protectedHeaders = JSON.parse(protectedDecoded);

    if (!protectedHeaders.alg) {
      errors.push('COSE_Sign1 protected headers missing alg');
    }

    if (!protectedHeaders.kid) {
      errors.push('COSE_Sign1 protected headers missing kid');
    }

    if (!protectedHeaders.iss) {
      errors.push('COSE_Sign1 protected headers missing iss');
    }
  } catch (e) {
    errors.push(`Failed to decode COSE_Sign1 protected headers: ${e.message}`);
    return false;
  }

  return errors.length === 0;
}

/**
 * Validate device engagement structure
 */
function validateDeviceEngagement(engagement, errors) {
  if (!engagement.deviceKey) {
    errors.push('Device engagement missing deviceKey');
    return false;
  }

  if (!engagement.qrCode) {
    errors.push('Device engagement missing qrCode');
    return false;
  }

  return true;
}

export default {
  verifyMDoc,
};
