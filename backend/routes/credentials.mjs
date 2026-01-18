/**
 * Unified Credential Routes
 * Handles issuance and management of all credential types:
 * - mDL (Mobile Driver's License)
 * - PID (Personal Identification Data - eIDAS2)
 * - DTC (Digital Travel Credential - ICAO)
 * - VC (Verifiable Credentials - W3C)
 */

import { Router } from 'express';
import { getBackendSecrets } from "../lib/secrets.mjs";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import db from '../lib/db.mjs';
import redis from '../lib/redis.mjs';
import { EiDAS2PID, EIDAS2_NAMESPACE, AGE_PREDICATES } from '../lib/eidas2.mjs';
import { ICAODTCManager, MRZParser, ChipAuthSimulator, DTCSelectiveDisclosure, ICAO_NAMESPACE } from '../lib/icao-dtc.mjs';
import { DIDKey, DIDPocketOne, VerifiableCredential, VerifiablePresentation, Ed25519Signer, CONTEXTS } from '../lib/did-vc.mjs';
import { hsmSigner } from '../lib/hsm-signer.mjs';

const router = Router();

// JWT configuration
const { jwt_secret: JWT_SECRET } = await getBackendSecrets();
// Credential types
const CREDENTIAL_TYPES = {
  MDL: 'mDL',
  PID: 'PID',
  DTC: 'DTC',
  VC: 'VC',
};

/**
 * Middleware to verify JWT token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * POST /api/credentials/issue
 * Issue a new credential of any type
 *
 * Request body:
 * - type: 'mDL' | 'PID' | 'DTC' | 'VC'
 * - data: credential-specific data
 * - masterCode: user's MasterCode
 *
 * Response:
 * - credentialId: string
 * - credential: object
 */
router.post('/issue', authenticateToken, async (req, res) => {
  try {
    const { type, data, masterCode } = req.body;
    const userId = req.user.userId;

    if (!type || !CREDENTIAL_TYPES[type]) {
      return res.status(400).json({
        error: 'Invalid credential type',
        validTypes: Object.keys(CREDENTIAL_TYPES),
      });
    }

    if (!data) {
      return res.status(400).json({ error: 'Credential data is required' });
    }

    let credential;
    let credentialId = uuidv4();
    let namespace;

    switch (type) {
      case 'MDL':
        credential = await issueMDL(data, masterCode, userId);
        namespace = 'org.iso.18013.5.1.mDL';
        break;

      case 'PID':
        credential = EiDAS2PID.create(data, masterCode, data.issuingCountry || 'ZA');
        namespace = EIDAS2_NAMESPACE;

        // Sign with HSM
        const pidSignature = await hsmSigner.sign(JSON.stringify(credential));
        credential.security.issuerSignature = pidSignature.signature;
        break;

      case 'DTC':
        const trustCode = data.trustCode || crypto.randomBytes(16).toString('hex');
        credential = ICAODTCManager.create(data, masterCode, trustCode);
        namespace = ICAO_NAMESPACE;

        // Sign with HSM
        const dtcSignature = await hsmSigner.sign(
          JSON.stringify(credential.securityObject.dataGroupHashes),
        );
        credential.securityObject.signature = dtcSignature.signature;
        break;

      case 'VC':
        // Generate or use existing DID
        let issuerDID = data.issuerDID;
        let subjectDID = data.subjectDID;

        if (!issuerDID) {
          issuerDID = DIDPocketOne.fromMasterCode(masterCode || crypto.randomBytes(32).toString('hex'));
        }

        if (!subjectDID) {
          subjectDID = DIDPocketOne.fromMasterCode(userId);
        }

        credential = VerifiableCredential.create({
          issuer: issuerDID,
          subject: subjectDID,
          type: data.credentialType || 'IdentityCredential',
          claims: data.claims || {},
          validityDays: data.validityDays || 365 * 5,
        });
        namespace = CONTEXTS.CREDENTIALS_V1;

        // Sign the credential
        const keyPair = await Ed25519Signer.generateKeyPair();
        credential = await VerifiableCredential.sign(
          credential,
          keyPair.privateKey,
          `${issuerDID}#keys-1`,
        );
        break;

      default:
        return res.status(400).json({ error: 'Unsupported credential type' });
    }

    // Store credential in database
    await db.query(
      `INSERT INTO credentials (id, user_id, type, namespace, credential_data, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW())
       ON CONFLICT (id) DO UPDATE SET credential_data = $5, updated_at = NOW()`,
      [credentialId, userId, type, namespace, JSON.stringify(credential)],
    );

    // Cache in Redis
    await redis.set(`credential:${credentialId}`, JSON.stringify(credential), 'EX', 3600);

    res.status(201).json({
      success: true,
      credentialId,
      type,
      namespace,
      credential,
      issuedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Credential issuance error:', error);
    res.status(500).json({ error: 'Credential issuance failed', details: error.message });
  }
});

/**
 * GET /api/credentials
 * List user's credentials
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, status = 'active' } = req.query;

    let query = `
      SELECT id, type, namespace, status, created_at, updated_at
      FROM credentials
      WHERE user_id = $1 AND status = $2
    `;
    const params = [userId, status];

    if (type) {
      query += ` AND type = $3`;
      params.push(type);
    }

    query += ` ORDER BY created_at DESC`;

    const credentials = await db.queryAll(query, params);

    res.json({
      success: true,
      credentials: credentials.map((c) => ({
        id: c.id,
        type: c.type,
        namespace: c.namespace,
        status: c.status,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
      count: credentials.length,
    });
  } catch (error) {
    console.error('List credentials error:', error);
    res.status(500).json({ error: 'Failed to list credentials', details: error.message });
  }
});

/**
 * GET /api/credentials/:id
 * Get credential details
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Try cache first
    const cached = await redis.get(`credential:${id}`);
    if (cached) {
      try {
        const credential = JSON.parse(cached);
        return res.json({
          success: true,
          credentialId: id,
          credential,
          cached: true,
        });
      } catch {
        // Continue to database lookup
      }
    }

    const result = await db.queryOne(
      `SELECT id, type, namespace, credential_data, status, created_at, updated_at
       FROM credentials
       WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );

    if (!result) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const credential = typeof result.credential_data === 'string'
      ? JSON.parse(result.credential_data)
      : result.credential_data;

    res.json({
      success: true,
      credentialId: id,
      type: result.type,
      namespace: result.namespace,
      status: result.status,
      credential,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    });
  } catch (error) {
    console.error('Get credential error:', error);
    res.status(500).json({ error: 'Failed to get credential', details: error.message });
  }
});

/**
 * POST /api/credentials/:id/present
 * Generate a presentation for a credential
 *
 * Request body:
 * - requestedClaims: string[] (for selective disclosure)
 * - challenge: string (nonce from verifier)
 * - domain: string (verifier's domain)
 * - format: 'vp' | 'selective' | 'dtc'
 */
router.post('/:id/present', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedClaims = [], challenge, domain, format = 'vp' } = req.body;
    const userId = req.user.userId;

    // Get credential
    const result = await db.queryOne(
      `SELECT type, credential_data FROM credentials
       WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [id, userId],
    );

    if (!result) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const credential = typeof result.credential_data === 'string'
      ? JSON.parse(result.credential_data)
      : result.credential_data;

    let presentation;

    switch (result.type) {
      case 'PID':
        if (requestedClaims.length > 0) {
          presentation = EiDAS2PID.selectiveDisclosure(credential, requestedClaims);
        } else {
          presentation = credential;
        }
        break;

      case 'DTC':
        if (requestedClaims.length > 0) {
          // requestedClaims should be data group names like ['DG1', 'DG2']
          presentation = DTCSelectiveDisclosure.createPresentation(
            credential,
            requestedClaims,
            challenge || crypto.randomBytes(16).toString('hex'),
          );
        } else {
          presentation = credential;
        }
        break;

      case 'VC':
        if (format === 'selective' && requestedClaims.length > 0) {
          const selectiveCredential = VerifiablePresentation.createSelectiveDisclosure(
            credential,
            requestedClaims,
          );
          presentation = await createVP(selectiveCredential, userId, challenge, domain);
        } else {
          presentation = await createVP(credential, userId, challenge, domain);
        }
        break;

      case 'MDL':
        if (requestedClaims.length > 0) {
          presentation = createSelectiveMDL(credential, requestedClaims);
        } else {
          presentation = credential;
        }
        break;

      default:
        presentation = credential;
    }

    // Log presentation
    await db.query(
      `INSERT INTO credential_presentations (id, credential_id, user_id, requested_claims, challenge, domain, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuidv4(), id, userId, requestedClaims, challenge, domain],
    );

    res.json({
      success: true,
      credentialId: id,
      presentationType: format,
      requestedClaims,
      presentation,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Presentation error:', error);
    res.status(500).json({ error: 'Failed to create presentation', details: error.message });
  }
});

/**
 * DELETE /api/credentials/:id
 * Delete a credential
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Soft delete - mark as revoked
    const result = await db.query(
      `UPDATE credentials SET status = 'revoked', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING id`,
      [id, userId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Credential not found or already deleted' });
    }

    // Remove from cache
    await redis.del(`credential:${id}`);

    res.json({
      success: true,
      credentialId: id,
      status: 'revoked',
      revokedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Delete credential error:', error);
    res.status(500).json({ error: 'Failed to delete credential', details: error.message });
  }
});

/**
 * POST /api/credentials/verify
 * Verify a credential or presentation
 */
router.post('/verify', async (req, res) => {
  try {
    const { credential, presentation, type, challenge } = req.body;

    if (!credential && !presentation) {
      return res.status(400).json({ error: 'Credential or presentation is required' });
    }

    const toVerify = presentation || credential;
    let verificationResult;

    // Determine type if not provided
    const credType = type || detectCredentialType(toVerify);

    switch (credType) {
      case 'PID':
        verificationResult = EiDAS2PID.validate(toVerify);
        break;

      case 'DTC':
        verificationResult = ICAODTCManager.verifyIntegrity(toVerify);
        break;

      case 'VC':
        if (presentation) {
          verificationResult = await VerifiablePresentation.verify(toVerify, challenge);
        } else {
          verificationResult = await VerifiableCredential.verify(toVerify);
        }
        break;

      case 'MDL':
        verificationResult = verifyMDL(toVerify);
        break;

      default:
        return res.status(400).json({ error: 'Unknown credential type' });
    }

    res.json({
      success: true,
      type: credType,
      verification: verificationResult,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * POST /api/credentials/dtc/authenticate
 * Perform DTC chip authentication
 */
router.post('/dtc/authenticate', authenticateToken, async (req, res) => {
  try {
    const { credentialId, protocol = 'PACE', mrzInfo } = req.body;
    const userId = req.user.userId;

    // Get DTC credential
    const result = await db.queryOne(
      `SELECT credential_data FROM credentials
       WHERE id = $1 AND user_id = $2 AND type = 'DTC' AND status = 'active'`,
      [credentialId, userId],
    );

    if (!result) {
      return res.status(404).json({ error: 'DTC credential not found' });
    }

    const dtc = typeof result.credential_data === 'string'
      ? JSON.parse(result.credential_data)
      : result.credential_data;

    let authResult;

    if (protocol === 'BAC' && mrzInfo) {
      authResult = ChipAuthSimulator.deriveBAC(mrzInfo);
      authResult.protocol = 'BAC';
    } else if (protocol === 'PACE' && mrzInfo) {
      authResult = ChipAuthSimulator.derivePACE(mrzInfo);
    } else if (protocol === 'AA') {
      const challenge = ChipAuthSimulator.generateChallenge();
      authResult = ChipAuthSimulator.performActiveAuthentication(dtc, challenge);
      authResult.protocol = 'ActiveAuthentication';
    } else if (protocol === 'CA') {
      const ephemeralKey = crypto.randomBytes(32).toString('hex');
      authResult = ChipAuthSimulator.performChipAuthentication(dtc, ephemeralKey);
    } else {
      return res.status(400).json({
        error: 'Invalid protocol or missing MRZ info',
        validProtocols: ['BAC', 'PACE', 'AA', 'CA'],
      });
    }

    res.json({
      success: true,
      credentialId,
      authentication: authResult,
      authenticatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('DTC authentication error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

/**
 * POST /api/credentials/pid/age-verify
 * Verify age predicate without revealing DOB
 */
router.post('/pid/age-verify', authenticateToken, async (req, res) => {
  try {
    const { credentialId, predicate } = req.body;
    const userId = req.user.userId;

    if (!predicate || !AGE_PREDICATES[predicate]) {
      return res.status(400).json({
        error: 'Invalid age predicate',
        validPredicates: Object.keys(AGE_PREDICATES),
      });
    }

    // Get PID credential
    const result = await db.queryOne(
      `SELECT credential_data FROM credentials
       WHERE id = $1 AND user_id = $2 AND type = 'PID' AND status = 'active'`,
      [credentialId, userId],
    );

    if (!result) {
      return res.status(404).json({ error: 'PID credential not found' });
    }

    const pid = typeof result.credential_data === 'string'
      ? JSON.parse(result.credential_data)
      : result.credential_data;

    const verified = EiDAS2PID.verifyAgePredicate(pid, predicate);

    res.json({
      success: true,
      credentialId,
      predicate,
      result: verified,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Age verification error:', error);
    res.status(500).json({ error: 'Age verification failed', details: error.message });
  }
});

// Helper Functions

/**
 * Issue mDL credential
 */
async function issueMDL(data, masterCode, userId) {
  const mdl = {
    version: '1.0',
    namespace: 'org.iso.18013.5.1.mDL',
    docType: 'org.iso.18013.5.1.mDL',
    credentialId: uuidv4(),
    issuanceDate: new Date().toISOString(),
    expiryDate: data.expiryDate || new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    issuingCountry: data.issuingCountry || 'ZA',
    issuingAuthority: data.issuingAuthority || 'Department of Transport',

    claims: {
      family_name: data.lastName,
      given_name: data.firstName,
      birth_date: data.dateOfBirth,
      issue_date: data.issueDate || new Date().toISOString().split('T')[0],
      expiry_date: data.expiryDate,
      issuing_country: data.issuingCountry || 'ZA',
      issuing_authority: data.issuingAuthority || 'Department of Transport',
      document_number: data.documentNumber,
      portrait: data.portrait || null,
      driving_privileges: data.drivingPrivileges || [],
      un_distinguishing_sign: data.unSign || 'ZA',

      // Additional claims
      resident_address: data.address || null,
      resident_city: data.city || null,
      resident_state: data.state || null,
      resident_postal_code: data.postalCode || null,
      resident_country: data.country || 'ZA',

      // Age predicates
      ...EiDAS2PID.computeAgePredicates(data.dateOfBirth),
    },

    extensions: {
      masterCode: masterCode || null,
      masterCodeHash: masterCode
        ? crypto.createHash('sha256').update(masterCode).digest('hex')
        : null,
    },

    security: {
      hashAlgorithm: 'SHA-256',
      signatureAlgorithm: 'ES256',
      issuerSignature: null,
    },
  };

  // Sign with HSM
  const signature = await hsmSigner.sign(JSON.stringify(mdl));
  mdl.security.issuerSignature = signature.signature;

  return mdl;
}

/**
 * Create Verifiable Presentation
 */
async function createVP(credential, userId, challenge, domain) {
  const holderDID = DIDPocketOne.fromMasterCode(userId);

  const presentation = VerifiablePresentation.create({
    holder: holderDID,
    credentials: [credential],
    challenge,
    domain,
  });

  // Sign presentation
  const keyPair = await Ed25519Signer.generateKeyPair();
  const signedPresentation = await VerifiablePresentation.sign(
    presentation,
    keyPair.privateKey,
    `${holderDID}#keys-1`,
    challenge,
    domain,
  );

  return signedPresentation;
}

/**
 * Create selective disclosure mDL
 */
function createSelectiveMDL(mdl, requestedClaims) {
  const selective = {
    version: mdl.version,
    namespace: mdl.namespace,
    credentialId: mdl.credentialId,
    issuingCountry: mdl.issuingCountry,
    claims: {},
    security: mdl.security,
  };

  for (const claim of requestedClaims) {
    if (mdl.claims[claim] !== undefined) {
      selective.claims[claim] = mdl.claims[claim];
    }
  }

  return selective;
}

/**
 * Verify mDL credential
 */
function verifyMDL(mdl) {
  const errors = [];

  if (!mdl.namespace || mdl.namespace !== 'org.iso.18013.5.1.mDL') {
    errors.push('Invalid namespace');
  }

  if (!mdl.claims) {
    errors.push('Missing claims');
  } else {
    if (!mdl.claims.family_name) errors.push('Missing family_name');
    if (!mdl.claims.given_name) errors.push('Missing given_name');
    if (!mdl.claims.birth_date) errors.push('Missing birth_date');
    if (!mdl.claims.document_number) errors.push('Missing document_number');
  }

  if (mdl.expiryDate) {
    const expiry = new Date(mdl.expiryDate);
    if (expiry < new Date()) {
      errors.push('Credential has expired');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detect credential type from structure
 */
function detectCredentialType(credential) {
  if (credential.namespace === EIDAS2_NAMESPACE) return 'PID';
  if (credential.namespace === ICAO_NAMESPACE) return 'DTC';
  if (credential.namespace === 'org.iso.18013.5.1.mDL') return 'MDL';
  if (credential['@context']?.includes(CONTEXTS.CREDENTIALS_V1)) return 'VC';
  if (credential.docType?.includes('mDL')) return 'MDL';
  if (credential.dataGroups) return 'DTC';
  return 'unknown';
}

export default router;
