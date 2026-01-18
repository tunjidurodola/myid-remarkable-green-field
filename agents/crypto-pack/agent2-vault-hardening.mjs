#!/usr/bin/env node
/**
 * Agent 2: Vault Hardening
 *
 * MISSION: Ensure all secrets come from Vault kv-v2, no fallbacks, fail closed.
 *
 * SCOPE:
 * 1. Remove any "dev-secret" fallbacks or hardcoded secrets
 * 2. Implement N vs N-1 API key validation with 24h grace period
 * 3. Add deprecated header warnings for rotated API keys
 * 4. Verify PM2 ecosystem configs contain no secrets
 * 5. Ensure all JWT and API tokens from Vault paths:
 *    - kv-v2/myid/pwa/api
 *    - kv-v2/myid/pwa/jwt
 *    - kv-v2/myid/hsm/api
 *    - kv-v2/myid/hsm/jwt
 *
 * HARD RULES:
 * - No placeholder secrets, no string fallbacks
 * - If secret missing from Vault, service must fail closed
 * - All secrets MUST come from Vault kv-v2
 */

import fs from 'fs/promises';
import path from 'path';

const REPORT_DIR = process.env.REPORT_DIR || '/tmp/crypto-pack-report';
const APP_ROOT = '/perform1/srv/work/myid-app';
const BACKEND_DIR = path.join(APP_ROOT, 'backend');

class VaultHardener {
  constructor() {
    this.changes = [];
    this.errors = [];
    this.warnings = [];
    this.secretsFound = [];
  }

  log(msg) {
    console.log(`[AGENT2] ${msg}`);
  }

  logChange(file, description) {
    this.changes.push({ file, description });
    this.log(`✓ ${description} in ${file}`);
  }

  logError(msg) {
    this.errors.push(msg);
    console.error(`[AGENT2] ✗ ERROR: ${msg}`);
  }

  logWarning(msg) {
    this.warnings.push(msg);
    console.warn(`[AGENT2] ⚠ WARNING: ${msg}`);
  }

  async run() {
    this.log('Starting Vault hardening...');

    try {
      await this.scanForHardcodedSecrets();
      await this.implementAPIKeyRotation();
      await this.hardenSecretsLoader();
      await this.verifyPM2Config();
      await this.generateReport();

      if (this.errors.length > 0) {
        this.log(`❌ Completed with ${this.errors.length} errors`);
        process.exit(1);
      } else {
        this.log(`✅ Completed successfully with ${this.changes.length} changes`);
        process.exit(0);
      }
    } catch (error) {
      this.logError(`Fatal error: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * Scan for hardcoded secrets (dev-secret, placeholder keys, etc.)
   */
  async scanForHardcodedSecrets() {
    this.log('Scanning for hardcoded secrets...');

    const filesToCheck = [
      path.join(BACKEND_DIR, 'server.mjs'),
      path.join(BACKEND_DIR, 'lib', 'secrets.mjs'),
      path.join(BACKEND_DIR, 'routes', 'auth.mjs'),
      path.join(APP_ROOT, 'ecosystem.config.cjs')
    ];

    const bannedPatterns = [
      /"dev-secret"/g,
      /"placeholder-secret"/g,
      /"test-api-key"/g,
      /"demo-jwt-secret"/g,
      /JWT_SECRET\s*=\s*['"][^'"]+['"]/g,
      /API_KEY\s*=\s*['"][^'"]+['"]/g
    ];

    for (const file of filesToCheck) {
      try {
        const content = await fs.readFile(file, 'utf-8');

        for (const pattern of bannedPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            this.secretsFound.push({ file, matches });
            this.logWarning(`Found potential hardcoded secret in ${file}: ${matches.join(', ')}`);
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logWarning(`Could not scan ${file}: ${error.message}`);
        }
      }
    }

    if (this.secretsFound.length > 0) {
      this.logWarning(`Found ${this.secretsFound.length} files with potential hardcoded secrets`);
    } else {
      this.log('No hardcoded secrets found');
    }
  }

  /**
   * Implement N vs N-1 API key validation with 24h grace period
   */
  async implementAPIKeyRotation() {
    this.log('Implementing API key rotation with N vs N-1 validation...');

    const serverPath = path.join(BACKEND_DIR, 'server.mjs');

    try {
      let content = await fs.readFile(serverPath, 'utf-8');

      // Check if rotation logic already exists
      if (content.includes('validateAPIKeyWithRotation')) {
        this.log('API key rotation logic already implemented');
        return;
      }

      // Find the authenticateAPIKey middleware
      const middlewarePattern = /const authenticateAPIKey = \(req, res, next\) => \{[\s\S]*?\};/;

      if (!middlewarePattern.test(content)) {
        this.logWarning('authenticateAPIKey middleware not found in expected format');
        return;
      }

      // Create new validation function
      const rotationLogic = `/**
 * Validate API key with N vs N-1 rotation support
 * Allows both current (N) and previous (N-1) API keys with 24h grace period
 */
function validateAPIKeyWithRotation(providedKey, currentKey, previousKey, rotationTimestamp) {
  if (!providedKey) {
    return { valid: false, deprecated: false };
  }

  // Check current key (N)
  if (providedKey === currentKey) {
    return { valid: true, deprecated: false };
  }

  // Check previous key (N-1) with grace period
  if (previousKey && providedKey === previousKey) {
    const gracePeriodMs = 24 * 60 * 60 * 1000; // 24 hours
    const rotationTime = rotationTimestamp ? new Date(rotationTimestamp).getTime() : 0;
    const now = Date.now();

    if (now - rotationTime <= gracePeriodMs) {
      return { valid: true, deprecated: true };
    } else {
      // Grace period expired
      return { valid: false, deprecated: true, expired: true };
    }
  }

  return { valid: false, deprecated: false };
}

const authenticateAPIKey = (req, res, next) => {
  const providedKey = req.headers['x-api-key'];
  const currentKey = process.env.API_KEY;
  const previousKey = process.env.API_KEY_PREVIOUS;
  const rotationTimestamp = process.env.API_KEY_ROTATION_TIMESTAMP;

  // Fail closed: if no current key configured, reject
  if (!currentKey) {
    console.error('[AUTH] API_KEY not configured - failing closed');
    return res.status(500).json({ error: 'Authentication system misconfigured' });
  }

  const validation = validateAPIKeyWithRotation(
    providedKey,
    currentKey,
    previousKey,
    rotationTimestamp
  );

  if (!validation.valid) {
    if (validation.expired) {
      console.warn('[AUTH] Deprecated API key used after grace period expired');
      return res.status(401).json({
        error: 'API key expired',
        message: 'Your API key has been rotated. Please update to the new key.'
      });
    }
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Warn about deprecated key usage
  if (validation.deprecated) {
    console.warn('[AUTH] Deprecated API key (N-1) used - grace period active');
    res.setHeader('X-API-Key-Deprecated', 'true');
    res.setHeader('Warning', '299 - "API key deprecated. Please rotate to new key. Grace period ends in 24h."');
  }

  next();
};`;

      // Replace the old middleware
      content = content.replace(middlewarePattern, rotationLogic);

      await fs.writeFile(serverPath, content, 'utf-8');
      this.logChange('backend/server.mjs', 'Implemented N vs N-1 API key rotation with 24h grace period');
    } catch (error) {
      this.logError(`Failed to implement API key rotation: ${error.message}`);
    }
  }

  /**
   * Harden secrets loader to fail closed
   */
  async hardenSecretsLoader() {
    this.log('Hardening secrets loader...');

    const secretsPath = path.join(BACKEND_DIR, 'lib', 'secrets.mjs');

    try {
      let content = await fs.readFile(secretsPath, 'utf-8');

      // Check if fail-closed logic exists
      if (content.includes('throw new Error') && content.includes('Vault secret')) {
        this.log('Secrets loader already has fail-closed logic');
      }

      // Ensure no fallback secrets
      const fallbackPattern = /\|\|\s*['"][^'"]*secret[^'"]*['"]/gi;
      if (fallbackPattern.test(content)) {
        this.logWarning('Found potential fallback secrets in secrets.mjs');

        // Remove fallbacks
        content = content.replace(
          /(jwt_secret|api_key):\s*data\.data\.data\.\1\s*\|\|\s*['"][^'"]+['"]/g,
          '$1: data.data.data.$1'
        );

        // Add validation
        if (!content.includes('if (!backendSecrets.jwt_secret)')) {
          const validationCode = `
  // Fail closed: reject missing secrets
  if (!backendSecrets.jwt_secret) {
    throw new Error('Vault secret missing: jwt_secret. Service cannot start without valid JWT secret.');
  }
  if (!backendSecrets.api_key) {
    throw new Error('Vault secret missing: api_key. Service cannot start without valid API key.');
  }
`;

          // Insert after backendSecrets assignment
          content = content.replace(
            /(const backendSecrets = \{[\s\S]*?\};)/,
            `$1\n${validationCode}`
          );
        }

        await fs.writeFile(secretsPath, content, 'utf-8');
        this.logChange('backend/lib/secrets.mjs', 'Removed fallback secrets and added fail-closed validation');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logWarning('secrets.mjs not found - may use different secrets loading mechanism');
      } else {
        this.logError(`Failed to harden secrets loader: ${error.message}`);
      }
    }
  }

  /**
   * Verify PM2 ecosystem config contains no secrets
   */
  async verifyPM2Config() {
    this.log('Verifying PM2 configuration...');

    const pm2ConfigPath = path.join(APP_ROOT, 'ecosystem.config.cjs');

    try {
      const content = await fs.readFile(pm2ConfigPath, 'utf-8');

      // Check for secrets in environment variables
      const secretPatterns = [
        /JWT_SECRET:\s*['"][^'"]+['"]/,
        /API_KEY:\s*['"][^'"]+['"]/,
        /DB_PASSWORD:\s*['"][^'"]{10,}['"]/,
        /HSM_PIN:\s*['"][^'"]{4,}['"]/
      ];

      let foundSecrets = false;
      for (const pattern of secretPatterns) {
        if (pattern.test(content)) {
          foundSecrets = true;
          this.logWarning(`Found potential secret in PM2 config: ${pattern}`);
        }
      }

      if (!foundSecrets) {
        this.log('PM2 config verified - no hardcoded secrets found');
      } else {
        this.logWarning('PM2 config should only contain Vault pointers, not actual secrets');
        this.logChange('ecosystem.config.cjs', 'Review required - found potential secrets in PM2 config');
      }
    } catch (error) {
      this.logError(`Failed to verify PM2 config: ${error.message}`);
    }
  }

  /**
   * Generate agent report
   */
  async generateReport() {
    this.log('Generating agent report...');

    try {
      await fs.mkdir(REPORT_DIR, { recursive: true });

      const report = {
        agent: 'agent2-vault-hardening',
        timestamp: new Date().toISOString(),
        summary: {
          changes: this.changes.length,
          errors: this.errors.length,
          warnings: this.warnings.length,
          hardcodedSecretsFound: this.secretsFound.length
        },
        changes: this.changes,
        errors: this.errors,
        warnings: this.warnings,
        hardcodedSecrets: this.secretsFound,
        vaultPaths: {
          pwa_jwt: 'kv-v2/myid/pwa/jwt',
          pwa_api: 'kv-v2/myid/pwa/api',
          hsm_jwt: 'kv-v2/myid/hsm/jwt',
          hsm_api: 'kv-v2/myid/hsm/api'
        },
        recommendations: [
          'Ensure VAULT_ADDR and VAULT_TOKEN are set in production environment',
          'Rotate API keys using N vs N-1 pattern with API_KEY_PREVIOUS and API_KEY_ROTATION_TIMESTAMP',
          'Monitor for X-API-Key-Deprecated headers in production logs',
          'Remove any hardcoded secrets from PM2 ecosystem.config.cjs',
          'Verify all 4 Vault paths contain required keys (jwt_secret, api_key)',
          'Set API_KEY_ROTATION_TIMESTAMP when rotating keys to enable 24h grace period'
        ]
      };

      const reportPath = path.join(REPORT_DIR, 'agent2-report.json');
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

      this.log(`Report written to ${reportPath}`);
    } catch (error) {
      this.logError(`Failed to generate report: ${error.message}`);
    }
  }
}

// Run agent
const agent = new VaultHardener();
agent.run().catch(err => {
  console.error('Agent failed:', err);
  process.exit(1);
});
