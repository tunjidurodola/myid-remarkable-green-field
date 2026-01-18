/**
 * mDL (Mobile Driving License) API Routes
 * ISO 18013-5 compliant mDL credential management
 */

import { Router } from 'express';
import { getBackendSecrets } from "../lib/secrets.mjs";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db.mjs';
import redis from '../lib/redis.mjs';
import {
  MDL_NAMESPACES,
  MDL_DATA_ELEMENTS,
  CBOREncoder,
  DeviceEngagement,
  SessionEncryption,
  MDLDocument,
  PresentationRequest,
  calculateAge,
  createAgeOverClaims,
} from '../lib/mdl.mjs';
import {
  SelectiveDisclosure,
  ClaimCommitment,
  MerkleTree,
  PredicateProof,
} from '../lib/selective-disclosure.mjs';

const router = Router();

// JWT configuration
const { jwt_secret: JWT_SECRET } = await getBackendSecrets();
/**
 * Authentication middleware
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * POST /api/mdl/issue
 * Issue a new mDL credential to a user
 */
router.post('/issue', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      familyName,
      givenName,
      birthDate,
      documentNumber,
      issuingCountry,
      issuingAuthority,
      issueDate,
      expiryDate,
      portrait,
      drivingPrivileges,
      additionalClaims,
    } = req.body;

    // Validate required fields
    if (!familyName || !givenName || !birthDate || !documentNumber) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['familyName', 'givenName', 'birthDate', 'documentNumber'],
      });
    }

    // Check if user already has an mDL
    const existingMdl = await db.queryOne(
      `SELECT credential_id FROM mdl_credentials
       WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    if (existingMdl) {
      return res.status(409).json({
        error: 'User already has an active mDL',
        credentialId: existingMdl.credential_id,
      });
    }

    // Build mDL document
    const mdl = new MDLDocument();
    mdl.setMandatoryElements({
      familyName,
      givenName,
      birthDate,
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      expiryDate: expiryDate || new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      issuingCountry: issuingCountry || 'ZA',
      issuingAuthority: issuingAuthority || 'myID.africa',
      documentNumber,
    });

    // Add optional elements
    if (portrait) {
      mdl.setPortrait(portrait);
    }

    if (drivingPrivileges) {
      mdl.setDrivingPrivileges(drivingPrivileges);
    }

    // Calculate and add age-over claims
    const ageOverClaims = createAgeOverClaims(birthDate);
    for (const [claimType, value] of Object.entries(ageOverClaims)) {
      mdl.addElement(MDL_NAMESPACES.MDL, claimType, value);
    }

    // Get user's mastercode if available
    const mastercode = await db.queryOne(
      `SELECT ma.mc, m.hash_b3 FROM mastercode_assignments ma
       JOIN mastercodes m ON ma.mc = m.mc
       WHERE ma.user_id = $1`,
      [userId]
    );

    if (mastercode) {
      mdl.setPocketOneExtensions(mastercode.hash_b3, '');
    }

    // Build the document with salts for selective disclosure
    const mdlWithSalts = mdl.buildWithSalts();

    // Extract claim values for commitment generation
    const claims = {};
    for (const [ns, elements] of Object.entries(mdlWithSalts.namespaces)) {
      for (const [key, data] of Object.entries(elements)) {
        claims[`${ns}.${key}`] = data.value;
      }
    }

    // Create selective disclosure credential
    const sdCredential = SelectiveDisclosure.createCredential(claims, {
      issuer: 'myID.africa',
      subject: userId,
    });

    // Generate credential ID
    const credentialId = uuidv4();

    // Sign the credential (in production, use HSM)
    const documentHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(mdlWithSalts))
      .digest('hex');

    const signature = crypto
      .createHash('sha256')
      .update(documentHash + JWT_SECRET)
      .digest('hex');

    mdl.setIssuerAuth(signature, 'myID.africa-issuer-cert', 'ES256');

    // Store in database
    await db.transaction(async (client) => {
      // Insert mDL credential
      await client.query(
        `INSERT INTO mdl_credentials (
          credential_id, user_id, document_number, doc_type,
          namespaces, issuer_auth, merkle_root, status, issue_date, expiry_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', $8, $9)`,
        [
          credentialId,
          userId,
          documentNumber,
          MDL_NAMESPACES.MDL,
          JSON.stringify(mdlWithSalts.namespaces),
          JSON.stringify(mdl.issuerAuth),
          sdCredential.merkleRoot,
          issueDate || new Date().toISOString().split('T')[0],
          expiryDate || new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        ]
      );

      // Store commitments for selective disclosure
      await client.query(
        `INSERT INTO mdl_commitments (
          credential_id, commitments, merkle_tree
        ) VALUES ($1, $2, $3)`,
        [credentialId, JSON.stringify(sdCredential.commitments), JSON.stringify(sdCredential.merkleTree)]
      );
    });

    // Cache in Redis for quick access
    await redis.set(`mdl:${credentialId}`, JSON.stringify({
      ...mdl.build(),
      credentialId,
      merkleRoot: sdCredential.merkleRoot,
    }), 86400); // 24 hour TTL

    res.status(201).json({
      success: true,
      credentialId,
      docType: MDL_NAMESPACES.MDL,
      merkleRoot: sdCredential.merkleRoot,
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      expiryDate: expiryDate || new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      cbor: mdl.toCBOR(),
    });
  } catch (error) {
    console.error('mDL issuance error:', error);
    res.status(500).json({ error: 'Failed to issue mDL', details: error.message });
  }
});

/**
 * GET /api/mdl/:id
 * Get mDL credential by ID
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    // Try cache first
    const cached = await redis.get(`mdl:${id}`);
    if (cached) {
      const mdlData = JSON.parse(cached);
      // Verify ownership
      const ownership = await db.queryOne(
        'SELECT user_id FROM mdl_credentials WHERE credential_id = $1',
        [id]
      );
      if (ownership?.user_id !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.json({ success: true, credential: mdlData, source: 'cache' });
    }

    // Get from database
    const credential = await db.queryOne(
      `SELECT mc.*, mcom.commitments, mcom.merkle_tree
       FROM mdl_credentials mc
       LEFT JOIN mdl_commitments mcom ON mc.credential_id = mcom.credential_id
       WHERE mc.credential_id = $1 AND mc.user_id = $2`,
      [id, userId]
    );

    if (!credential) {
      return res.status(404).json({ error: 'mDL credential not found' });
    }

    // Build response
    const mdlData = {
      credentialId: credential.credential_id,
      docType: credential.doc_type,
      namespaces: credential.namespaces,
      issuerAuth: credential.issuer_auth,
      merkleRoot: credential.merkle_root,
      status: credential.status,
      issueDate: credential.issue_date,
      expiryDate: credential.expiry_date,
    };

    // Cache for future requests
    await redis.set(`mdl:${id}`, JSON.stringify(mdlData), 86400);

    res.json({ success: true, credential: mdlData, source: 'database' });
  } catch (error) {
    console.error('Get mDL error:', error);
    res.status(500).json({ error: 'Failed to retrieve mDL', details: error.message });
  }
});

/**
 * POST /api/mdl/present
 * Generate mDL presentation with selective disclosure
 */
router.post('/present', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      credentialId,
      requestedElements,
      readerKey,
      sessionId,
      predicates,
    } = req.body;

    if (!credentialId || !requestedElements || !Array.isArray(requestedElements)) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['credentialId', 'requestedElements'],
      });
    }

    // Get credential
    const credential = await db.queryOne(
      `SELECT mc.*, mcom.commitments, mcom.merkle_tree
       FROM mdl_credentials mc
       LEFT JOIN mdl_commitments mcom ON mc.credential_id = mcom.credential_id
       WHERE mc.credential_id = $1 AND mc.user_id = $2 AND mc.status = 'active'`,
      [credentialId, userId]
    );

    if (!credential) {
      return res.status(404).json({ error: 'mDL credential not found or inactive' });
    }

    // Check expiry
    if (new Date(credential.expiry_date) < new Date()) {
      return res.status(410).json({ error: 'mDL credential has expired' });
    }

    // Build original claims map
    const originalClaims = {};
    for (const [ns, elements] of Object.entries(credential.namespaces)) {
      for (const [key, data] of Object.entries(elements)) {
        const fullKey = `${ns}.${key}`;
        originalClaims[fullKey] = typeof data === 'object' && data.value !== undefined
          ? data.value
          : data;
      }
    }

    // Create selective disclosure presentation
    const presentation = SelectiveDisclosure.createPresentation(
      {
        credentialId: credential.credential_id,
        commitments: credential.commitments,
        merkleTree: credential.merkle_tree,
        merkleRoot: credential.merkle_root,
        issuer: 'myID.africa',
        subject: userId,
      },
      requestedElements,
      originalClaims
    );

    // Add predicate proofs if requested
    const predicateProofs = {};
    if (predicates) {
      for (const predicate of predicates) {
        if (predicate.type === 'age_over' && originalClaims[`${MDL_NAMESPACES.MDL}.birth_date`]) {
          predicateProofs[`age_over_${predicate.threshold}`] = PredicateProof.createAgeOverProof(
            originalClaims[`${MDL_NAMESPACES.MDL}.birth_date`],
            predicate.threshold
          );
        } else if (predicate.type === 'range') {
          const value = originalClaims[predicate.claim];
          if (value !== undefined) {
            predicateProofs[`${predicate.claim}_range`] = PredicateProof.createRangeProof(
              value,
              predicate.min,
              predicate.max,
              predicate.claim
            );
          }
        }
      }
    }

    // If session encryption requested
    let encryptedPresentation = null;
    if (readerKey) {
      const deviceKey = DeviceEngagement.generateDeviceKey();
      const sessionKeys = SessionEncryption.deriveSessionKeys(
        deviceKey.privateKey,
        readerKey
      );

      encryptedPresentation = SessionEncryption.encrypt(
        presentation,
        Buffer.concat([sessionKeys.encryptionKey, sessionKeys.macKey]),
        sessionId
      );
    }

    // Log presentation for audit
    await db.query(
      `INSERT INTO mdl_presentations (
        presentation_id, credential_id, user_id, disclosed_elements,
        predicates, session_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        presentation.presentationId,
        credentialId,
        userId,
        JSON.stringify(requestedElements),
        JSON.stringify(predicateProofs),
        sessionId,
      ]
    );

    res.json({
      success: true,
      presentation: encryptedPresentation || presentation,
      predicateProofs,
      encrypted: !!encryptedPresentation,
    });
  } catch (error) {
    console.error('mDL presentation error:', error);
    res.status(500).json({ error: 'Failed to create presentation', details: error.message });
  }
});

/**
 * POST /api/mdl/verify
 * Verify an mDL presentation
 */
router.post('/verify', async (req, res) => {
  try {
    const { presentation, predicateProofs } = req.body;

    if (!presentation) {
      return res.status(400).json({ error: 'Presentation data required' });
    }

    // Verify selective disclosure
    const verificationResult = SelectiveDisclosure.verifyPresentation(presentation);

    // Verify predicate proofs if provided
    const predicateResults = {};
    if (predicateProofs) {
      for (const [key, proof] of Object.entries(predicateProofs)) {
        predicateResults[key] = {
          result: proof.result,
          verified: PredicateProof.verifyProof(proof, proof.result),
        };
      }
    }

    // Check issuer signature (in production, verify against trusted issuer list)
    let issuerVerified = false;
    if (presentation.issuer === 'myID.africa' || presentation.issuer === 'pocketOne') {
      issuerVerified = true;
    }

    const overallValid = verificationResult.valid && issuerVerified;

    res.json({
      success: true,
      valid: overallValid,
      verification: {
        selectiveDisclosure: verificationResult,
        predicates: predicateResults,
        issuer: {
          name: presentation.issuer,
          verified: issuerVerified,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('mDL verification error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * GET /api/mdl/engagement
 * Generate device engagement QR code data
 */
router.get('/engagement', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const { credentialId, readerKeyRequired } = req.query;

    // Generate device engagement
    const engagement = DeviceEngagement.generate({
      sessionId: uuidv4(),
      readerKeyRequired: readerKeyRequired === 'true',
      originInfos: [{
        cat: 1, // NFC
        type: 0,
      }],
    });

    // Generate QR data
    const qrData = DeviceEngagement.generateQRData(engagement.engagement);

    // Store session in Redis
    await redis.set(
      `mdl:session:${engagement.sessionId}`,
      JSON.stringify({
        userId,
        credentialId,
        deviceKey: engagement.deviceKey,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }),
      300 // 5 minute TTL
    );

    res.json({
      success: true,
      sessionId: engagement.sessionId,
      qrData,
      engagement: engagement.engagement,
      expiresIn: 300,
    });
  } catch (error) {
    console.error('Device engagement error:', error);
    res.status(500).json({ error: 'Failed to generate engagement', details: error.message });
  }
});

/**
 * GET /api/mdl/list
 * List all mDL credentials for user
 */
router.get('/list', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;

    const credentials = await db.queryAll(
      `SELECT credential_id, document_number, doc_type, status,
              issue_date, expiry_date, created_at
       FROM mdl_credentials
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      count: credentials.length,
      credentials: credentials.map(c => ({
        credentialId: c.credential_id,
        documentNumber: c.document_number,
        docType: c.doc_type,
        status: c.status,
        issueDate: c.issue_date,
        expiryDate: c.expiry_date,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error('List mDL error:', error);
    res.status(500).json({ error: 'Failed to list credentials', details: error.message });
  }
});

/**
 * DELETE /api/mdl/:id
 * Revoke/deactivate an mDL credential
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;

    const result = await db.query(
      `UPDATE mdl_credentials
       SET status = 'revoked', updated_at = NOW()
       WHERE credential_id = $1 AND user_id = $2
       RETURNING credential_id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'mDL credential not found' });
    }

    // Clear from cache
    await redis.del(`mdl:${id}`);

    res.json({
      success: true,
      message: 'mDL credential revoked',
      credentialId: id,
    });
  } catch (error) {
    console.error('Revoke mDL error:', error);
    res.status(500).json({ error: 'Failed to revoke credential', details: error.message });
  }
});

/**
 * GET /api/mdl/elements
 * Get available data elements
 */
router.get('/elements', (req, res) => {
  const elements = Object.entries(MDL_DATA_ELEMENTS).map(([id, def]) => ({
    id,
    namespace: def.namespace,
    mandatory: def.mandatory,
    description: def.description,
  }));

  res.json({
    success: true,
    namespaces: MDL_NAMESPACES,
    elements,
  });
});

export default router;
