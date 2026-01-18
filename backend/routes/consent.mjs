/**
 * Consent Management Routes
 * Handles user consent for claim disclosure to relying parties
 */

import { Router } from 'express';
import { getBackendSecrets } from "../lib/secrets.mjs";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db.mjs';
import redis from '../lib/redis.mjs';
import { Blake3, SelectiveDisclosure } from '../lib/selective-disclosure.mjs';

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
 * Consent request status types
 */
const CONSENT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  EXPIRED: 'expired',
  REVOKED: 'revoked',
};

/**
 * Generate consent token hash
 */
function generateConsentToken(rpId, claims, timestamp, userId) {
  const sortedClaims = [...claims].sort();
  const data = JSON.stringify({
    rpId,
    claims: sortedClaims,
    timestamp,
    userId: userId || '',
  });
  return Blake3.hash(data);
}

/**
 * POST /api/consent/request
 * Create a consent request from a relying party
 */
router.post('/request', async (req, res) => {
  try {
    const {
      rpId,
      rpName,
      rpLogo,
      rpUrl,
      requestedClaims,
      purpose,
      credentialType,
      intentToRetain,
      expiresIn,
      callbackUrl,
      userId, // Optional - for direct user targeting
    } = req.body;

    // Validate required fields
    if (!rpId || !rpName || !requestedClaims || !Array.isArray(requestedClaims)) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['rpId', 'rpName', 'requestedClaims'],
      });
    }

    // Rate limit consent requests per RP
    const rateLimit = await redis.checkRateLimit(`consent:rp:${rpId}`, 100, 3600);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many consent requests',
        retryAfter: rateLimit.resetIn,
      });
    }

    const requestId = uuidv4();
    const nonce = Blake3.randomHex(16);
    const expirationMs = (expiresIn || 300) * 1000; // Default 5 minutes
    const expiresAt = new Date(Date.now() + expirationMs).toISOString();

    // Create consent request
    const consentRequest = {
      requestId,
      rpId,
      rpName,
      rpLogo,
      rpUrl,
      requestedClaims,
      purpose: purpose || 'identity_verification',
      credentialType: credentialType || 'mDL',
      intentToRetain: intentToRetain || false,
      nonce,
      status: CONSENT_STATUS.PENDING,
      callbackUrl,
      createdAt: new Date().toISOString(),
      expiresAt,
    };

    // Store in database
    await db.query(
      `INSERT INTO consent_requests (
        request_id, rp_id, rp_name, rp_logo, rp_url,
        requested_claims, purpose, credential_type,
        intent_to_retain, nonce, status, callback_url,
        user_id, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        requestId,
        rpId,
        rpName,
        rpLogo,
        rpUrl,
        JSON.stringify(requestedClaims),
        purpose,
        credentialType,
        intentToRetain,
        nonce,
        CONSENT_STATUS.PENDING,
        callbackUrl,
        userId,
        expiresAt,
      ]
    );

    // Cache for quick access
    await redis.set(
      `consent:request:${requestId}`,
      JSON.stringify(consentRequest),
      expiresIn || 300
    );

    res.status(201).json({
      success: true,
      requestId,
      nonce,
      expiresAt,
      approvalUrl: `/consent/approve?request=${requestId}`,
    });
  } catch (error) {
    console.error('Consent request error:', error);
    res.status(500).json({ error: 'Failed to create consent request', details: error.message });
  }
});

/**
 * GET /api/consent/request/:id
 * Get consent request details (for user approval UI)
 */
router.get('/request/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Try cache first
    const cached = await redis.get(`consent:request:${id}`);
    if (cached) {
      const request = JSON.parse(cached);
      return res.json({ success: true, request, source: 'cache' });
    }

    // Get from database
    const request = await db.queryOne(
      `SELECT * FROM consent_requests WHERE request_id = $1`,
      [id]
    );

    if (!request) {
      return res.status(404).json({ error: 'Consent request not found' });
    }

    // Check if expired
    if (new Date(request.expires_at) < new Date()) {
      await db.query(
        `UPDATE consent_requests SET status = $1 WHERE request_id = $2`,
        [CONSENT_STATUS.EXPIRED, id]
      );
      return res.status(410).json({ error: 'Consent request has expired' });
    }

    res.json({
      success: true,
      request: {
        requestId: request.request_id,
        rpId: request.rp_id,
        rpName: request.rp_name,
        rpLogo: request.rp_logo,
        rpUrl: request.rp_url,
        requestedClaims: request.requested_claims,
        purpose: request.purpose,
        credentialType: request.credential_type,
        intentToRetain: request.intent_to_retain,
        status: request.status,
        createdAt: request.created_at,
        expiresAt: request.expires_at,
      },
      source: 'database',
    });
  } catch (error) {
    console.error('Get consent request error:', error);
    res.status(500).json({ error: 'Failed to retrieve consent request', details: error.message });
  }
});

/**
 * POST /api/consent/approve
 * User approves claim disclosure
 */
router.post('/approve', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const {
      requestId,
      approvedClaims,
      credentialId,
      additionalConditions,
    } = req.body;

    if (!requestId || !approvedClaims || !Array.isArray(approvedClaims)) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['requestId', 'approvedClaims'],
      });
    }

    // Get consent request
    const request = await db.queryOne(
      `SELECT * FROM consent_requests WHERE request_id = $1`,
      [requestId]
    );

    if (!request) {
      return res.status(404).json({ error: 'Consent request not found' });
    }

    // Validate request status
    if (request.status !== CONSENT_STATUS.PENDING) {
      return res.status(409).json({
        error: 'Consent request already processed',
        status: request.status,
      });
    }

    // Check expiration
    if (new Date(request.expires_at) < new Date()) {
      await db.query(
        `UPDATE consent_requests SET status = $1 WHERE request_id = $2`,
        [CONSENT_STATUS.EXPIRED, requestId]
      );
      return res.status(410).json({ error: 'Consent request has expired' });
    }

    // Generate consent token
    const consentToken = generateConsentToken(
      request.rp_id,
      approvedClaims,
      Date.now(),
      userId
    );

    // Generate consent receipt
    const consentId = uuidv4();
    const receipt = {
      consentId,
      requestId,
      userId,
      rpId: request.rp_id,
      rpName: request.rp_name,
      approvedClaims,
      purpose: request.purpose,
      credentialType: request.credential_type,
      credentialId,
      intentToRetain: request.intent_to_retain,
      consentToken,
      consentedAt: new Date().toISOString(),
      additionalConditions,
    };

    // Update request and create consent record in transaction
    await db.transaction(async (client) => {
      // Update consent request
      await client.query(
        `UPDATE consent_requests
         SET status = $1, user_id = $2, updated_at = NOW()
         WHERE request_id = $3`,
        [CONSENT_STATUS.APPROVED, userId, requestId]
      );

      // Create consent record
      await client.query(
        `INSERT INTO user_consents (
          consent_id, request_id, user_id, rp_id, rp_name,
          approved_claims, purpose, credential_type, credential_id,
          intent_to_retain, consent_token, additional_conditions
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          consentId,
          requestId,
          userId,
          request.rp_id,
          request.rp_name,
          JSON.stringify(approvedClaims),
          request.purpose,
          request.credential_type,
          credentialId,
          request.intent_to_retain,
          consentToken,
          JSON.stringify(additionalConditions || {}),
        ]
      );
    });

    // Clear request from cache
    await redis.del(`consent:request:${requestId}`);

    // Notify callback URL if provided
    if (request.callback_url) {
      // In production, use a job queue for reliable callback delivery
      try {
        await fetch(request.callback_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            consentId,
            status: 'approved',
            approvedClaims,
            consentToken,
          }),
        });
      } catch (callbackError) {
        console.error('Callback notification failed:', callbackError);
      }
    }

    res.json({
      success: true,
      consentId,
      consentToken,
      approvedClaims,
      receipt,
    });
  } catch (error) {
    console.error('Consent approval error:', error);
    res.status(500).json({ error: 'Failed to approve consent', details: error.message });
  }
});

/**
 * POST /api/consent/deny
 * User denies consent request
 */
router.post('/deny', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const { requestId, reason } = req.body;

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    // Get consent request
    const request = await db.queryOne(
      `SELECT * FROM consent_requests WHERE request_id = $1`,
      [requestId]
    );

    if (!request) {
      return res.status(404).json({ error: 'Consent request not found' });
    }

    if (request.status !== CONSENT_STATUS.PENDING) {
      return res.status(409).json({
        error: 'Consent request already processed',
        status: request.status,
      });
    }

    // Update request status
    await db.query(
      `UPDATE consent_requests
       SET status = $1, user_id = $2, denial_reason = $3, updated_at = NOW()
       WHERE request_id = $4`,
      [CONSENT_STATUS.DENIED, userId, reason, requestId]
    );

    // Clear from cache
    await redis.del(`consent:request:${requestId}`);

    // Notify callback URL if provided
    if (request.callback_url) {
      try {
        await fetch(request.callback_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestId,
            status: 'denied',
            reason,
          }),
        });
      } catch (callbackError) {
        console.error('Callback notification failed:', callbackError);
      }
    }

    res.json({
      success: true,
      message: 'Consent denied',
      requestId,
    });
  } catch (error) {
    console.error('Consent denial error:', error);
    res.status(500).json({ error: 'Failed to deny consent', details: error.message });
  }
});

/**
 * GET /api/consent/history
 * Get user's consent history
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const { limit = 50, offset = 0, status, rpId } = req.query;

    // Build query
    let query = `
      SELECT uc.*, cr.rp_logo, cr.rp_url
      FROM user_consents uc
      LEFT JOIN consent_requests cr ON uc.request_id = cr.request_id
      WHERE uc.user_id = $1
    `;
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      query += ` AND uc.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (rpId) {
      query += ` AND uc.rp_id = $${paramIndex}`;
      params.push(rpId);
      paramIndex++;
    }

    query += ` ORDER BY uc.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const consents = await db.queryAll(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM user_consents WHERE user_id = $1`;
    const countParams = [userId];
    if (status) {
      countQuery += ` AND status = $2`;
      countParams.push(status);
    }
    const countResult = await db.queryOne(countQuery, countParams);

    res.json({
      success: true,
      total: parseInt(countResult.count),
      offset: parseInt(offset),
      limit: parseInt(limit),
      consents: consents.map(c => ({
        consentId: c.consent_id,
        requestId: c.request_id,
        rpId: c.rp_id,
        rpName: c.rp_name,
        rpLogo: c.rp_logo,
        rpUrl: c.rp_url,
        approvedClaims: c.approved_claims,
        purpose: c.purpose,
        credentialType: c.credential_type,
        status: c.status || 'active',
        consentedAt: c.created_at,
        revokedAt: c.revoked_at,
      })),
    });
  } catch (error) {
    console.error('Consent history error:', error);
    res.status(500).json({ error: 'Failed to retrieve consent history', details: error.message });
  }
});

/**
 * DELETE /api/consent/:id
 * Revoke a consent
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.user;
    const { reason } = req.body;

    // Get consent
    const consent = await db.queryOne(
      `SELECT * FROM user_consents WHERE consent_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (!consent) {
      return res.status(404).json({ error: 'Consent not found' });
    }

    if (consent.status === CONSENT_STATUS.REVOKED) {
      return res.status(409).json({ error: 'Consent already revoked' });
    }

    // Revoke consent
    await db.query(
      `UPDATE user_consents
       SET status = $1, revocation_reason = $2, revoked_at = NOW()
       WHERE consent_id = $3`,
      [CONSENT_STATUS.REVOKED, reason, id]
    );

    // Log revocation for audit
    await db.query(
      `INSERT INTO consent_audit_log (
        consent_id, action, user_id, reason, ip_address
      ) VALUES ($1, 'revoke', $2, $3, $4)`,
      [id, userId, reason, req.ip]
    );

    res.json({
      success: true,
      message: 'Consent revoked',
      consentId: id,
      revokedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Consent revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke consent', details: error.message });
  }
});

/**
 * GET /api/consent/verify/:token
 * Verify a consent token (for RPs)
 */
router.get('/verify/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const consent = await db.queryOne(
      `SELECT * FROM user_consents WHERE consent_token = $1`,
      [token]
    );

    if (!consent) {
      return res.status(404).json({ error: 'Consent not found', valid: false });
    }

    if (consent.status === CONSENT_STATUS.REVOKED) {
      return res.status(410).json({
        error: 'Consent has been revoked',
        valid: false,
        revokedAt: consent.revoked_at,
      });
    }

    res.json({
      valid: true,
      consentId: consent.consent_id,
      rpId: consent.rp_id,
      approvedClaims: consent.approved_claims,
      purpose: consent.purpose,
      credentialType: consent.credential_type,
      consentedAt: consent.created_at,
    });
  } catch (error) {
    console.error('Consent verification error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * GET /api/consent/rp/:rpId
 * Get consents for a specific RP (for user review)
 */
router.get('/rp/:rpId', authenticate, async (req, res) => {
  try {
    const { rpId } = req.params;
    const { userId } = req.user;

    const consents = await db.queryAll(
      `SELECT * FROM user_consents
       WHERE user_id = $1 AND rp_id = $2
       ORDER BY created_at DESC`,
      [userId, rpId]
    );

    res.json({
      success: true,
      rpId,
      consents: consents.map(c => ({
        consentId: c.consent_id,
        approvedClaims: c.approved_claims,
        purpose: c.purpose,
        status: c.status || 'active',
        consentedAt: c.created_at,
        revokedAt: c.revoked_at,
      })),
    });
  } catch (error) {
    console.error('RP consents error:', error);
    res.status(500).json({ error: 'Failed to retrieve consents', details: error.message });
  }
});

/**
 * POST /api/consent/bulk-revoke
 * Revoke multiple consents at once
 */
router.post('/bulk-revoke', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    const { consentIds, rpId, reason } = req.body;

    let query;
    let params;

    if (consentIds && Array.isArray(consentIds)) {
      // Revoke specific consents
      query = `
        UPDATE user_consents
        SET status = $1, revocation_reason = $2, revoked_at = NOW()
        WHERE consent_id = ANY($3) AND user_id = $4 AND status != $1
        RETURNING consent_id
      `;
      params = [CONSENT_STATUS.REVOKED, reason, consentIds, userId];
    } else if (rpId) {
      // Revoke all consents for an RP
      query = `
        UPDATE user_consents
        SET status = $1, revocation_reason = $2, revoked_at = NOW()
        WHERE rp_id = $3 AND user_id = $4 AND status != $1
        RETURNING consent_id
      `;
      params = [CONSENT_STATUS.REVOKED, reason, rpId, userId];
    } else {
      return res.status(400).json({
        error: 'Either consentIds or rpId required',
      });
    }

    const result = await db.queryAll(query, params);

    res.json({
      success: true,
      revokedCount: result.length,
      revokedIds: result.map(r => r.consent_id),
    });
  } catch (error) {
    console.error('Bulk revocation error:', error);
    res.status(500).json({ error: 'Failed to revoke consents', details: error.message });
  }
});

/**
 * GET /api/consent/stats
 * Get consent statistics for user
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    const { userId } = req.user;

    const stats = await db.queryOne(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IS NULL OR status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'revoked') as revoked,
        COUNT(DISTINCT rp_id) as unique_rps,
        COUNT(DISTINCT credential_type) as credential_types
       FROM user_consents
       WHERE user_id = $1`,
      [userId]
    );

    // Get top RPs
    const topRps = await db.queryAll(
      `SELECT rp_id, rp_name, COUNT(*) as consent_count
       FROM user_consents
       WHERE user_id = $1 AND (status IS NULL OR status = 'active')
       GROUP BY rp_id, rp_name
       ORDER BY consent_count DESC
       LIMIT 5`,
      [userId]
    );

    // Get recent activity
    const recentActivity = await db.queryAll(
      `SELECT consent_id, rp_name, purpose, created_at
       FROM user_consents
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );

    res.json({
      success: true,
      stats: {
        total: parseInt(stats.total),
        active: parseInt(stats.active),
        revoked: parseInt(stats.revoked),
        uniqueRPs: parseInt(stats.unique_rps),
        credentialTypes: parseInt(stats.credential_types),
      },
      topRPs: topRps.map(rp => ({
        rpId: rp.rp_id,
        rpName: rp.rp_name,
        consentCount: parseInt(rp.consent_count),
      })),
      recentActivity: recentActivity.map(a => ({
        consentId: a.consent_id,
        rpName: a.rp_name,
        purpose: a.purpose,
        createdAt: a.created_at,
      })),
    });
  } catch (error) {
    console.error('Consent stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve stats', details: error.message });
  }
});

export default router;
