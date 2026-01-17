/**
 * TrustCode Routes
 * Handles TrustCode issuance and verification
 * TrustCodes are derived from MasterCodes for specific trust purposes
 */

import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { blake3 } from '@noble/hashes/blake3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import db from '../lib/db.mjs';
import redis from '../lib/redis.mjs';

const router = Router();

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'myid-jwt-secret-key-change-in-production';

/**
 * JWT authentication middleware
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * API Key authentication middleware
 */
function authenticateAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/**
 * Generate a TrustCode in the format XXX-XXX-XXX (9 chars)
 * Derived from MasterCode using BLAKE3
 * @param {string} mastercode - The parent MasterCode
 * @param {string} purpose - Purpose identifier for derivation
 * @returns {string} - TrustCode
 */
function generateTrustCode(mastercode, purpose = 'default') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const input = `${mastercode}:${purpose}:${Date.now()}`;
  const hash = blake3(new TextEncoder().encode(input));

  // Generate exactly 9 characters (no dashes) to match DB schema
  let trustcode = '';
  for (let i = 0; i < 9; i++) {
    trustcode += chars[hash[i] % chars.length];
  }

  return trustcode;
}

/**
 * Compute BLAKE3 hash for trust code verification
 */
function computeHash(input) {
  const hash = blake3(input);
  return bytesToHex(hash);
}

/**
 * POST /api/trustcode/issue
 * Issue a new TrustCode from a MasterCode
 *
 * Headers:
 * - Authorization: Bearer <token>
 *
 * Request body:
 * - mastercode: string (optional, uses user's assigned MC if not provided)
 * - purpose: string (optional, default 'general')
 * - metadata: object (optional, additional data)
 *
 * Response:
 * - trustcode: string (XXX-XXX-XXX format)
 * - mastercode: string (parent MC)
 * - status: string
 */
router.post('/issue', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    let { mastercode, purpose, metadata } = req.body;

    // Get user's mastercode if not provided
    if (!mastercode) {
      const assignment = await db.queryOne(
        `SELECT mc FROM mastercode_assignments WHERE user_id = $1`,
        [userId]
      );

      if (!assignment) {
        return res.status(400).json({ error: 'User does not have a MasterCode assigned' });
      }

      mastercode = assignment.mc;
    } else {
      // Verify user owns this mastercode
      const assignment = await db.queryOne(
        `SELECT mc FROM mastercode_assignments WHERE mc = $1 AND user_id = $2`,
        [mastercode, userId]
      );

      if (!assignment) {
        return res.status(403).json({ error: 'Not authorized to issue TrustCodes for this MasterCode' });
      }
    }

    // Verify mastercode is active
    const mc = await db.queryOne(
      `SELECT status FROM mastercodes WHERE mc = $1`,
      [mastercode]
    );

    if (!mc || mc.status === 'revoked') {
      return res.status(400).json({ error: 'MasterCode is not active' });
    }

    // Generate unique trustcode with retry logic
    let trustcode;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      trustcode = generateTrustCode(mastercode, purpose || 'general');

      const existing = await db.queryOne(
        'SELECT trustcode FROM trustcodes WHERE trustcode = $1',
        [trustcode]
      );

      if (!existing) break;
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return res.status(500).json({ error: 'Failed to generate unique TrustCode' });
    }

    // Insert trustcode
    await db.query(
      `INSERT INTO trustcodes (trustcode, mastercode, status)
       VALUES ($1, $2, 'active')`,
      [trustcode, mastercode]
    );

    // Cache in Redis for quick verification
    await redis.setCache(`trustcode:${trustcode}`, {
      mastercode,
      status: 'active',
      issuedAt: new Date().toISOString(),
      purpose: purpose || 'general',
    }, 86400); // 24 hours cache

    res.status(201).json({
      success: true,
      trustcode,
      mastercode,
      status: 'active',
      purpose: purpose || 'general',
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('TrustCode issue error:', error);
    res.status(500).json({ error: 'Failed to issue TrustCode', details: error.message });
  }
});

/**
 * GET /api/trustcode/:trustcode
 * Get TrustCode details
 */
router.get('/:trustcode', async (req, res) => {
  try {
    const { trustcode } = req.params;

    // Try cache first
    const cached = await redis.getCache(`trustcode:${trustcode}`);
    if (cached) {
      return res.json({
        success: true,
        trustcode,
        ...cached,
        source: 'cache',
      });
    }

    // Query database
    const tc = await db.queryOne(
      `SELECT trustcode, mastercode, status, created_at, updated_at
       FROM trustcodes
       WHERE trustcode = $1`,
      [trustcode]
    );

    if (!tc) {
      return res.status(404).json({ error: 'TrustCode not found' });
    }

    // Update cache
    await redis.setCache(`trustcode:${trustcode}`, {
      mastercode: tc.mastercode,
      status: tc.status,
      issuedAt: tc.created_at,
    }, 86400);

    res.json({
      success: true,
      trustcode: tc.trustcode,
      mastercode: tc.mastercode,
      status: tc.status,
      created_at: tc.created_at,
      updated_at: tc.updated_at,
    });
  } catch (error) {
    console.error('Get trustcode error:', error);
    res.status(500).json({ error: 'Failed to get TrustCode', details: error.message });
  }
});

/**
 * POST /api/trustcode/verify
 * Verify a TrustCode is valid
 *
 * Request body:
 * - trustcode: string
 *
 * Response:
 * - valid: boolean
 * - status: string
 * - mastercode_status: string
 */
router.post('/verify', async (req, res) => {
  try {
    const { trustcode } = req.body;

    if (!trustcode) {
      return res.status(400).json({ error: 'TrustCode is required' });
    }

    // Try cache first
    const cached = await redis.getCache(`trustcode:${trustcode}`);
    if (cached && cached.status === 'active') {
      return res.json({
        success: true,
        valid: true,
        trustcode,
        status: cached.status,
      });
    }

    // Query database with mastercode status
    const tc = await db.queryOne(
      `SELECT t.trustcode, t.mastercode, t.status as trustcode_status,
              m.status as mastercode_status
       FROM trustcodes t
       JOIN mastercodes m ON t.mastercode = m.mc
       WHERE t.trustcode = $1`,
      [trustcode]
    );

    if (!tc) {
      return res.json({
        success: true,
        valid: false,
        reason: 'TrustCode not found',
      });
    }

    const isValid = tc.trustcode_status === 'active' && tc.mastercode_status === 'assigned';

    // Update cache
    await redis.setCache(`trustcode:${trustcode}`, {
      mastercode: tc.mastercode,
      status: tc.trustcode_status,
    }, 86400);

    res.json({
      success: true,
      valid: isValid,
      trustcode: tc.trustcode,
      status: tc.trustcode_status,
      mastercode_status: tc.mastercode_status,
    });
  } catch (error) {
    console.error('Verify trustcode error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * GET /api/trustcode/by-mastercode/:mc
 * List all TrustCodes for a MasterCode
 */
router.get('/by-mastercode/:mc', authenticateJWT, async (req, res) => {
  try {
    const { mc } = req.params;
    const userId = req.user.userId;

    // Verify user owns this mastercode
    const assignment = await db.queryOne(
      `SELECT mc FROM mastercode_assignments WHERE mc = $1 AND user_id = $2`,
      [mc, userId]
    );

    if (!assignment) {
      return res.status(403).json({ error: 'Not authorized to view TrustCodes for this MasterCode' });
    }

    const trustcodes = await db.queryAll(
      `SELECT trustcode, status, created_at, updated_at
       FROM trustcodes
       WHERE mastercode = $1
       ORDER BY created_at DESC`,
      [mc]
    );

    res.json({
      success: true,
      mastercode: mc,
      count: trustcodes.length,
      trustcodes,
    });
  } catch (error) {
    console.error('List trustcodes error:', error);
    res.status(500).json({ error: 'Failed to list TrustCodes', details: error.message });
  }
});

/**
 * POST /api/trustcode/revoke
 * Revoke a TrustCode
 *
 * Request body:
 * - trustcode: string
 * - reason: string (optional)
 */
router.post('/revoke', authenticateJWT, async (req, res) => {
  try {
    const { trustcode, reason } = req.body;
    const userId = req.user.userId;

    if (!trustcode) {
      return res.status(400).json({ error: 'TrustCode is required' });
    }

    // Get trustcode and verify ownership
    const tc = await db.queryOne(
      `SELECT t.trustcode, t.mastercode, ma.user_id
       FROM trustcodes t
       JOIN mastercode_assignments ma ON t.mastercode = ma.mc
       WHERE t.trustcode = $1`,
      [trustcode]
    );

    if (!tc) {
      return res.status(404).json({ error: 'TrustCode not found' });
    }

    if (tc.user_id !== userId) {
      return res.status(403).json({ error: 'Not authorized to revoke this TrustCode' });
    }

    // Revoke
    await db.query(
      `UPDATE trustcodes SET status = 'revoked', updated_at = NOW() WHERE trustcode = $1`,
      [trustcode]
    );

    // Update cache
    await redis.deleteCache(`trustcode:${trustcode}`);

    res.json({
      success: true,
      trustcode,
      status: 'revoked',
      reason: reason || 'User requested revocation',
    });
  } catch (error) {
    console.error('Revoke trustcode error:', error);
    res.status(500).json({ error: 'Revocation failed', details: error.message });
  }
});

/**
 * POST /api/trustcode/batch-issue
 * Issue multiple TrustCodes at once (admin or authenticated)
 *
 * Request body:
 * - mastercode: string
 * - count: number (max 10)
 * - purpose: string (optional)
 */
router.post('/batch-issue', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    let { mastercode, count, purpose } = req.body;

    count = Math.min(parseInt(count || '1', 10), 10);

    // Get user's mastercode if not provided
    if (!mastercode) {
      const assignment = await db.queryOne(
        `SELECT mc FROM mastercode_assignments WHERE user_id = $1`,
        [userId]
      );

      if (!assignment) {
        return res.status(400).json({ error: 'User does not have a MasterCode assigned' });
      }

      mastercode = assignment.mc;
    } else {
      // Verify user owns this mastercode
      const assignment = await db.queryOne(
        `SELECT mc FROM mastercode_assignments WHERE mc = $1 AND user_id = $2`,
        [mastercode, userId]
      );

      if (!assignment) {
        return res.status(403).json({ error: 'Not authorized to issue TrustCodes for this MasterCode' });
      }
    }

    const issued = [];

    for (let i = 0; i < count; i++) {
      let trustcode;
      let attempts = 0;

      while (attempts < 10) {
        trustcode = generateTrustCode(mastercode, `${purpose || 'batch'}-${i}`);
        const existing = await db.queryOne(
          'SELECT trustcode FROM trustcodes WHERE trustcode = $1',
          [trustcode]
        );
        if (!existing) break;
        attempts++;
      }

      if (attempts >= 10) continue;

      await db.query(
        `INSERT INTO trustcodes (trustcode, mastercode, status) VALUES ($1, $2, 'active')`,
        [trustcode, mastercode]
      );

      await redis.setCache(`trustcode:${trustcode}`, {
        mastercode,
        status: 'active',
        issuedAt: new Date().toISOString(),
        purpose: purpose || 'batch',
      }, 86400);

      issued.push({
        trustcode,
        status: 'active',
      });
    }

    res.status(201).json({
      success: true,
      mastercode,
      count: issued.length,
      trustcodes: issued,
    });
  } catch (error) {
    console.error('Batch issue error:', error);
    res.status(500).json({ error: 'Batch issue failed', details: error.message });
  }
});

export default router;
