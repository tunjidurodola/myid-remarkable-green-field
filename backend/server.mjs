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
import { getAPIKeyVersions } from './lib/secrets.mjs';

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
import hsmAdminRoutes from './routes/hsm-admin.mjs';
import iotaRoutes from './routes/iota.mjs';

// Import HSM modules for health checks
import { hsmSigner } from './lib/hsm-signer.mjs';

// Import HSM Vault and Tools modules for slot segmentation
import { loadMyidHsmConfig, loadSlotPins } from './lib/hsm-vault.mjs';
import { listSlots as hsmListSlots, getTokenInfo } from './lib/hsm-tools.mjs';
import { initHsmState } from './lib/hsm-session.mjs';
import { loadSlotConfig, slotRoutingMiddleware } from './lib/hsm-slot-routing.mjs';

const app = express();
const PORT = process.env.PORT || 6321;

// Middleware
app.use(cors({
  origin: [
    'https://pwa.myid.africa',
    process.env.CORS_ORIGIN || '*'
  ].filter(Boolean),
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

// HSM slot routing middleware (attaches resolved slot to req.hsmSlot)
app.use(slotRoutingMiddleware);

// API Key authentication middleware (for HSM endpoints)
// Uses Vault kv-v2 versioned secrets for N vs N-1 rotation

// Cache API key versions (refresh every 5 minutes)
let _apiKeyCache = null;
let _apiKeyCacheTime = 0;
const API_KEY_CACHE_MS = 5 * 60 * 1000; // 5 minutes

// HSM slot segmentation state (loaded at startup)
let _hsmState = null;

async function getAPIKeys() {
  const now = Date.now();
  if (_apiKeyCache && (now - _apiKeyCacheTime < API_KEY_CACHE_MS)) {
    return _apiKeyCache;
  }

  _apiKeyCache = await getAPIKeyVersions();
  _apiKeyCacheTime = now;
  return _apiKeyCache;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Validate API key with Vault kv-v2 versioned rotation (N vs N-1)
 * Supports 24h grace period based on created_time metadata
 */
async function validateAPIKeyWithVaultRotation(providedKey) {
  if (!providedKey) {
    return { valid: false, deprecated: false };
  }

  const keys = await getAPIKeys();

  // Check current key (N)
  if (constantTimeCompare(providedKey, keys.currentKey)) {
    return {
      valid: true,
      deprecated: false,
      version: keys.currentVersion
    };
  }

  // Check previous key (N-1) with 24h grace period
  if (keys.previousKey && constantTimeCompare(providedKey, keys.previousKey)) {
    const gracePeriodMs = 24 * 60 * 60 * 1000; // 24 hours
    const rotatedTime = keys.rotatedAt
      ? new Date(keys.rotatedAt).getTime()
      : 0;
    const now = Date.now();

    if (rotatedTime && (now - rotatedTime <= gracePeriodMs)) {
      return {
        valid: true,
        deprecated: true,
        version: 'N-1',
        graceExpiry: new Date(rotatedTime + gracePeriodMs).toISOString()
      };
    } else {
      // Grace period expired or no rotated_at timestamp
      return {
        valid: false,
        deprecated: true,
        expired: true,
        version: 'N-1'
      };
    }
  }

  return { valid: false, deprecated: false };
}

const authenticateAPIKey = async (req, res, next) => {
  const providedKey = req.headers['x-api-key'];

  try {
    const validation = await validateAPIKeyWithVaultRotation(providedKey);

    if (!validation.valid) {
      if (validation.expired) {
        console.warn('[AUTH] Deprecated API key used after grace period expired');
        return res.status(401).json({
          error: 'API key expired',
          message: 'Your API key has been rotated. Please update to the new key.'
        });
      }
      // Only log if key was provided but invalid (not missing header)
      if (providedKey) {
        console.warn('[AUTH] Invalid API key provided');
      }
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Warn about deprecated key usage
    if (validation.deprecated) {
      console.warn(`[AUTH] Deprecated API key (N-1 version ${validation.version}) used - grace period active until ${validation.graceExpiry}`);
      res.setHeader('X-API-Key-Deprecated', 'true');
      res.setHeader('X-Deprecated-Key-Version', String(validation.version));
      res.setHeader('Warning', `299 - "API key deprecated. Please rotate to new key. Grace period ends ${validation.graceExpiry}"`);
    }

    next();
  } catch (error) {
    console.error('[AUTH] API key validation failed:', error.message);
    return res.status(500).json({ error: 'Authentication system error' });
  }
};

// ==================== HEALTH CHECK ENDPOINTS ====================

// Basic health check (root level)
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
        host: _hsmState?.config.hsm_host || 'not_initialized',
        slot: _hsmState?.config.default_slot || 'not_initialized',
        label: _hsmState?.label || 'not_initialized',
      },
    },
  });
});

// API-level health check (mirrors /health for consistency)
app.get('/api/health', async (req, res) => {
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
        host: _hsmState?.config.hsm_host || 'not_initialized',
        slot: _hsmState?.config.default_slot || 'not_initialized',
        label: _hsmState?.label || 'not_initialized',
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
        host: _hsmState?.config.hsm_host || 'not_initialized',
        slot: _hsmState?.config.default_slot || 'not_initialized',
        label: _hsmState?.label || 'not_initialized',
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

// HSM Admin routes
app.use('/api/hsm/admin', authenticateAPIKey, hsmAdminRoutes);

// IOTA DID routes (W3C DID with IOTA Tangle)
app.use('/api/iota', iotaRoutes);

// ==================== HSM/CRYPTO ENDPOINTS ====================
// Crypto operations are served by unified-middleware (port 9824) which has
// real HSM-backed signing via Vault Transit or PKCS#11. These endpoints
// return 410 Gone to redirect callers to the correct service.
for (const path of ['/api/crypto/keygen', '/api/crypto/sign', '/api/crypto/cert/issue', '/api/crypto/qes/sign']) {
  app.post(path, (_req, res) => {
    res.status(410).json({
      error: 'endpoint_removed',
      message: 'HSM crypto operations are served by unified-middleware on port 9824',
      replacement: `POST https://nv2.pocket.one:9824${path.replace('/api/crypto/', '/api/')}`,
    });
  });
}

// ==================== HSM READINESS ENDPOINT ====================

/**
 * HSM slot segmentation readiness check
 * GET /api/hsm/readiness
 * Protected by API key authentication
 */
app.get('/api/hsm/readiness', authenticateAPIKey, async (req, res) => {
  if (!_hsmState) {
    return res.status(503).json({
      status: 'not_ready',
      error: 'HSM state not initialized',
      message: 'Server startup validation not completed'
    });
  }

  res.json({
    status: 'ok',
    host: _hsmState.config.hsm_host,
    enabled_slots: _hsmState.config.enabled_slots,
    default_slot: _hsmState.config.default_slot,
    tools: {
      p11tool2_cmd: _hsmState.config.p11tool2_cmd,
      csadm_cmd: _hsmState.config.csadm_cmd,
      executable: true
    },
    slots_seen: _hsmState.slots_seen,
    validation_timestamp: _hsmState.validated_at
  });
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

// ==================== HSM STARTUP VALIDATION ====================

/**
 * Validate HSM slot segmentation configuration at startup (fail-closed)
 * - Loads config from Vault c3-hsm/myid-hsm/config
 * - Validates enabled_slots contains default_slot
 * - Verifies tool executables exist
 * - Runs listSlots and verifies all enabled slots are present
 * - Loads and caches slot PINs for enabled slots
 * - Exits process if any validation fails
 */
async function validateHSMStartup() {
  try {
    console.log('\n[HSM] Starting slot segmentation validation...');

    // Step 0: Load slot policy configuration from hsm-slots.json
    console.log('[HSM] Loading slot policy from hsm-slots.json...');
    const slotPolicy = loadSlotConfig();
    console.log(`[HSM] ✓ Slot policy loaded: ${slotPolicy.enabled_slots.length} slots defined`);

    // Step 1: Load configuration from Vault
    console.log('[HSM] Loading configuration from Vault: c3-hsm/myid-hsm/config');
    const config = await loadMyidHsmConfig();
    console.log(`[HSM] Config loaded: host=${config.hsm_host}, default_slot=${config.default_slot}`);
    console.log(`[HSM] Enabled slots: ${config.enabled_slots.join(', ')}`);

    // Step 2: Validate enabled_slots contains default_slot (already done in loadMyidHsmConfig)
    console.log('[HSM] ✓ Validated default_slot is in enabled_slots');

    // Step 3: Check tool executables exist
    console.log('[HSM] Checking tool executables...');
    const fs = await import('node:fs');
    try {
      fs.accessSync(config.p11tool2_cmd, fs.constants.X_OK);
      console.log(`[HSM] ✓ ${config.p11tool2_cmd} is executable`);
    } catch (err) {
      throw new Error(`p11tool2-remote not executable: ${config.p11tool2_cmd}`);
    }

    try {
      fs.accessSync(config.csadm_cmd, fs.constants.X_OK);
      console.log(`[HSM] ✓ ${config.csadm_cmd} is executable`);
    } catch (err) {
      throw new Error(`csadm-remote not executable: ${config.csadm_cmd}`);
    }

    // Step 4: Run listSlots and verify all enabled slots are present
    console.log('[HSM] Listing HSM slots...');
    const slots_seen = await hsmListSlots(config.p11tool2_cmd);
    console.log(`[HSM] Slots detected: ${slots_seen.join(', ')}`);

    // Verify all enabled slots are present
    const missing_slots = config.enabled_slots.filter(slot => !slots_seen.includes(slot));
    if (missing_slots.length > 0) {
      throw new Error(
        `Enabled slots not found in HSM: ${missing_slots.join(', ')}. ` +
        `Available: ${slots_seen.join(', ')}`
      );
    }
    console.log('[HSM] ✓ All enabled slots are present in HSM');

    // Step 5: Load and cache slot PINs for enabled slots
    console.log('[HSM] Loading slot PINs from Vault...');
    const slotPins = {};
    for (const slot of config.enabled_slots) {
      const pins = await loadSlotPins(slot);
      slotPins[slot] = pins;
      // Log without PIN values or admin PIN references
      const km_status = pins.km_pin ? 'present' : 'not set';
      console.log(`[HSM] ✓ Loaded PINs for slot ${slot} (usr_pin: loaded, km_pin: ${km_status})`);
    }

    // Step 6: Get token label for default slot
    console.log(`[HSM] Getting token label for default slot ${config.default_slot}...`);
    const label = await getTokenInfo(config.p11tool2_cmd, config.default_slot);
    if (label) {
      console.log(`[HSM] ✓ Token label: "${label}"`);
    } else {
      console.warn(`[HSM] Token label not found for slot ${config.default_slot}, using fallback`);
    }

    // Step 7: Cache the validated state
    _hsmState = {
      config,
      slotPins,
      slots_seen,
      label: label || `SLOT_${config.default_slot}`,
      validated_at: new Date().toISOString()
    };

    // Step 8: Initialize the HSM session module with the validated state
    initHsmState(_hsmState);

    console.log('[HSM] ✓ Slot segmentation validation complete');
    console.log(`[HSM] Ready to serve with ${config.enabled_slots.length} slot(s)\n`);

    return true;
  } catch (error) {
    console.error('\n[HSM] FATAL: Startup validation failed:', error.message);
    console.error('[HSM] Exiting process (fail-closed)\n');
    process.exit(1);
  }
}

// ==================== START SERVER ====================

// Run HSM startup validation before listening
await validateHSMStartup();

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  myID.africa Backend Service`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  Port: ${PORT}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n  HSM Configuration:`);
  console.log(`    Host: ${_hsmState.config.hsm_host}`);
  console.log(`    Default Slot: ${_hsmState.config.default_slot}`);
  console.log(`    Label: ${_hsmState.label}`);
  console.log(`    Enabled Slots: ${_hsmState.config.enabled_slots.join(', ')}`);
  console.log(`\n  Available Endpoints:`);
  console.log(`  ${'─'.repeat(56)}`);
  console.log(`  Health:`);
  console.log(`    GET  /health               - Basic health check`);
  console.log(`    GET  /health/detailed      - Detailed health (API key)`);
  console.log(`    GET  /api/hsm/readiness    - HSM slot readiness (API key)`);
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
  console.log(`\n  HSM/Crypto: (served by unified-middleware :9824)`);
  console.log(`${'='.repeat(60)}\n`);
});
