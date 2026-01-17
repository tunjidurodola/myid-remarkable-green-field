/**
 * QES (Qualified Electronic Signature) Routes
 * Handles eIDAS-compliant qualified electronic signatures
 */

import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

import db from '../lib/db.mjs';
import redis from '../lib/redis.mjs';
import {
  qesManager,
  certificateManager,
  hsmSigner,
  QES_FORMATS,
  SIGNATURE_ALGORITHMS,
} from '../lib/hsm-signer.mjs';

const router = Router();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'myid-jwt-secret-key-change-in-production';

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
 * POST /api/qes/sign
 * Sign a document with QES
 *
 * Request body:
 * - documentHash: string (SHA-256 hash of document)
 * - document: string (optional base64 document for hash calculation)
 * - certificateId: string (user's QES certificate ID)
 * - format: 'CAdES-B' | 'CAdES-T' | 'PAdES-B' | 'XAdES-B'
 * - commitmentType: 'proofOfApproval' | 'proofOfCreation' | 'proofOfOrigin'
 * - signatureReason: string (optional)
 * - signatureLocation: string (optional)
 *
 * Response:
 * - signatureId: string
 * - signature: QES signature object
 */
router.post('/sign', authenticateToken, async (req, res) => {
  try {
    const {
      documentHash,
      document,
      certificateId,
      format = QES_FORMATS.CAdES_B,
      commitmentType = 'proofOfApproval',
      signatureReason,
      signatureLocation,
    } = req.body;

    const userId = req.user.userId;

    // Calculate hash if document is provided
    let hash = documentHash;
    if (!hash && document) {
      const docBuffer = Buffer.from(document, 'base64');
      hash = crypto.createHash('sha256').update(docBuffer).digest('hex');
    }

    if (!hash) {
      return res.status(400).json({ error: 'Document hash or document is required' });
    }

    // Verify user has a valid QES certificate
    let certId = certificateId;
    if (!certId) {
      // Try to find user's active QES certificate
      const userCert = await db.queryOne(
        `SELECT id FROM qes_certificates
         WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );

      if (!userCert) {
        return res.status(400).json({
          error: 'No active QES certificate found',
          hint: 'Request a QES certificate first using POST /api/qes/request-certificate',
        });
      }
      certId = userCert.id;
    }

    // Create QES signature
    const qes = await qesManager.createQES(hash, certId, userId, {
      format,
      commitmentType,
    });

    // Add optional metadata
    if (signatureReason) {
      qes.signatureReason = signatureReason;
    }
    if (signatureLocation) {
      qes.signatureLocation = signatureLocation;
    }

    // Store signature record
    await db.query(
      `INSERT INTO qes_signatures (id, user_id, certificate_id, document_hash, signature_data, format, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'valid', NOW())`,
      [qes.signatureId, userId, certId, hash, JSON.stringify(qes), format],
    );

    // Log audit trail
    await db.query(
      `INSERT INTO qes_audit_log (id, signature_id, user_id, action, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, 'SIGN', $4, $5, $6, NOW())`,
      [
        uuidv4(),
        qes.signatureId,
        userId,
        JSON.stringify({ format, commitmentType, documentHash: hash.substring(0, 16) + '...' }),
        req.ip || req.connection?.remoteAddress,
        req.headers['user-agent'],
      ],
    );

    res.status(201).json({
      success: true,
      signatureId: qes.signatureId,
      signature: qes,
      format,
      signedAt: qes.signingTime,
    });
  } catch (error) {
    console.error('QES signing error:', error);
    res.status(500).json({ error: 'QES signing failed', details: error.message });
  }
});

/**
 * POST /api/qes/verify
 * Verify a QES signature
 *
 * Request body:
 * - signature: QES signature object
 * - documentHash: string (hash of original document)
 * - document: string (optional base64 document)
 *
 * Response:
 * - verified: boolean
 * - details: verification details
 */
router.post('/verify', async (req, res) => {
  try {
    const { signature, documentHash, document } = req.body;

    if (!signature) {
      return res.status(400).json({ error: 'Signature is required' });
    }

    // Calculate hash if document is provided
    let hash = documentHash;
    if (!hash && document) {
      const docBuffer = Buffer.from(document, 'base64');
      hash = crypto.createHash('sha256').update(docBuffer).digest('hex');
    }

    if (!hash) {
      return res.status(400).json({ error: 'Document hash or document is required for verification' });
    }

    // Verify the QES signature
    const result = await qesManager.verifyQES(signature, hash);

    // Check certificate status if we have the signature ID
    let certificateStatus = null;
    if (signature.signatureId) {
      const sigRecord = await db.queryOne(
        `SELECT qs.*, qc.status as cert_status, qc.expires_at as cert_expires
         FROM qes_signatures qs
         LEFT JOIN qes_certificates qc ON qs.certificate_id = qc.id
         WHERE qs.id = $1`,
        [signature.signatureId],
      );

      if (sigRecord) {
        certificateStatus = {
          status: sigRecord.cert_status,
          expiresAt: sigRecord.cert_expires,
          valid: sigRecord.cert_status === 'active' && new Date(sigRecord.cert_expires) > new Date(),
        };
      }
    }

    res.json({
      success: true,
      verified: result.verified,
      signatureId: signature.signatureId,
      format: result.format,
      signingTime: result.signingTime,
      compliance: result.compliance,
      certificateStatus,
      errors: result.errors || [],
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('QES verification error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * GET /api/qes/certificate
 * Get user's QES certificate
 */
router.get('/certificate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const certificates = await db.queryAll(
      `SELECT id, serial_number, subject, issuer, valid_from, expires_at, status, created_at
       FROM qes_certificates
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    if (certificates.length === 0) {
      return res.json({
        success: true,
        hasCertificate: false,
        certificates: [],
      });
    }

    // Get active certificate
    const activeCert = certificates.find((c) => c.status === 'active' && new Date(c.expires_at) > new Date());

    res.json({
      success: true,
      hasCertificate: !!activeCert,
      activeCertificate: activeCert
        ? {
            id: activeCert.id,
            serialNumber: activeCert.serial_number,
            subject: activeCert.subject,
            issuer: activeCert.issuer,
            validFrom: activeCert.valid_from,
            expiresAt: activeCert.expires_at,
            status: activeCert.status,
          }
        : null,
      certificates: certificates.map((c) => ({
        id: c.id,
        serialNumber: c.serial_number,
        subject: c.subject,
        status: c.status,
        expiresAt: c.expires_at,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({ error: 'Failed to get certificate', details: error.message });
  }
});

/**
 * POST /api/qes/request-certificate
 * Request a new QES certificate
 *
 * Request body:
 * - identityData: verified identity information
 *
 * Response:
 * - certificateId: string
 * - certificate: certificate details
 */
router.post('/request-certificate', authenticateToken, async (req, res) => {
  try {
    const { identityData } = req.body;
    const userId = req.user.userId;

    if (!identityData) {
      return res.status(400).json({ error: 'Identity data is required' });
    }

    // Check if user already has an active certificate
    const existingCert = await db.queryOne(
      `SELECT id FROM qes_certificates
       WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()`,
      [userId],
    );

    if (existingCert) {
      return res.status(400).json({
        error: 'Active certificate already exists',
        certificateId: existingCert.id,
      });
    }

    // Verify identity is complete
    const requiredFields = ['firstName', 'lastName', 'email'];
    const missingFields = requiredFields.filter((f) => !identityData[f]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Missing required identity fields',
        missingFields,
      });
    }

    // Mark identity as verified (in production, this would involve identity verification)
    identityData.verified = true;

    // Request QES certificate from HSM
    const certResult = await qesManager.requestQESCertificate(userId, identityData);

    // Store certificate in database
    await db.query(
      `INSERT INTO qes_certificates (id, user_id, serial_number, subject, issuer, certificate_data, valid_from, expires_at, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', NOW())`,
      [
        certResult.certificateId,
        userId,
        certResult.serialNumber,
        certResult.subject,
        'CN=pocketOne CA, O=pocketOne (Pty) Ltd, C=ZA',
        certResult.certificate,
        certResult.validFrom,
        certResult.validTo,
      ],
    );

    // Log certificate request
    await db.query(
      `INSERT INTO qes_audit_log (id, user_id, action, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, 'CERTIFICATE_ISSUED', $3, $4, $5, NOW())`,
      [
        uuidv4(),
        userId,
        JSON.stringify({ certificateId: certResult.certificateId, subject: certResult.subject }),
        req.ip || req.connection?.remoteAddress,
        req.headers['user-agent'],
      ],
    );

    res.status(201).json({
      success: true,
      certificateId: certResult.certificateId,
      serialNumber: certResult.serialNumber,
      subject: certResult.subject,
      validFrom: certResult.validFrom,
      validTo: certResult.validTo,
      isQES: true,
      issuedAt: certResult.requestedAt,
    });
  } catch (error) {
    console.error('Certificate request error:', error);
    res.status(500).json({ error: 'Certificate request failed', details: error.message });
  }
});

/**
 * GET /api/qes/signatures
 * List user's QES signatures
 */
router.get('/signatures', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;

    const signatures = await db.queryAll(
      `SELECT id, document_hash, format, status, created_at
       FROM qes_signatures
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)],
    );

    const countResult = await db.queryOne(
      `SELECT COUNT(*) as total FROM qes_signatures WHERE user_id = $1`,
      [userId],
    );

    res.json({
      success: true,
      signatures: signatures.map((s) => ({
        id: s.id,
        documentHash: s.document_hash.substring(0, 16) + '...',
        format: s.format,
        status: s.status,
        createdAt: s.created_at,
      })),
      pagination: {
        total: parseInt(countResult.total),
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('List signatures error:', error);
    res.status(500).json({ error: 'Failed to list signatures', details: error.message });
  }
});

/**
 * GET /api/qes/signatures/:id
 * Get signature details
 */
router.get('/signatures/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const signature = await db.queryOne(
      `SELECT qs.*, qc.subject as cert_subject, qc.serial_number as cert_serial
       FROM qes_signatures qs
       LEFT JOIN qes_certificates qc ON qs.certificate_id = qc.id
       WHERE qs.id = $1 AND qs.user_id = $2`,
      [id, userId],
    );

    if (!signature) {
      return res.status(404).json({ error: 'Signature not found' });
    }

    const signatureData = typeof signature.signature_data === 'string'
      ? JSON.parse(signature.signature_data)
      : signature.signature_data;

    res.json({
      success: true,
      signatureId: signature.id,
      documentHash: signature.document_hash,
      format: signature.format,
      status: signature.status,
      certificate: {
        subject: signature.cert_subject,
        serialNumber: signature.cert_serial,
      },
      signatureDetails: signatureData,
      createdAt: signature.created_at,
    });
  } catch (error) {
    console.error('Get signature error:', error);
    res.status(500).json({ error: 'Failed to get signature', details: error.message });
  }
});

/**
 * POST /api/qes/revoke-certificate
 * Revoke a QES certificate
 */
router.post('/revoke-certificate', authenticateToken, async (req, res) => {
  try {
    const { certificateId, reason = 'unspecified' } = req.body;
    const userId = req.user.userId;

    if (!certificateId) {
      return res.status(400).json({ error: 'Certificate ID is required' });
    }

    // Verify ownership
    const cert = await db.queryOne(
      `SELECT id FROM qes_certificates WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [certificateId, userId],
    );

    if (!cert) {
      return res.status(404).json({ error: 'Certificate not found or already revoked' });
    }

    // Revoke certificate
    await db.query(
      `UPDATE qes_certificates SET status = 'revoked', revoked_at = NOW(), revocation_reason = $1 WHERE id = $2`,
      [reason, certificateId],
    );

    // Log revocation
    await db.query(
      `INSERT INTO qes_audit_log (id, user_id, action, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, 'CERTIFICATE_REVOKED', $3, $4, $5, NOW())`,
      [
        uuidv4(),
        userId,
        JSON.stringify({ certificateId, reason }),
        req.ip || req.connection?.remoteAddress,
        req.headers['user-agent'],
      ],
    );

    res.json({
      success: true,
      certificateId,
      status: 'revoked',
      reason,
      revokedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Revoke certificate error:', error);
    res.status(500).json({ error: 'Certificate revocation failed', details: error.message });
  }
});

/**
 * GET /api/qes/audit-log
 * Get QES audit log for user
 */
router.get('/audit-log', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    const logs = await db.queryAll(
      `SELECT id, signature_id, action, details, ip_address, created_at
       FROM qes_audit_log
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), parseInt(offset)],
    );

    res.json({
      success: true,
      auditLog: logs.map((l) => ({
        id: l.id,
        signatureId: l.signature_id,
        action: l.action,
        details: typeof l.details === 'string' ? JSON.parse(l.details) : l.details,
        ipAddress: l.ip_address,
        timestamp: l.created_at,
      })),
    });
  } catch (error) {
    console.error('Get audit log error:', error);
    res.status(500).json({ error: 'Failed to get audit log', details: error.message });
  }
});

/**
 * GET /api/qes/formats
 * Get supported QES signature formats
 */
router.get('/formats', (req, res) => {
  res.json({
    success: true,
    formats: Object.entries(QES_FORMATS).map(([key, value]) => ({
      key,
      name: value,
      description: getFormatDescription(key),
    })),
    algorithms: Object.keys(SIGNATURE_ALGORITHMS),
  });
});

/**
 * Get description for signature format
 */
function getFormatDescription(format) {
  const descriptions = {
    CAdES_B: 'CMS Advanced Electronic Signature - Basic level',
    CAdES_T: 'CAdES with trusted timestamp',
    CAdES_LT: 'CAdES with long-term validation data',
    CAdES_LTA: 'CAdES with long-term archive timestamp',
    PAdES_B: 'PDF Advanced Electronic Signature - Basic level',
    XAdES_B: 'XML Advanced Electronic Signature - Basic level',
  };
  return descriptions[format] || 'Electronic signature format';
}

export default router;
