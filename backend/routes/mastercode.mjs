/**
 * MasterCode Routes
 * Handles MasterCode generation and management using BLAKE3 hashing
 */

import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { blake3 } from '@noble/hashes/blake3.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import db from '../lib/db.mjs';

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
 * API Key authentication middleware (for admin/batch operations)
 */
function authenticateAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

/**
 * Generate a MasterCode in the format XXXX-XXXX-XXXX-XXXX
 * Uses cryptographically secure random bytes
 */
function generateMasterCodeValue() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, 1, I)
  const segments = [];

  for (let s = 0; s < 4; s++) {
    let segment = '';
    for (let i = 0; i < 4; i++) {
      const randomByte = crypto.randomBytes(1)[0];
      segment += chars[randomByte % chars.length];
    }
    segments.push(segment);
  }

  return segments.join('-');
}

/**
 * Compute BLAKE3 hash (256-bit / 32 bytes)
 * @param {string} input - Input string
 * @returns {string} - Hex encoded hash
 */
function computeBlake3(input) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const hash = blake3(data);
  return bytesToHex(hash);
}

/**
 * Compute BLAKE3-160 hash (160-bit / 20 bytes)
 * This is BLAKE3 truncated to 160 bits for compatibility
 * @param {string} input - Input string
 * @returns {string} - Hex encoded hash (40 chars)
 */
function computeBlake3_160(input) {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const hash = blake3(data, { dkLen: 20 }); // 20 bytes = 160 bits
  return bytesToHex(hash);
}

/**
 * POST /api/mastercode/generate
 * Generate a new BLAKE3 MasterCode and add to pool
 *
 * Headers:
 * - x-api-key: API key for admin access
 *
 * Request body:
 * - count: number (optional, default 1, max 100)
 *
 * Response:
 * - mastercodes: array of generated mastercodes
 */
router.post('/generate', authenticateAPIKey, async (req, res) => {
  try {
    const count = Math.min(parseInt(req.body.count || '1', 10), 100);
    const generated = [];

    for (let i = 0; i < count; i++) {
      // Generate unique mastercode with retry logic
      let mc, hash_b3, hash_b3_160;
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        mc = generateMasterCodeValue();
        hash_b3 = computeBlake3(mc);
        hash_b3_160 = computeBlake3_160(mc);

        // Check if already exists
        const existing = await db.queryOne(
          'SELECT mc FROM mastercodes WHERE mc = $1',
          [mc]
        );

        if (!existing) break;
        attempts++;
      }

      if (attempts >= maxAttempts) {
        continue; // Skip this one
      }

      // Insert into pool
      await db.query(
        `INSERT INTO mastercodes (mc, hash_b3, hash_b3_160, status)
         VALUES ($1, $2, $3, 'pool')`,
        [mc, hash_b3, hash_b3_160]
      );

      generated.push({
        mc,
        hash_b3,
        hash_b3_160,
        status: 'pool',
      });
    }

    res.json({
      success: true,
      count: generated.length,
      mastercodes: generated,
    });
  } catch (error) {
    console.error('MasterCode generation error:', error);
    res.status(500).json({ error: 'Generation failed', details: error.message });
  }
});

/**
 * POST /api/mastercode/assign
 * Assign a MasterCode from pool to a user
 *
 * Request body:
 * - user_id: UUID
 *
 * Response:
 * - mastercode: assigned mastercode details
 */
router.post('/assign', authenticateJWT, async (req, res) => {
  try {
    const userId = req.body.user_id || req.user.userId;

    // Check if user already has a mastercode
    const existing = await db.queryOne(
      'SELECT mc FROM mastercode_assignments WHERE user_id = $1',
      [userId]
    );

    if (existing) {
      return res.status(409).json({
        error: 'User already has a MasterCode assigned',
        mastercode: existing.mc,
      });
    }

    // Assign from pool
    const result = await db.transaction(async (client) => {
      // Get an available mastercode
      const mcResult = await client.query(
        `UPDATE mastercodes
         SET status = 'assigned'
         WHERE mc = (
           SELECT mc FROM mastercodes
           WHERE status = 'pool'
           ORDER BY iat ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
         )
         RETURNING mc, hash_b3, hash_b3_160`,
      );

      if (mcResult.rows.length === 0) {
        throw new Error('No MasterCodes available in pool');
      }

      const mastercode = mcResult.rows[0];

      // Create assignment
      await client.query(
        `INSERT INTO mastercode_assignments (mc, user_id) VALUES ($1, $2)`,
        [mastercode.mc, userId]
      );

      return mastercode;
    });

    res.json({
      success: true,
      mastercode: result,
    });
  } catch (error) {
    console.error('MasterCode assignment error:', error);
    res.status(500).json({ error: 'Assignment failed', details: error.message });
  }
});

/**
 * GET /api/mastercode/pool/status
 * Get pool status (admin only)
 */
router.get('/pool/status', authenticateAPIKey, async (req, res) => {
  try {
    const stats = await db.queryOne(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pool') as available,
         COUNT(*) FILTER (WHERE status = 'assigned') as assigned,
         COUNT(*) FILTER (WHERE status = 'revoked') as revoked,
         COUNT(*) as total
       FROM mastercodes`
    );

    res.json({
      success: true,
      pool: {
        available: parseInt(stats.available, 10),
        assigned: parseInt(stats.assigned, 10),
        revoked: parseInt(stats.revoked, 10),
        total: parseInt(stats.total, 10),
      },
    });
  } catch (error) {
    console.error('Pool status error:', error);
    res.status(500).json({ error: 'Failed to get pool status', details: error.message });
  }
});

/**
 * GET /api/mastercode/:mc
 * Get MasterCode details (without sensitive info)
 */
router.get('/:mc', async (req, res) => {
  try {
    const { mc } = req.params;

    const mastercode = await db.queryOne(
      `SELECT mc, status, iat FROM mastercodes WHERE mc = $1`,
      [mc]
    );

    if (!mastercode) {
      return res.status(404).json({ error: 'MasterCode not found' });
    }

    res.json({
      success: true,
      mastercode: {
        mc: mastercode.mc,
        status: mastercode.status,
        created_at: mastercode.iat,
      },
    });
  } catch (error) {
    console.error('Get mastercode error:', error);
    res.status(500).json({ error: 'Failed to get mastercode', details: error.message });
  }
});

/**
 * POST /api/mastercode/verify
 * Verify a MasterCode hash
 *
 * Request body:
 * - mc: MasterCode string
 * - hash: BLAKE3 hash to verify against
 *
 * Response:
 * - valid: boolean
 */
router.post('/verify', async (req, res) => {
  try {
    const { mc, hash } = req.body;

    if (!mc || !hash) {
      return res.status(400).json({ error: 'MasterCode and hash are required' });
    }

    // Compute hash
    const computedHash = computeBlake3(mc);
    const computedHash160 = computeBlake3_160(mc);

    // Verify against database
    const stored = await db.queryOne(
      'SELECT hash_b3, hash_b3_160, status FROM mastercodes WHERE mc = $1',
      [mc]
    );

    if (!stored) {
      return res.json({
        success: true,
        valid: false,
        reason: 'MasterCode not found',
      });
    }

    const isValid = (hash === stored.hash_b3 || hash === stored.hash_b3_160) &&
                    stored.status !== 'revoked';

    res.json({
      success: true,
      valid: isValid,
      status: stored.status,
      hash_match: hash === stored.hash_b3 || hash === stored.hash_b3_160,
    });
  } catch (error) {
    console.error('Verify mastercode error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * POST /api/mastercode/revoke
 * Revoke a MasterCode (admin only)
 *
 * Request body:
 * - mc: MasterCode to revoke
 * - reason: string (optional)
 */
router.post('/revoke', authenticateAPIKey, async (req, res) => {
  try {
    const { mc, reason } = req.body;

    if (!mc) {
      return res.status(400).json({ error: 'MasterCode is required' });
    }

    const result = await db.transaction(async (client) => {
      // Update mastercode status
      const mcResult = await client.query(
        `UPDATE mastercodes SET status = 'revoked' WHERE mc = $1 RETURNING mc`,
        [mc]
      );

      if (mcResult.rowCount === 0) {
        throw new Error('MasterCode not found');
      }

      // Remove assignment if exists
      await client.query(
        `DELETE FROM mastercode_assignments WHERE mc = $1`,
        [mc]
      );

      // Revoke associated trustcodes
      await client.query(
        `UPDATE trustcodes SET status = 'revoked', updated_at = NOW() WHERE mastercode = $1`,
        [mc]
      );

      return { mc, reason };
    });

    res.json({
      success: true,
      revoked: result.mc,
      reason: result.reason,
    });
  } catch (error) {
    console.error('Revoke mastercode error:', error);
    res.status(500).json({ error: 'Revocation failed', details: error.message });
  }
});

// Export helper functions for use in other modules
export { computeBlake3, computeBlake3_160, generateMasterCodeValue };
export default router;
