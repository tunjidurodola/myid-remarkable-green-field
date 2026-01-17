import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import forge from 'node-forge';

// Load environment variables
dotenv.config();

// Import database and redis modules
import db from './lib/db.mjs';
import redis from './lib/redis.mjs';

// Import route modules
import authRoutes from './routes/auth.mjs';
import passkeyRoutes from './routes/passkey.mjs';
import userRoutes from './routes/user.mjs';
import mastercodeRoutes from './routes/mastercode.mjs';
import trustcodeRoutes from './routes/trustcode.mjs';
import mdlRoutes from './routes/mdl.mjs';
import consentRoutes from './routes/consent.mjs';
import credentialsRoutes from './routes/credentials.mjs';
import qesRoutes from './routes/qes.mjs';

// Import HSM modules for health checks
import { hsmConnection } from './lib/hsm-signer.mjs';

const app = express();
const PORT = process.env.PORT || 6321;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Key authentication middleware (for HSM endpoints)
const authenticateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ==================== HEALTH CHECK ENDPOINTS ====================

// Basic health check
app.get('/health', async (req, res) => {
  const dbHealth = await db.healthCheck();
  const redisHealth = await redis.healthCheck();

  const allHealthy = dbHealth.healthy && redisHealth.healthy;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      hsm: {
        host: process.env.HSM_HOST,
        slot: process.env.HSM_SLOT,
        label: process.env.HSM_LABEL,
      },
    },
  });
});

// Detailed health check (requires API key)
app.get('/health/detailed', authenticateAPIKey, async (req, res) => {
  const dbHealth = await db.healthCheck();
  const redisHealth = await redis.healthCheck();
  const poolStats = db.getPoolStats();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      database: {
        ...dbHealth,
        pool: poolStats,
      },
      redis: redisHealth,
      hsm: {
        host: process.env.HSM_HOST,
        slot: process.env.HSM_SLOT,
        label: process.env.HSM_LABEL,
      },
    },
  });
});

// ==================== MOUNT ROUTE MODULES ====================

// Authentication routes
app.use('/api/auth', authRoutes);

// WebAuthn Passkey routes
app.use('/api/auth/passkey', passkeyRoutes);

// User profile routes
app.use('/api/user', userRoutes);

// MasterCode routes
app.use('/api/mastercode', mastercodeRoutes);

// TrustCode routes
app.use('/api/trustcode', trustcodeRoutes);

// mDL (Mobile Driving License) routes - ISO 18013-5
app.use('/api/mdl', mdlRoutes);

// Consent management routes
app.use('/api/consent', consentRoutes);

// Unified Credentials routes (mDL, PID, DTC, VC)
app.use('/api/credentials', credentialsRoutes);

// QES (Qualified Electronic Signature) routes
app.use('/api/qes', qesRoutes);

// ==================== HSM/CRYPTO ENDPOINTS (EXISTING) ====================

/**
 * Generate a new key pair in the HSM
 * POST /api/crypto/keygen
 */
app.post('/api/crypto/keygen', authenticateAPIKey, async (req, res) => {
  try {
    const { algorithm = 'RSA', keySize = 2048, label } = req.body;

    // In production, this would interact with the HSM via PKCS#11
    // For demo purposes, we'll generate a key pair and return the public key

    // Simulated HSM key generation
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: keySize,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    // In real implementation:
    // - Private key stays in HSM (SLOT 0)
    // - Only public key and key handle are returned

    res.json({
      success: true,
      publicKey: keyPair.publicKey,
      keyHandle: `hsm://${process.env.HSM_SLOT}/${label}`,
      algorithm,
      keySize,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Key generation error:', error);
    res.status(500).json({ error: 'Key generation failed', details: error.message });
  }
});

/**
 * Sign data using HSM private key
 * POST /api/crypto/sign
 */
app.post('/api/crypto/sign', authenticateAPIKey, async (req, res) => {
  try {
    const { data, keyHandle, algorithm = 'SHA256' } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Data to sign is required' });
    }

    // In production, this would use the HSM to sign via PKCS#11
    // For demo purposes, we'll create a signature

    // Simulated HSM signing
    // In real implementation, private key never leaves HSM
    const hash = crypto.createHash(algorithm.toLowerCase()).update(data).digest();

    // Mock signature (in production this comes from HSM)
    const signature = hash.toString('base64');

    res.json({
      success: true,
      signature,
      algorithm,
      keyHandle,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Signing error:', error);
    res.status(500).json({ error: 'Signing failed', details: error.message });
  }
});

/**
 * Issue a certificate signed by the CA in the HSM
 * POST /api/crypto/cert/issue
 */
app.post('/api/crypto/cert/issue', authenticateAPIKey, async (req, res) => {
  try {
    const {
      publicKey,
      subject,
      validityDays = 365,
      keyUsage = ['digitalSignature', 'keyEncipherment'],
    } = req.body;

    if (!publicKey || !subject) {
      return res.status(400).json({ error: 'Public key and subject are required' });
    }

    // In production, this would use the HSM CA key to sign the certificate
    // For demo purposes, we'll create a self-signed certificate using node-forge

    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + validityDays);

    const attrs = [
      { name: 'commonName', value: subject.commonName || 'myID.africa User' },
      { name: 'countryName', value: subject.country || 'ZA' },
      { name: 'organizationName', value: subject.organization || 'pocketOne' },
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Extensions
    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: false,
      },
      {
        name: 'keyUsage',
        digitalSignature: keyUsage.includes('digitalSignature'),
        keyEncipherment: keyUsage.includes('keyEncipherment'),
      },
    ]);

    // Sign the certificate (in production, HSM CA key would sign this)
    cert.sign(keys.privateKey, forge.md.sha256.create());

    const pem = forge.pki.certificateToPem(cert);

    res.json({
      success: true,
      certificate: pem,
      serialNumber: cert.serialNumber,
      validityDays,
      issuer: 'CN=pocketOne CA, O=pocketOne, C=ZA',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Certificate issuance error:', error);
    res.status(500).json({ error: 'Certificate issuance failed', details: error.message });
  }
});

/**
 * QES (Qualified Electronic Signature) endpoint
 * POST /api/crypto/qes/sign
 */
app.post('/api/crypto/qes/sign', authenticateAPIKey, async (req, res) => {
  try {
    const { documentHash, certificateId, userId } = req.body;

    if (!documentHash || !certificateId) {
      return res.status(400).json({ error: 'Document hash and certificate ID are required' });
    }

    // In production, this performs QES-compliant signing with HSM
    const signature = crypto
      .createHash('sha256')
      .update(documentHash + certificateId)
      .digest('hex');

    res.json({
      success: true,
      signature,
      certificateId,
      documentHash,
      timestamp: new Date().toISOString(),
      signatureFormat: 'CAdES-B',
      compliance: 'eIDAS',
    });
  } catch (error) {
    console.error('QES signing error:', error);
    res.status(500).json({ error: 'QES signing failed', details: error.message });
  }
});

// ==================== 404 HANDLER ====================

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ==================== GRACEFUL SHUTDOWN ====================

async function shutdown() {
  console.log('\nShutting down gracefully...');
  await db.close();
  await redis.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  myID.africa Backend Service`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n  HSM Configuration:`);
  console.log(`    Host: ${process.env.HSM_HOST}`);
  console.log(`    Slot: ${process.env.HSM_SLOT}`);
  console.log(`    Label: ${process.env.HSM_LABEL}`);
  console.log(`\n  Available Endpoints:`);
  console.log(`  ${'─'.repeat(56)}`);
  console.log(`  Health:`);
  console.log(`    GET  /health               - Basic health check`);
  console.log(`    GET  /health/detailed      - Detailed health (API key)`);
  console.log(`\n  Authentication:`);
  console.log(`    POST /api/auth/register    - User registration`);
  console.log(`    POST /api/auth/login       - User login`);
  console.log(`    POST /api/auth/logout      - User logout`);
  console.log(`    POST /api/auth/refresh     - Refresh JWT token`);
  console.log(`\n  WebAuthn Passkeys:`);
  console.log(`    POST /api/auth/passkey/register/options`);
  console.log(`    POST /api/auth/passkey/register/verify`);
  console.log(`    POST /api/auth/passkey/authenticate/options`);
  console.log(`    POST /api/auth/passkey/authenticate/verify`);
  console.log(`    GET  /api/auth/passkey/credentials`);
  console.log(`\n  User Profile:`);
  console.log(`    GET  /api/user/profile     - Get user profile`);
  console.log(`    PUT  /api/user/profile     - Update profile`);
  console.log(`\n  MasterCode:`);
  console.log(`    POST /api/mastercode/generate    - Generate MasterCodes`);
  console.log(`    POST /api/mastercode/assign      - Assign to user`);
  console.log(`    POST /api/mastercode/verify      - Verify MasterCode`);
  console.log(`    GET  /api/mastercode/pool/status - Pool status`);
  console.log(`\n  TrustCode:`);
  console.log(`    POST /api/trustcode/issue        - Issue TrustCode`);
  console.log(`    POST /api/trustcode/verify       - Verify TrustCode`);
  console.log(`    GET  /api/trustcode/:code        - Get TrustCode`);
  console.log(`\n  mDL (ISO 18013-5):`);
  console.log(`    POST /api/mdl/issue              - Issue mDL credential`);
  console.log(`    GET  /api/mdl/:id                - Get mDL credential`);
  console.log(`    POST /api/mdl/present            - Generate presentation`);
  console.log(`    POST /api/mdl/verify             - Verify presentation`);
  console.log(`    GET  /api/mdl/engagement         - Device engagement QR`);
  console.log(`    GET  /api/mdl/list               - List user's mDLs`);
  console.log(`\n  Consent Management:`);
  console.log(`    POST /api/consent/request        - RP requests consent`);
  console.log(`    POST /api/consent/approve        - User approves consent`);
  console.log(`    GET  /api/consent/history        - User consent history`);
  console.log(`    DELETE /api/consent/:id          - Revoke consent`);
  console.log(`\n  Unified Credentials (Phase 3):`);
  console.log(`    POST /api/credentials/issue     - Issue credential (mDL/PID/DTC/VC)`);
  console.log(`    GET  /api/credentials           - List user credentials`);
  console.log(`    GET  /api/credentials/:id       - Get credential details`);
  console.log(`    POST /api/credentials/:id/present - Generate presentation`);
  console.log(`    DELETE /api/credentials/:id     - Delete credential`);
  console.log(`    POST /api/credentials/verify    - Verify credential`);
  console.log(`    POST /api/credentials/dtc/authenticate - DTC chip auth`);
  console.log(`    POST /api/credentials/pid/age-verify   - Age verification`);
  console.log(`\n  QES (Qualified Electronic Signatures):`);
  console.log(`    POST /api/qes/sign              - Sign document with QES`);
  console.log(`    POST /api/qes/verify            - Verify QES signature`);
  console.log(`    GET  /api/qes/certificate       - Get user's QES certificate`);
  console.log(`    POST /api/qes/request-certificate - Request QES certificate`);
  console.log(`    GET  /api/qes/signatures        - List user's signatures`);
  console.log(`    GET  /api/qes/audit-log         - Get QES audit log`);
  console.log(`\n  HSM/Crypto:`);
  console.log(`    POST /api/crypto/keygen         - Generate key pair`);
  console.log(`    POST /api/crypto/sign           - Sign data`);
  console.log(`    POST /api/crypto/cert/issue     - Issue certificate`);
  console.log(`    POST /api/crypto/qes/sign       - QES signing`);
  console.log(`${'='.repeat(60)}\n`);
});
