/**
 * WebAuthn Passkey Routes
 * Handles passkey registration and authentication using @simplewebauthn/server
 */

import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import db from '../lib/db.mjs';
import redis from '../lib/redis.mjs';

const router = Router();

// WebAuthn configuration
const rpName = process.env.WEBAUTHN_RP_NAME || 'myID.africa';
const rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:6230';

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || 'myid-jwt-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

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
 * Convert base64url to Buffer
 */
function base64urlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  return Buffer.from(padded, 'base64');
}

/**
 * Convert Buffer to base64url
 */
function bufferToBase64url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * POST /api/auth/passkey/register/options
 * Generate registration options for WebAuthn
 *
 * Request body:
 * - user_id: UUID (optional, for existing users)
 * - email: string (required for new users)
 * - displayName: string (optional)
 *
 * Response:
 * - WebAuthn PublicKeyCredentialCreationOptions
 */
router.post('/register/options', async (req, res) => {
  try {
    const { user_id, email, displayName } = req.body;

    let user;
    let isNewUser = false;

    if (user_id) {
      // Existing user adding a new passkey
      user = await db.queryOne(
        `SELECT user_id, keycloak_sub FROM users WHERE user_id = $1`,
        [user_id]
      );
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
    } else if (email) {
      // Check if user exists
      user = await db.queryOne(
        `SELECT user_id, keycloak_sub FROM users WHERE keycloak_sub = $1`,
        [email]
      );

      if (!user) {
        // Will create user after passkey verification
        isNewUser = true;
        user = {
          user_id: uuidv4(),
          keycloak_sub: email,
        };
      }
    } else {
      return res.status(400).json({ error: 'Either user_id or email is required' });
    }

    // Get existing credentials for this user
    const existingCredentials = await db.queryAll(
      `SELECT credential_id FROM passkey_credentials WHERE user_id = $1`,
      [user.user_id]
    );

    const excludeCredentials = existingCredentials.map(cred => ({
      id: cred.credential_id,
      type: 'public-key',
      transports: ['internal', 'hybrid', 'usb', 'ble', 'nfc'],
    }));

    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: Buffer.from(user.user_id),
      userName: user.keycloak_sub,
      userDisplayName: displayName || user.keycloak_sub,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });

    // Store challenge in database and Redis for redundancy
    const challengeB64 = options.challenge;

    await db.query(
      `INSERT INTO passkey_challenges (challenge, user_id, type, expires_at)
       VALUES ($1, $2, 'registration', NOW() + INTERVAL '5 minutes')`,
      [challengeB64, isNewUser ? null : user.user_id]
    );

    // Store additional metadata in Redis
    await redis.storeChallenge(challengeB64, {
      userId: user.user_id,
      keycloakSub: user.keycloak_sub,
      isNewUser,
      type: 'registration',
    });

    res.json({
      ...options,
      user_id: user.user_id,
      is_new_user: isNewUser,
    });
  } catch (error) {
    console.error('Passkey registration options error:', error);
    res.status(500).json({ error: 'Failed to generate registration options', details: error.message });
  }
});

/**
 * POST /api/auth/passkey/register/verify
 * Verify registration response and store credential
 *
 * Request body:
 * - credential: PublicKeyCredential (registration response)
 * - challenge: string (base64url encoded)
 * - user_id: UUID
 * - friendly_name: string (optional)
 *
 * Response:
 * - success: boolean
 * - user_id: UUID
 * - credential_id: string
 */
router.post('/register/verify', async (req, res) => {
  try {
    const { credential, challenge, user_id, friendly_name } = req.body;

    if (!credential || !challenge) {
      return res.status(400).json({ error: 'Credential and challenge are required' });
    }

    // Get challenge metadata from Redis
    const challengeMeta = await redis.consumeChallenge(challenge);
    if (!challengeMeta) {
      // Try database
      const dbChallenge = await db.queryOne(
        `SELECT challenge, user_id, type FROM passkey_challenges
         WHERE challenge = $1 AND type = 'registration' AND expires_at > NOW() AND used = false`,
        [challenge]
      );

      if (!dbChallenge) {
        return res.status(400).json({ error: 'Invalid or expired challenge' });
      }

      // Mark as used
      await db.query(
        `UPDATE passkey_challenges SET used = true WHERE challenge = $1`,
        [challenge]
      );
    }

    const expectedUserId = challengeMeta?.userId || user_id;
    const isNewUser = challengeMeta?.isNewUser || false;
    const keycloakSub = challengeMeta?.keycloakSub;

    // Verify the registration response
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Verification failed' });
    }

    const { registrationInfo } = verification;

    // Start transaction
    const result = await db.transaction(async (client) => {
      let finalUserId = expectedUserId;

      // Create user if new
      if (isNewUser && keycloakSub) {
        const userResult = await client.query(
          `INSERT INTO users (user_id, keycloak_sub, status)
           VALUES ($1, $2, 'active')
           ON CONFLICT (keycloak_sub) DO UPDATE SET updated_at = NOW()
           RETURNING user_id, keycloak_sub`,
          [expectedUserId, keycloakSub]
        );
        finalUserId = userResult.rows[0].user_id;

        // Try to assign a mastercode
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
           RETURNING mc`,
        );

        if (mcResult.rows.length > 0) {
          await client.query(
            `INSERT INTO mastercode_assignments (mc, user_id) VALUES ($1, $2)
             ON CONFLICT (user_id) DO NOTHING`,
            [mcResult.rows[0].mc, finalUserId]
          );
        }
      }

      // Store the credential
      const credentialId = bufferToBase64url(Buffer.from(registrationInfo.credential.id));

      await client.query(
        `INSERT INTO passkey_credentials (
           id, user_id, credential_id, public_key, counter,
           transports, device_type, backup_eligible, backup_state,
           attestation_format, aaguid, friendly_name
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          uuidv4(),
          finalUserId,
          Buffer.from(registrationInfo.credential.id),
          Buffer.from(registrationInfo.credential.publicKey),
          registrationInfo.credential.counter,
          registrationInfo.credential.transports || [],
          registrationInfo.credentialDeviceType || 'singleDevice',
          registrationInfo.credentialBackedUp || false,
          registrationInfo.credentialBackedUp || false,
          registrationInfo.fmt || 'none',
          registrationInfo.aaguid ? Buffer.from(registrationInfo.aaguid, 'hex') : null,
          friendly_name || 'Passkey',
        ]
      );

      // Log the registration
      await client.query(
        `INSERT INTO passkey_audit_log (user_id, action, credential_id, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          finalUserId,
          'REGISTER',
          credentialId,
          req.ip || req.connection?.remoteAddress,
          req.headers['user-agent'],
        ]
      );

      return { userId: finalUserId, credentialId };
    });

    // Generate token for the user
    const user = await db.queryOne(
      `SELECT user_id, keycloak_sub FROM users WHERE user_id = $1`,
      [result.userId]
    );

    const token = generateToken(user.user_id, user.keycloak_sub);

    res.json({
      success: true,
      verified: true,
      user_id: result.userId,
      credential_id: result.credentialId,
      token,
    });
  } catch (error) {
    console.error('Passkey registration verify error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * POST /api/auth/passkey/authenticate/options
 * Generate authentication options for WebAuthn
 *
 * Request body:
 * - email: string (optional, for user-specific auth)
 *
 * Response:
 * - WebAuthn PublicKeyCredentialRequestOptions
 */
router.post('/authenticate/options', async (req, res) => {
  try {
    const { email } = req.body;

    let allowCredentials = [];

    if (email) {
      // Get user's credentials
      const user = await db.queryOne(
        `SELECT user_id FROM users WHERE keycloak_sub = $1`,
        [email]
      );

      if (user) {
        const credentials = await db.queryAll(
          `SELECT credential_id, transports FROM passkey_credentials WHERE user_id = $1`,
          [user.user_id]
        );

        allowCredentials = credentials.map(cred => ({
          id: cred.credential_id,
          type: 'public-key',
          transports: cred.transports || ['internal', 'hybrid'],
        }));
      }
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
    });

    const challengeB64 = options.challenge;

    // Store challenge
    await db.query(
      `INSERT INTO passkey_challenges (challenge, type, expires_at)
       VALUES ($1, 'authentication', NOW() + INTERVAL '5 minutes')`,
      [challengeB64]
    );

    await redis.storeChallenge(challengeB64, {
      type: 'authentication',
      email,
    });

    res.json(options);
  } catch (error) {
    console.error('Passkey authentication options error:', error);
    res.status(500).json({ error: 'Failed to generate authentication options', details: error.message });
  }
});

/**
 * POST /api/auth/passkey/authenticate/verify
 * Verify authentication response
 *
 * Request body:
 * - credential: PublicKeyCredential (authentication response)
 * - challenge: string (base64url encoded)
 *
 * Response:
 * - success: boolean
 * - user_id: UUID
 * - token: JWT token
 */
router.post('/authenticate/verify', async (req, res) => {
  try {
    const { credential, challenge } = req.body;

    if (!credential || !challenge) {
      return res.status(400).json({ error: 'Credential and challenge are required' });
    }

    // Consume challenge
    const challengeMeta = await redis.consumeChallenge(challenge);
    if (!challengeMeta) {
      const dbChallenge = await db.queryOne(
        `SELECT challenge FROM passkey_challenges
         WHERE challenge = $1 AND type = 'authentication' AND expires_at > NOW() AND used = false`,
        [challenge]
      );

      if (!dbChallenge) {
        return res.status(400).json({ error: 'Invalid or expired challenge' });
      }

      await db.query(
        `UPDATE passkey_challenges SET used = true WHERE challenge = $1`,
        [challenge]
      );
    }

    // Find the credential in database
    const credentialIdBuffer = base64urlToBuffer(credential.id);

    const storedCredential = await db.queryOne(
      `SELECT pc.*, u.keycloak_sub
       FROM passkey_credentials pc
       JOIN users u ON pc.user_id = u.user_id
       WHERE pc.credential_id = $1`,
      [credentialIdBuffer]
    );

    if (!storedCredential) {
      return res.status(400).json({ error: 'Credential not found' });
    }

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCredential.credential_id,
        publicKey: storedCredential.public_key,
        counter: Number(storedCredential.counter),
        transports: storedCredential.transports,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Authentication failed' });
    }

    // Update counter
    await db.query(
      `UPDATE passkey_credentials
       SET counter = $1, last_used_at = NOW()
       WHERE credential_id = $2`,
      [verification.authenticationInfo.newCounter, credentialIdBuffer]
    );

    // Log the authentication
    await db.query(
      `INSERT INTO passkey_audit_log (user_id, action, credential_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        storedCredential.user_id,
        'AUTHENTICATE',
        credential.id,
        req.ip || req.connection?.remoteAddress,
        req.headers['user-agent'],
      ]
    );

    // Get user with mastercode
    const user = await db.queryOne(
      `SELECT u.user_id, u.keycloak_sub, ma.mc as mastercode
       FROM users u
       LEFT JOIN mastercode_assignments ma ON u.user_id = ma.user_id
       WHERE u.user_id = $1`,
      [storedCredential.user_id]
    );

    // Generate token
    const token = generateToken(user.user_id, user.keycloak_sub);

    // Create session
    const sessionId = uuidv4();
    await redis.createSession(sessionId, {
      userId: user.user_id,
      keycloakSub: user.keycloak_sub,
      mastercode: user.mastercode,
      authMethod: 'passkey',
      loginAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      verified: true,
      user_id: user.user_id,
      keycloak_sub: user.keycloak_sub,
      mastercode: user.mastercode,
      token,
      session_id: sessionId,
    });
  } catch (error) {
    console.error('Passkey authentication verify error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

/**
 * GET /api/auth/passkey/credentials
 * List user's passkey credentials
 *
 * Query params:
 * - user_id: UUID
 */
router.get('/credentials', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const credentials = await db.queryAll(
      `SELECT id, friendly_name, device_type, backup_eligible,
              created_at, last_used_at
       FROM passkey_credentials
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user_id]
    );

    res.json({
      success: true,
      credentials,
    });
  } catch (error) {
    console.error('List credentials error:', error);
    res.status(500).json({ error: 'Failed to list credentials', details: error.message });
  }
});

/**
 * DELETE /api/auth/passkey/credentials/:id
 * Delete a passkey credential
 */
router.delete('/credentials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const result = await db.query(
      `DELETE FROM passkey_credentials WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, user_id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    // Log deletion
    await db.query(
      `INSERT INTO passkey_audit_log (user_id, action, credential_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user_id, 'DELETE', id, req.ip, req.headers['user-agent']]
    );

    res.json({
      success: true,
      message: 'Credential deleted',
    });
  } catch (error) {
    console.error('Delete credential error:', error);
    res.status(500).json({ error: 'Failed to delete credential', details: error.message });
  }
});

export default router;
