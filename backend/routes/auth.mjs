/**
 * Authentication Routes
 * Handles user registration, login, and session management
 */

import { Router } from 'express';
import { getBackendSecrets } from "../lib/secrets.mjs";
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../lib/db.mjs';
import redis from '../lib/redis.mjs';

const router = Router();

// JWT configuration
const { jwt_secret: JWT_SECRET } = await getBackendSecrets();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Hash password using SHA-256 with salt
 * Note: In production, use bcrypt or argon2
 */
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify password against stored hash
 */
function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

/**
 * Generate JWT token for user
 */
function generateToken(userId, keycloakSub) {
  return jwt.sign(
    { userId, keycloakSub, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * POST /api/auth/register
 * Register a new user
 *
 * Request body:
 * - email: string (used as keycloak_sub for now)
 * - password: string (optional, for password-based auth)
 *
 * Response:
 * - user_id: UUID
 * - keycloak_sub: string
 * - mastercode: string (if assigned)
 * - token: JWT token
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await db.queryOne(
      'SELECT user_id FROM users WHERE keycloak_sub = $1',
      [email]
    );

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Start transaction for user creation and mastercode assignment
    const result = await db.transaction(async (client) => {
      // Create password hash if provided
      let passwordHash = null;
      if (password) {
        const { hash, salt } = hashPassword(password);
        passwordHash = `${salt}:${hash}`;
      }

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (keycloak_sub, password_hash, status)
         VALUES ($1, $2, 'active')
         RETURNING user_id, keycloak_sub, status, created_at`,
        [email, passwordHash]
      );
      const user = userResult.rows[0];

      // Try to assign a mastercode from the pool
      let mastercode = null;
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

      if (mcResult.rows.length > 0) {
        mastercode = mcResult.rows[0];

        // Create assignment record
        await client.query(
          `INSERT INTO mastercode_assignments (mc, user_id) VALUES ($1, $2)`,
          [mastercode.mc, user.user_id]
        );
      }

      return { user, mastercode };
    });

    // Generate JWT token
    const token = generateToken(result.user.user_id, result.user.keycloak_sub);

    // Create session in Redis
    await redis.createSession(result.user.user_id, {
      userId: result.user.user_id,
      keycloakSub: result.user.keycloak_sub,
      mastercode: result.mastercode?.mc || null,
    });

    res.status(201).json({
      success: true,
      user_id: result.user.user_id,
      keycloak_sub: result.user.keycloak_sub,
      mastercode: result.mastercode?.mc || null,
      token,
      created_at: result.user.created_at,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return token
 *
 * Request body:
 * - email: string
 * - password: string
 *
 * Response:
 * - user_id: UUID
 * - token: JWT token
 * - mastercode: string (if assigned)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check rate limit
    const rateLimit = await redis.checkRateLimit(`login:${email}`, 5, 60);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many login attempts',
        retryAfter: rateLimit.resetIn,
      });
    }

    // Get user with password
    const user = await db.queryOne(
      `SELECT u.user_id, u.keycloak_sub, u.password_hash, u.status,
              ma.mc as mastercode
       FROM users u
       LEFT JOIN mastercode_assignments ma ON u.user_id = ma.user_id
       WHERE u.keycloak_sub = $1`,
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: 'Password authentication not enabled for this account' });
    }

    // Verify password
    const [salt, storedHash] = user.password_hash.split(':');
    const isValid = verifyPassword(password, storedHash, salt);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = generateToken(user.user_id, user.keycloak_sub);

    // Create session in Redis
    const sessionId = uuidv4();
    await redis.createSession(sessionId, {
      userId: user.user_id,
      keycloakSub: user.keycloak_sub,
      mastercode: user.mastercode,
      loginAt: new Date().toISOString(),
    });

    // Update user's updated_at
    await db.query(
      'UPDATE users SET updated_at = NOW() WHERE user_id = $1',
      [user.user_id]
    );

    res.json({
      success: true,
      user_id: user.user_id,
      keycloak_sub: user.keycloak_sub,
      mastercode: user.mastercode,
      token,
      session_id: sessionId,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Invalidate session
 */
router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const authHeader = req.headers.authorization;

    if (sessionId) {
      await redis.deleteSession(sessionId);
    }

    // If using JWT, we can't really invalidate it without a blacklist
    // For now, just return success

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed', details: error.message });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

      // Check if token is not too old (e.g., within 7 days of expiry)
      const now = Math.floor(Date.now() / 1000);
      const maxAge = 7 * 24 * 60 * 60; // 7 days

      if (decoded.exp && (now - decoded.exp) > maxAge) {
        return res.status(401).json({ error: 'Token too old to refresh' });
      }

      // Generate new token
      const newToken = generateToken(decoded.userId, decoded.keycloakSub);

      res.json({
        success: true,
        token: newToken,
      });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed', details: error.message });
  }
});

export default router;
