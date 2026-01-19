/**
 * eIDAS2 SD-JWT-VCI Verifier
 * Validates SD-JWT format, disclosures, and claim integrity
 */

import crypto from 'crypto';
import { base64url, decodeJwt, decodeProtectedHeader } from 'jose';

/**
 * Verify an SD-JWT credential
 * @param {object} sdJWTPayload - The SD-JWT payload to verify
 * @returns {object} Verification result
 */
export async function verifySDJWT(sdJWTPayload) {
  const errors = [];
  const warnings = [];
  const checks = {};

  try {
    // Check 1: Validate payload structure
    checks.structure = validateStructure(sdJWTPayload, errors);

    // Check 2: Validate required claims (tc, mc)
    checks.claims = validateClaims(sdJWTPayload, errors);

    // Check 3: Validate issuer and audience
    checks.issuerAudience = validateIssuerAudience(sdJWTPayload, errors);

    // Check 4: Validate JWT structure
    checks.jwt = validateJWTStructure(sdJWTPayload, errors, warnings);

    // Check 5: Validate SD-JWT format
    checks.sdFormat = validateSDJWTFormat(sdJWTPayload, errors);

    // Check 6: Validate disclosures
    if (sdJWTPayload.data?.disclosures?.length > 0) {
      checks.disclosures = validateDisclosures(sdJWTPayload, errors, warnings);
    } else {
      warnings.push('No disclosures present');
    }

    // Check 7: Validate timestamps (iat, exp, nbf)
    checks.timestamps = validateTimestamps(sdJWTPayload, errors, warnings);

    // Check 8: Validate namespace (vct)
    checks.namespace = validateNamespace(sdJWTPayload, errors);

    const verified = errors.length === 0;

    return {
      success: true,
      verified,
      family: 'eIDAS2 SD-JWT-VCI',
      type: 'SD-JWT',
      checks,
      errors,
      warnings,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      verified: false,
      family: 'eIDAS2 SD-JWT-VCI',
      type: 'SD-JWT',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Validate SD-JWT structure
 */
function validateStructure(payload, errors) {
  const required = ['success', 'family', 'type', 'data', 'claims', 'metadata'];
  const missing = required.filter(field => !(field in payload));

  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
    return false;
  }

  if (payload.family !== 'eIDAS2 SD-JWT-VCI') {
    errors.push(`Invalid family: expected 'eIDAS2 SD-JWT-VCI', got '${payload.family}'`);
    return false;
  }

  if (payload.type !== 'SD-JWT') {
    errors.push(`Invalid type: expected 'SD-JWT', got '${payload.type}'`);
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

  // Validate tc format
  if (!claims.tc.startsWith('TC-')) {
    errors.push(`Invalid tc format: ${claims.tc} (should start with TC-)`);
  }

  // Validate mc format
  if (!claims.mc.startsWith('MC-')) {
    errors.push(`Invalid mc format: ${claims.mc} (should start with MC-)`);
  }

  return errors.length === 0;
}

/**
 * Validate issuer and audience
 */
function validateIssuerAudience(payload, errors) {
  const issuer = payload.claims?.issuer;
  const audience = payload.claims?.audience;

  if (!issuer) {
    errors.push('Missing issuer in claims');
    return false;
  }

  if (!audience) {
    errors.push('Missing audience in claims');
    return false;
  }

  const validIssuers = [
    'https://iss.trustvault.eu',
    'https://iss.trustvault.eu/backup',
  ];

  const validAudiences = [
    'https://aud.pocket.one',
    'https://aud.pocket.one/mobile',
    'https://aud.pocket.one/web',
  ];

  if (!validIssuers.includes(issuer)) {
    errors.push(`Invalid issuer: ${issuer}`);
  }

  if (!validAudiences.includes(audience)) {
    errors.push(`Invalid audience: ${audience}`);
  }

  return errors.length === 0;
}

/**
 * Validate JWT structure
 */
function validateJWTStructure(payload, errors, warnings) {
  if (!payload.data?.jwt) {
    errors.push('Missing JWT in data');
    return false;
  }

  const jwt = payload.data.jwt;
  const parts = jwt.split('.');

  if (parts.length !== 3) {
    errors.push(`Invalid JWT structure: expected 3 parts, got ${parts.length}`);
    return false;
  }

  try {
    // Decode and validate header
    const header = decodeProtectedHeader(jwt);

    if (!header.alg) {
      errors.push('JWT header missing alg');
    }

    if (!header.typ) {
      warnings.push('JWT header missing typ');
    }

    if (!header.kid) {
      warnings.push('JWT header missing kid');
    }

    // Decode and validate payload
    const decodedPayload = decodeJwt(jwt);

    if (!decodedPayload.iss) {
      errors.push('JWT payload missing iss');
    }

    if (!decodedPayload.aud) {
      errors.push('JWT payload missing aud');
    }

    if (!decodedPayload.sub) {
      errors.push('JWT payload missing sub');
    }

    if (!decodedPayload.jti) {
      warnings.push('JWT payload missing jti');
    }

    // Check for SD-JWT specific claims
    if (!decodedPayload._sd_alg) {
      errors.push('JWT payload missing _sd_alg');
    } else if (decodedPayload._sd_alg !== 'sha-256') {
      errors.push(`Invalid _sd_alg: ${decodedPayload._sd_alg} (expected: sha-256)`);
    }

    if (!decodedPayload._sd || !Array.isArray(decodedPayload._sd)) {
      errors.push('JWT payload missing or invalid _sd array');
    }

  } catch (e) {
    errors.push(`Failed to decode JWT: ${e.message}`);
    return false;
  }

  return errors.length === 0;
}

/**
 * Validate SD-JWT format
 */
function validateSDJWTFormat(payload, errors) {
  if (!payload.data?.sdJWT) {
    errors.push('Missing sdJWT in data');
    return false;
  }

  const sdJWT = payload.data.sdJWT;
  const parts = sdJWT.split('~');

  if (parts.length < 2) {
    errors.push('Invalid SD-JWT format: must contain at least JWT~');
    return false;
  }

  // First part should be valid JWT
  const jwt = parts[0];
  const jwtParts = jwt.split('.');
  if (jwtParts.length !== 3) {
    errors.push('Invalid JWT in SD-JWT');
    return false;
  }

  // Should end with ~
  if (!sdJWT.endsWith('~')) {
    errors.push('SD-JWT should end with ~');
  }

  return errors.length === 0;
}

/**
 * Validate disclosures
 */
function validateDisclosures(payload, errors, warnings) {
  const disclosures = payload.data?.disclosures || [];
  const jwt = payload.data?.jwt;

  if (!jwt) {
    errors.push('Cannot validate disclosures: JWT missing');
    return false;
  }

  try {
    const decodedPayload = decodeJwt(jwt);
    const expectedDigests = decodedPayload._sd || [];

    // Verify each disclosure
    for (const disclosure of disclosures) {
      if (!disclosure.disclosure) {
        errors.push('Disclosure missing disclosure field');
        continue;
      }

      // Recalculate digest
      const calculatedDigest = base64url.encode(
        crypto.createHash('sha256').update(disclosure.disclosure).digest()
      );

      // Check if digest is in JWT's _sd array
      if (!expectedDigests.includes(calculatedDigest)) {
        errors.push(`Disclosure digest mismatch for field: ${disclosure.field}`);
      }

      // Verify stored digest matches
      if (disclosure.digest && disclosure.digest !== calculatedDigest) {
        errors.push(`Stored digest mismatch for field: ${disclosure.field}`);
      }
    }

    // Check if all digests in JWT have corresponding disclosures
    if (disclosures.length !== expectedDigests.length) {
      warnings.push(
        `Disclosure count mismatch: ${disclosures.length} provided, ${expectedDigests.length} expected`
      );
    }

  } catch (e) {
    errors.push(`Failed to validate disclosures: ${e.message}`);
    return false;
  }

  return errors.length === 0;
}

/**
 * Validate timestamps
 */
function validateTimestamps(payload, errors, warnings) {
  if (!payload.data?.payload) {
    warnings.push('Cannot validate timestamps: payload missing');
    return false;
  }

  const { iat, exp, nbf } = payload.data.payload;
  const now = Math.floor(Date.now() / 1000);

  if (!iat) {
    errors.push('Missing iat (issued at) timestamp');
  }

  if (!exp) {
    errors.push('Missing exp (expiration) timestamp');
  }

  if (nbf === undefined) {
    warnings.push('Missing nbf (not before) timestamp');
  }

  // Check if token is expired
  if (exp && exp < now) {
    warnings.push('Token is expired');
  }

  // Check if token is not yet valid
  if (nbf && nbf > now) {
    warnings.push('Token is not yet valid (nbf in future)');
  }

  // Check if exp is after iat
  if (iat && exp && exp <= iat) {
    errors.push('exp must be after iat');
  }

  return errors.length === 0;
}

/**
 * Validate namespace (vct)
 */
function validateNamespace(payload, errors) {
  const namespace = payload.claims?.namespace;

  if (!namespace) {
    errors.push('Missing namespace in claims');
    return false;
  }

  const expectedNamespace = 'eu.europa.ec.eudi.pid.1';
  if (namespace !== expectedNamespace) {
    errors.push(`Invalid namespace: ${namespace} (expected: ${expectedNamespace})`);
    return false;
  }

  return true;
}

export default {
  verifySDJWT,
};
