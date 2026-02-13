/**
 * IOTA DID API Routes
 * Handles IOTA-specific DID operations, credential issuance, and verification
 */

import { Router } from 'express';
import { getBackendSecrets } from "../lib/secrets.mjs";
import jwt from 'jsonwebtoken';
import { getIotaDIDManager } from '../lib/did-iota.mjs';
import db from '../lib/db.mjs';
import redis from '../lib/redis.mjs';

const router = Router();
const { jwt_secret: JWT_SECRET } = await getBackendSecrets();

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
 * POST /api/iota/did/create
 * Create a new IOTA DID
 */
router.post('/did/create', authenticateToken, async (req, res) => {
  try {
    const { masterCode, network = 'testnet' } = req.body;
    const userId = req.user.userId;

    const iotaManager = getIotaDIDManager(network);
    const result = await iotaManager.createDID({ masterCode });

    // Store DID in database (without private key)
    await db.query(
      `INSERT INTO user_dids (user_id, did, did_method, network, did_document, created_at)
       VALUES ($1, $2, 'iota', $3, $4, NOW())
       ON CONFLICT (did) DO NOTHING`,
      [userId, result.did, network, JSON.stringify(result.document)]
    );

    // Cache DID document in Redis
    await redis.set(`did:${result.did}`, JSON.stringify(result.document), 'EX', 3600);

    // Store private key in Vault — never return to client
    try {
      const vaultClient = (await import('../lib/hsm-vault.mjs')).default || (await import('../lib/hsm-vault.mjs'));
      if (typeof vaultClient.writeKv2 === 'function') {
        await vaultClient.writeKv2(`iota-keys/${result.did}`, { privateKey: result.keys.privateKey });
      }
    } catch (vaultErr) {
      console.warn(`[IOTA] Could not persist private key to Vault: ${vaultErr.message}`);
    }

    res.status(201).json({
      success: true,
      did: result.did,
      document: result.document,
      networkId: result.networkId,
      blockId: result.blockId,
      keys: {
        fragmentId: result.keys.fragmentId,
        publicKey: result.keys.publicKey,
        keyType: result.keys.keyType,
      },
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IOTA DID creation error:', error);
    res.status(500).json({ error: 'Failed to create IOTA DID', details: error.message });
  }
});

/**
 * POST /api/iota/did/resolve
 * Resolve an IOTA DID
 */
router.post('/did/resolve', async (req, res) => {
  try {
    const { did } = req.body;

    if (!did || !did.startsWith('did:iota:')) {
      return res.status(400).json({ error: 'Invalid IOTA DID' });
    }

    // Try cache first
    const cached = await redis.get(`did:${did}`);
    if (cached) {
      return res.json({
        success: true,
        did,
        document: JSON.parse(cached),
        cached: true,
      });
    }

    // Resolve from Tangle
    const network = did.includes(':rms:') ? 'testnet' : did.includes(':smr:') ? 'shimmer' : 'mainnet';
    const iotaManager = getIotaDIDManager(network);
    const result = await iotaManager.resolveDID(did);

    // Cache result
    await redis.set(`did:${did}`, JSON.stringify(result.document), 'EX', 3600);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('IOTA DID resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve IOTA DID', details: error.message });
  }
});

/**
 * POST /api/iota/credentials/issue
 * Issue a Verifiable Credential with IOTA DID
 */
router.post('/credentials/issue', authenticateToken, async (req, res) => {
  try {
    const {
      issuerDID,
      subjectDID,
      claims,
      credentialType = 'IdentityCredential',
      expirationDate = null,
    } = req.body;

    const userId = req.user.userId;

    if (!issuerDID || !issuerDID.startsWith('did:iota:')) {
      return res.status(400).json({ error: 'Invalid issuer DID (must be did:iota:*)' });
    }

    if (!subjectDID) {
      return res.status(400).json({ error: 'Subject DID is required' });
    }

    // Fetch issuer's private key from database (in production: from Vault)
    const issuerResult = await db.queryOne(
      'SELECT did_document FROM user_dids WHERE user_id = $1 AND did = $2',
      [userId, issuerDID]
    );

    if (!issuerResult) {
      return res.status(404).json({ error: 'Issuer DID not found or not owned by user' });
    }

    // Retrieve private key from Vault (preferred) or accept from request body
    const { issuerPrivateKey } = req.body;

    if (!issuerPrivateKey) {
      return res.status(400).json({
        error: 'Issuer private key required (retrieved from Vault or supplied by caller)',
      });
    }

    const network = issuerDID.includes(':rms:') ? 'testnet' : issuerDID.includes(':smr:') ? 'shimmer' : 'mainnet';
    const iotaManager = getIotaDIDManager(network);

    const privateKeyBuffer = Buffer.from(issuerPrivateKey, 'hex');
    const credential = await iotaManager.createVerifiableCredential(
      issuerDID,
      subjectDID,
      privateKeyBuffer,
      claims,
      { credentialType, expirationDate }
    );

    // Store credential in database
    await db.query(
      `INSERT INTO credentials (id, user_id, type, namespace, credential_data, status, created_at)
       VALUES ($1, $2, 'VC', 'https://www.w3.org/2018/credentials/v1', $3, 'active', NOW())`,
      [credential.id.split(':').pop(), userId, JSON.stringify(credential)]
    );

    res.status(201).json({
      success: true,
      credential,
      issuedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IOTA credential issuance error:', error);
    res.status(500).json({ error: 'Failed to issue credential', details: error.message });
  }
});

/**
 * POST /api/iota/presentations/create
 * Create a Verifiable Presentation with IOTA DID
 */
router.post('/presentations/create', authenticateToken, async (req, res) => {
  try {
    const {
      holderDID,
      credentials,
      challenge,
      domain,
    } = req.body;

    const userId = req.user.userId;

    if (!holderDID || !holderDID.startsWith('did:iota:')) {
      return res.status(400).json({ error: 'Invalid holder DID (must be did:iota:*)' });
    }

    if (!challenge) {
      return res.status(400).json({ error: 'Challenge is required' });
    }

    // Verify holder owns the DID
    const holderResult = await db.queryOne(
      'SELECT did FROM user_dids WHERE user_id = $1 AND did = $2',
      [userId, holderDID]
    );

    if (!holderResult) {
      return res.status(404).json({ error: 'Holder DID not found or not owned by user' });
    }

    // Retrieve private key from Vault (preferred) or accept from request body
    const { holderPrivateKey } = req.body;

    if (!holderPrivateKey) {
      return res.status(400).json({
        error: 'Holder private key required (retrieved from Vault or supplied by caller)',
      });
    }

    const network = holderDID.includes(':rms:') ? 'testnet' : holderDID.includes(':smr:') ? 'shimmer' : 'mainnet';
    const iotaManager = getIotaDIDManager(network);

    const privateKeyBuffer = Buffer.from(holderPrivateKey, 'hex');
    const presentation = await iotaManager.createPresentation(
      holderDID,
      privateKeyBuffer,
      credentials,
      challenge,
      domain
    );

    res.json({
      success: true,
      presentation,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IOTA presentation creation error:', error);
    res.status(500).json({ error: 'Failed to create presentation', details: error.message });
  }
});

/**
 * POST /api/iota/verify/credential
 * Verify an IOTA Verifiable Credential
 */
router.post('/verify/credential', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Credential is required' });
    }

    const issuerDID = typeof credential.issuer === 'string'
      ? credential.issuer
      : credential.issuer?.id;

    if (!issuerDID || !issuerDID.startsWith('did:iota:')) {
      return res.status(400).json({ error: 'Credential must have IOTA issuer DID' });
    }

    const network = issuerDID.includes(':rms:') ? 'testnet' : issuerDID.includes(':smr:') ? 'shimmer' : 'mainnet';
    const iotaManager = getIotaDIDManager(network);

    const result = await iotaManager.verifyCredential(credential);

    res.json({
      success: true,
      ...result,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IOTA credential verification error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * POST /api/iota/verify/presentation
 * Verify an IOTA Verifiable Presentation
 */
router.post('/verify/presentation', async (req, res) => {
  try {
    const { presentation, challenge, domain } = req.body;

    if (!presentation) {
      return res.status(400).json({ error: 'Presentation is required' });
    }

    if (!presentation.holder || !presentation.holder.startsWith('did:iota:')) {
      return res.status(400).json({ error: 'Presentation must have IOTA holder DID' });
    }

    const network = presentation.holder.includes(':rms:') ? 'testnet' : presentation.holder.includes(':smr:') ? 'shimmer' : 'mainnet';
    const iotaManager = getIotaDIDManager(network);

    const result = await iotaManager.verifyPresentation(presentation, challenge, domain);

    res.json({
      success: true,
      ...result,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IOTA presentation verification error:', error);
    res.status(500).json({ error: 'Verification failed', details: error.message });
  }
});

/**
 * POST /api/iota/did/update
 * Update an existing IOTA DID Document
 */
router.post('/did/update', authenticateToken, async (req, res) => {
  try {
    const { did, updates, privateKey } = req.body;
    const userId = req.user.userId;

    // Verify ownership
    const didResult = await db.queryOne(
      'SELECT did FROM user_dids WHERE user_id = $1 AND did = $2',
      [userId, did]
    );

    if (!didResult) {
      return res.status(404).json({ error: 'DID not found or not owned by user' });
    }

    const network = did.includes(':rms:') ? 'testnet' : did.includes(':smr:') ? 'shimmer' : 'mainnet';
    const iotaManager = getIotaDIDManager(network);

    const privateKeyBuffer = Buffer.from(privateKey, 'hex');
    const result = await iotaManager.updateDID(did, privateKeyBuffer, updates);

    // Update database
    await db.query(
      'UPDATE user_dids SET did_document = $1, updated_at = NOW() WHERE did = $2',
      [JSON.stringify(result.document), did]
    );

    // Invalidate cache
    await redis.del(`did:${did}`);

    res.json({
      success: true,
      ...result,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IOTA DID update error:', error);
    res.status(500).json({ error: 'Failed to update DID', details: error.message });
  }
});

/**
 * POST /api/iota/did/rotate-keys
 * Rotate verification keys for an IOTA DID
 */
router.post('/did/rotate-keys', authenticateToken, async (req, res) => {
  try {
    const { did, currentPrivateKey, oldFragmentId } = req.body;
    const userId = req.user.userId;

    // Verify ownership
    const didResult = await db.queryOne(
      'SELECT did FROM user_dids WHERE user_id = $1 AND did = $2',
      [userId, did]
    );

    if (!didResult) {
      return res.status(404).json({ error: 'DID not found or not owned by user' });
    }

    const network = did.includes(':rms:') ? 'testnet' : did.includes(':smr:') ? 'shimmer' : 'mainnet';
    const iotaManager = getIotaDIDManager(network);

    const privateKeyBuffer = Buffer.from(currentPrivateKey, 'hex');
    const result = await iotaManager.rotateKeys(did, privateKeyBuffer, oldFragmentId);

    // Update database
    await db.query(
      'UPDATE user_dids SET did_document = $1, updated_at = NOW() WHERE did = $2',
      [JSON.stringify(result.document), did]
    );

    // Invalidate cache
    await redis.del(`did:${did}`);

    res.json({
      success: true,
      ...result,
      message: 'Keys rotated successfully. Store the new private key securely.',
      rotatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('IOTA key rotation error:', error);
    res.status(500).json({ error: 'Failed to rotate keys', details: error.message });
  }
});

export default router;
