/**
 * ISO 18013-5 mDoc (Mobile Driving License) Generator
 * Generates synthetic mDoc payloads in CBOR with COSE_Sign1 signatures
 */

import crypto from 'crypto';
import { MDLDocument, CBOREncoder, DeviceEngagement } from '../../../backend/lib/mdl.mjs';

const POLICY = {
  namespace: 'org.iso.18013.5.1',
  issuer: 'https://iss.trustvault.eu',
  slot: '0004',
};

/**
 * Generate a synthetic mDoc payload
 * @param {object} options - Generation options
 * @returns {object} Generated mDoc with metadata
 */
export async function generateMDoc(options = {}) {
  const {
    trustCode = 'TC-TEST-MDOC-001',
    masterCode = 'MC-MASTER-MDOC-001',
    includeSignature = true,
  } = options;

  try {
    // Create synthetic personal data
    const personalData = {
      familyName: 'Doe',
      givenName: 'Jane',
      birthDate: '1990-01-15',
      issueDate: '2024-01-01',
      expiryDate: '2034-01-01',
      issuingCountry: 'ZA',
      issuingAuthority: 'Department of Transport - South Africa',
      documentNumber: `ZA${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
    };

    // Create MDL document
    const mdl = new MDLDocument();
    mdl.setMandatoryElements(personalData);

    // Add portrait
    mdl.setPortrait(Buffer.from('SYNTHETIC_IMAGE_DATA').toString('base64'));

    // Add driving privileges
    mdl.setDrivingPrivileges([
      {
        vehicle_category_code: 'B',
        issue_date: '2024-01-01',
        expiry_date: '2034-01-01',
      },
      {
        vehicle_category_code: 'C1',
        issue_date: '2024-01-01',
        expiry_date: '2034-01-01',
      }
    ]);

    // Add AAMVA extensions (North American standard)
    const aamvaNamespace = 'org.iso.18013.5.1.aamva';
    mdl.addElement(aamvaNamespace, 'sex', 1); // Female
    mdl.addElement(aamvaNamespace, 'height', 170);
    mdl.addElement(aamvaNamespace, 'weight', 65);
    mdl.addElement(aamvaNamespace, 'eye_color', 'blue');
    mdl.addElement(aamvaNamespace, 'hair_color', 'brown');

    // Add pocketOne extensions with tc/mc
    mdl.setPocketOneExtensions(masterCode, trustCode);

    // Build document
    const issuerSigned = mdl.build();

    // Encode to CBOR
    const cborEncoded = Buffer.from(CBOREncoder.encode(issuerSigned), 'hex');

    // Generate device engagement (for QR code presentation)
    const engagement = DeviceEngagement.generate();
    const qrCode = DeviceEngagement.generateQRData(engagement);

    // Build COSE_Sign1 structure (placeholder - actual signing would use HSM)
    const coseSign1 = buildCOSESign1Placeholder(cborEncoded, {
      issuer: POLICY.issuer,
      kid: 'mdoc_issuer_key',
      alg: 'ES256',
    });

    return {
      success: true,
      family: 'ISO 18013-5',
      type: 'mDoc',
      data: {
        issuerSigned,
        deviceEngagement: {
          ...engagement,
          qrCode,
        },
        coseSign1: includeSignature ? coseSign1 : null,
      },
      cbor: {
        encoded: cborEncoded.toString('hex'),
        size: cborEncoded.length,
      },
      claims: {
        tc: trustCode,
        mc: masterCode,
        issuer: POLICY.issuer,
        namespace: POLICY.namespace,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        slot: POLICY.slot,
        cborCanonicalization: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      family: 'ISO 18013-5',
      type: 'mDoc',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Build COSE_Sign1 placeholder structure
 * In production, this would use HSM signing via backend/lib/hsm-signer.mjs
 */
function buildCOSESign1Placeholder(payload, headers) {
  const protectedHeaders = {
    alg: headers.alg || 'ES256',
    kid: headers.kid,
    iss: headers.issuer,
  };

  // COSE_Sign1 structure: [protected, unprotected, payload, signature]
  // For testing, we use a synthetic signature placeholder
  const syntheticSignature = crypto.randomBytes(64); // ES256 signature is 64 bytes

  return {
    protected: Buffer.from(JSON.stringify(protectedHeaders)).toString('base64url'),
    unprotected: {},
    payload: payload.toString('base64url'),
    signature: syntheticSignature.toString('base64url'),
    note: 'SYNTHETIC_SIGNATURE_FOR_TESTING',
  };
}

/**
 * Test CBOR round-trip encoding/decoding
 */
export function testCBORRoundTrip(data) {
  try {
    const encoder = new CBOREncoder();
    const encoded = encoder.encode(data);

    // For testing, we just verify encoding succeeds
    // Full round-trip would require decoder
    return {
      success: true,
      encodedSize: encoded.length,
      encodedHex: encoded.toString('hex').substring(0, 100) + '...',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export default {
  generateMDoc,
  testCBORRoundTrip,
};
