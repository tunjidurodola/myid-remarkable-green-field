/**
 * User Profile Routes
 * Handles user profile retrieval and updates
 */

import { Router } from 'express';
import jwt from 'jsonwebtoken';
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
 * GET /api/user/profile
 * Get user profile with MasterCode
 *
 * Headers:
 * - Authorization: Bearer <token>
 *
 * Query params:
 * - user_id: UUID (optional, uses token if not provided)
 *
 * Response:
 * - user_id: UUID
 * - keycloak_sub: string (email)
 * - status: string
 * - mastercode: object (mc, hash_b3, hash_b3_160)
 * - trustcodes: array
 * - passkeys_count: number
 * - created_at: timestamp
 * - updated_at: timestamp
 */
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const userId = req.query.user_id || req.user.userId;

    // Get user with mastercode
    const user = await db.queryOne(
      `SELECT u.user_id, u.keycloak_sub, u.status, u.created_at, u.updated_at,
              ma.mc, ma.assigned_at,
              m.hash_b3, m.hash_b3_160
       FROM users u
       LEFT JOIN mastercode_assignments ma ON u.user_id = ma.user_id
       LEFT JOIN mastercodes m ON ma.mc = m.mc
       WHERE u.user_id = $1`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get trustcodes
    const trustcodes = await db.queryAll(
      `SELECT trustcode, status, created_at, updated_at
       FROM trustcodes
       WHERE mastercode = $1
       ORDER BY created_at DESC`,
      [user.mc]
    );

    // Get passkey count
    const passkeyCount = await db.queryOne(
      `SELECT COUNT(*) as count FROM passkey_credentials WHERE user_id = $1`,
      [userId]
    );

    res.json({
      success: true,
      user: {
        user_id: user.user_id,
        keycloak_sub: user.keycloak_sub,
        status: user.status,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      mastercode: user.mc ? {
        mc: user.mc,
        hash_b3: user.hash_b3,
        hash_b3_160: user.hash_b3_160,
        assigned_at: user.assigned_at,
      } : null,
      trustcodes,
      passkeys_count: parseInt(passkeyCount?.count || '0', 10),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile', details: error.message });
  }
});

/**
 * GET /api/user/profile/:user_id
 * Get user profile by user_id (public endpoint with limited info)
 */
router.get('/profile/:user_id', async (req, res) => {
  try {
    const { user_id } = req.params;

    const user = await db.queryOne(
      `SELECT u.user_id, u.status, u.created_at,
              ma.mc
       FROM users u
       LEFT JOIN mastercode_assignments ma ON u.user_id = ma.user_id
       WHERE u.user_id = $1`,
      [user_id]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user_id: user.user_id,
      status: user.status,
      has_mastercode: !!user.mc,
      created_at: user.created_at,
    });
  } catch (error) {
    console.error('Get profile by id error:', error);
    res.status(500).json({ error: 'Failed to get profile', details: error.message });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile
 *
 * Request body:
 * - keycloak_sub: string (optional)
 * - status: string (optional)
 */
router.put('/profile', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { keycloak_sub, status } = req.body;

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (keycloak_sub) {
      updates.push(`keycloak_sub = $${paramIndex++}`);
      values.push(keycloak_sub);
    }

    if (status && ['active', 'inactive', 'suspended'].includes(status)) {
      updates.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await db.queryOne(
      `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({
      success: true,
      user: result,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

/**
 * DELETE /api/user/profile
 * Delete user account (soft delete - sets status to 'deleted')
 */
router.delete('/profile', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;

    await db.transaction(async (client) => {
      // Soft delete user
      await client.query(
        `UPDATE users SET status = 'deleted', updated_at = NOW() WHERE user_id = $1`,
        [userId]
      );

      // Release mastercode back to pool
      const assignment = await client.query(
        `DELETE FROM mastercode_assignments WHERE user_id = $1 RETURNING mc`,
        [userId]
      );

      if (assignment.rows.length > 0) {
        await client.query(
          `UPDATE mastercodes SET status = 'pool' WHERE mc = $1`,
          [assignment.rows[0].mc]
        );
      }

      // Delete passkey credentials
      await client.query(
        `DELETE FROM passkey_credentials WHERE user_id = $1`,
        [userId]
      );

      // Invalidate all sessions
      // Note: In production, you'd want to iterate through and delete all user sessions
    });

    res.json({
      success: true,
      message: 'Account deleted',
    });
  } catch (error) {
    console.error('Delete profile error:', error);
    res.status(500).json({ error: 'Failed to delete profile', details: error.message });
  }
});

export default router;
