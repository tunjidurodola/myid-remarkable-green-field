/**
 * eIDAS2 SD-JWT-VCI Generator
 * Generates SD-JWT (Selective Disclosure JWT) credentials with disclosures
 */

import crypto from 'crypto';
import { SignJWT, base64url, importPKCS8 } from 'jose';

const POLICY = {
  namespace: 'eu.europa.ec.eudi.pid.1',
  issuer: 'https://iss.trustvault.eu',
  audience: 'https://aud.pocket.one',
  slot: '0002',
};

/**
 * Generate an SD-JWT credential with disclosures
 * @param {object} options - Generation options
 * @returns {object} Generated SD-JWT with disclosures
 */
export async function generateSDJWT(options = {}) {
  const {
    trustCode = 'TC-TEST-SDJWT-001',
    masterCode = 'MC-MASTER-SDJWT-001',
    includeDisclosures = true,
  } = options;

  try {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 365 * 24 * 60 * 60; // 1 year

    // Create personal identification data
    const pidData = {
      family_name: 'Smith',
      given_name: 'John',
      birth_date: '1985-05-20',
      age_over_18: true,
      age_over_21: true,
      age_over_65: false,
      nationality: 'ZA',
      personal_identifier: `ZA${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      issuing_country: 'ZA',
      issuing_authority: 'Department of Home Affairs',
      issuance_date: '2024-01-01',
      expiry_date: '2034-01-01',
    };

    // Generate disclosures for selective disclosure
    const disclosures = includeDisclosures ? generateDisclosures(pidData) : [];

    // Create disclosure digests for JWT claims
    const disclosureDigests = disclosures.map(d =>
      base64url.encode(crypto.createHash('sha256').update(d.disclosure).digest())
    );

    // Build JWT payload with SD claims
    const payload = {
      iss: POLICY.issuer,
      aud: POLICY.audience,
      sub: pidData.personal_identifier,
      iat: now,
      nbf: now,
      exp: now + expiresIn,
      jti: crypto.randomUUID(),

      // SD-JWT specific
      _sd_alg: 'sha-256',
      _sd: disclosureDigests,

      // pocketOne claims
      tc: trustCode,
      mc: masterCode,

      // Non-selective claims (always visible)
      vct: POLICY.namespace,
      issuing_country: pidData.issuing_country,
    };

    // Generate synthetic JWT (in production, this would use HSM signing)
    const jwt = await generateSyntheticJWT(payload);

    // Construct SD-JWT format: <JWT>~<disclosure-1>~<disclosure-2>~...~
    const sdJWT = includeDisclosures
      ? `${jwt}~${disclosures.map(d => d.disclosure).join('~')}~`
      : jwt;

    return {
      success: true,
      family: 'eIDAS2 SD-JWT-VCI',
      type: 'SD-JWT',
      data: {
        jwt,
        sdJWT,
        disclosures: includeDisclosures ? disclosures : [],
        payload,
      },
      claims: {
        tc: trustCode,
        mc: masterCode,
        issuer: POLICY.issuer,
        audience: POLICY.audience,
        namespace: POLICY.namespace,
        subject: pidData.personal_identifier,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        slot: POLICY.slot,
        sdAlg: 'sha-256',
        disclosureCount: disclosures.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      family: 'eIDAS2 SD-JWT-VCI',
      type: 'SD-JWT',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Generate disclosures for selective disclosure
 * Disclosure format: base64url(salt + claim_name + claim_value)
 */
function generateDisclosures(data) {
  const disclosures = [];

  // Create a disclosure for each selectively disclosable claim
  const selectiveFields = [
    'family_name',
    'given_name',
    'birth_date',
    'age_over_18',
    'age_over_21',
    'age_over_65',
    'nationality',
    'personal_identifier',
    'issuing_authority',
    'issuance_date',
    'expiry_date',
  ];

  for (const field of selectiveFields) {
    if (field in data) {
      const salt = base64url.encode(crypto.randomBytes(16));
      const disclosureArray = [salt, field, data[field]];
      const disclosureJson = JSON.stringify(disclosureArray);
      const disclosure = base64url.encode(Buffer.from(disclosureJson, 'utf8'));

      // Calculate digest
      const digest = base64url.encode(
        crypto.createHash('sha256').update(disclosure).digest()
      );

      disclosures.push({
        field,
        disclosure,
        digest,
        value: data[field],
      });
    }
  }

  return disclosures;
}

/**
 * Generate synthetic JWT
 * In production, this would use HSM via backend/lib/hsm-signer.mjs
 */
async function generateSyntheticJWT(payload) {
  // Generate a synthetic key pair for testing
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });

  // Export private key in PEM format for jose
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' });

  // Import the key using jose's importPKCS8
  const key = await importPKCS8(privateKeyPem, 'ES256');

  // Create JWT using jose library
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({
      alg: 'ES256',
      typ: 'JWT',
      kid: 'sdjwt_issuer_key_synthetic',
    })
    .sign(key);

  return jwt;
}

/**
 * Validate SD-JWT format
 */
export function validateSDJWTFormat(sdJWT) {
  try {
    const parts = sdJWT.split('~');

    if (parts.length < 2) {
      return {
        valid: false,
        error: 'Invalid SD-JWT format: must contain at least JWT~',
      };
    }

    const jwt = parts[0];
    const disclosures = parts.slice(1, -1); // Last element is empty after trailing ~

    // Validate JWT structure (3 parts separated by .)
    const jwtParts = jwt.split('.');
    if (jwtParts.length !== 3) {
      return {
        valid: false,
        error: 'Invalid JWT structure: must have 3 parts',
      };
    }

    return {
      valid: true,
      jwt,
      disclosureCount: disclosures.length,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

export default {
  generateSDJWT,
  validateSDJWTFormat,
};
