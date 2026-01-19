#!/usr/bin/env node
/**
 * Synthetic Payload Lab Orchestrator
 * Runs generators, verifiers, and compliance checks for all credential families
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Import generators
import { generateMDoc } from './generate/generate-mdoc.mjs';
import { generateSDJWT } from './generate/generate-sdjwt.mjs';
import { generateW3CCredential } from './generate/generate-w3c.mjs';
import { generateDTC } from './generate/generate-dtc.mjs';
import { generateNDEF } from './generate/generate-ndef.mjs';
import { generateBLEPACE } from './generate/generate-ble-pace.mjs';

// Import verifiers
import { verifyMDoc } from './verify/verify-mdoc.mjs';
import { verifySDJWT } from './verify/verify-sdjwt.mjs';
import { verifyW3C } from './verify/verify-w3c.mjs';
import { verifyDTC } from './verify/verify-dtc.mjs';
import { verifyNDEF } from './verify/verify-ndef.mjs';
import { verifyBLEPACE } from './verify/verify-ble-pace.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

// Configuration
const CONFIG = {
  maxIterations: 6,
  runExistingQAFirst: true,
  existingQAGates: [
    { name: 'HSM Profile', command: 'npm', args: ['run', 'qa:hsm-profile'] },
    { name: 'WalletPack', command: 'node', args: ['scripts/qa-walletpack.mjs'] },
    { name: 'Orchestrator', command: 'npm', args: ['run', 'qa:orchestrator'] },
  ],
  reportDir: path.join(REPO_ROOT, 'reports', 'payload-lab'),
};

// State
let iteration = 0;
const results = {
  existingQA: [],
  generation: [],
  verification: [],
  datastores: null,
  summary: null,
};

/**
 * Main orchestrator
 */
async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║     Synthetic Payload Lab - myID.africa              ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T').join('-').substring(0, 19);
  const reportPath = path.join(CONFIG.reportDir, timestamp);
  await fs.mkdir(reportPath, { recursive: true });

  console.log(`📁 Report directory: ${path.relative(REPO_ROOT, reportPath)}\n`);

  try {
    // Iteration loop
    for (iteration = 1; iteration <= CONFIG.maxIterations; iteration++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`  ITERATION ${iteration}/${CONFIG.maxIterations}`);
      console.log(`${'='.repeat(60)}\n`);

      // Step 1: Run existing QA gates
      if (CONFIG.runExistingQAFirst) {
        console.log('📋 Step 1: Running existing QA gates...\n');
        const qaResults = await runExistingQAGates();
        results.existingQA = qaResults;

        const qaFailed = qaResults.filter(r => r.status === 'FAIL').length;
        if (qaFailed > 0) {
          console.log(`\n❌ ${qaFailed} existing QA gate(s) failed. Stopping.`);
          await generateReport(reportPath, 'FAIL');
          process.exit(1);
        }
        console.log('\n✅ All existing QA gates passed.\n');
      }

      // Step 2: Generate payloads
      console.log('📋 Step 2: Generating synthetic payloads...\n');
      const genResults = await generatePayloads();
      results.generation = genResults;

      const genFailed = genResults.filter(r => !r.success).length;
      if (genFailed > 0) {
        console.log(`\n⚠️  ${genFailed} generator(s) failed. Analyzing...`);
        if (iteration < CONFIG.maxIterations) {
          console.log('🔄 Retrying in next iteration...');
          continue;
        } else {
          console.log('❌ Max iterations reached with generation failures.');
          await generateReport(reportPath, 'FAIL');
          process.exit(1);
        }
      }
      console.log('\n✅ All generators succeeded.\n');

      // Step 3: Verify payloads
      console.log('📋 Step 3: Verifying payloads...\n');
      const verifyResults = await verifyPayloads(genResults);
      results.verification = verifyResults;

      const verifyFailed = verifyResults.filter(r => !r.verified).length;
      if (verifyFailed > 0) {
        console.log(`\n⚠️  ${verifyFailed} verification(s) failed. Analyzing...`);
        if (iteration < CONFIG.maxIterations) {
          console.log('🔄 Retrying in next iteration...');
          continue;
        } else {
          console.log('❌ Max iterations reached with verification failures.');
          await generateReport(reportPath, 'FAIL');
          process.exit(1);
        }
      }
      console.log('\n✅ All verifications passed.\n');

      // Step 4: Inspect datastores
      console.log('📋 Step 4: Inspecting datastores...\n');
      const datastoreResults = await inspectDatastores();
      results.datastores = datastoreResults;

      // All checks passed - exit loop
      console.log('\n🎉 All checks passed!');
      break;
    }

    // Generate final report
    await generateReport(reportPath, 'PASS');

    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║                ✅ LAB RUN COMPLETE                    ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    await generateReport(reportPath, 'ERROR', error);
    process.exit(1);
  }
}

/**
 * Run existing QA gates
 */
async function runExistingQAGates() {
  const results = [];

  for (const gate of CONFIG.existingQAGates) {
    process.stdout.write(`  [RUNNING] ${gate.name}... `);
    try {
      await runCommand(gate.command, gate.args);
      console.log('✅ PASS');
      results.push({ gate: gate.name, status: 'PASS' });
    } catch (error) {
      console.log('❌ FAIL');
      results.push({ gate: gate.name, status: 'FAIL', error: error.message });
    }
  }

  return results;
}

/**
 * Generate all payloads
 */
async function generatePayloads() {
  const generators = [
    { name: 'ISO 18013-5 mDoc', fn: generateMDoc },
    { name: 'eIDAS2 SD-JWT', fn: generateSDJWT },
    { name: 'W3C DID/VC', fn: generateW3CCredential },
    { name: 'ICAO DTC', fn: generateDTC },
    { name: 'NFC NDEF', fn: generateNDEF },
    { name: 'BLE + PACE', fn: generateBLEPACE },
  ];

  const results = [];

  for (const gen of generators) {
    process.stdout.write(`  [GENERATE] ${gen.name}... `);
    try {
      const result = await gen.fn();
      if (result.success) {
        console.log('✅');
        results.push(result);
      } else {
        console.log('❌');
        results.push(result);
      }
    } catch (error) {
      console.log('❌');
      results.push({
        success: false,
        family: gen.name,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  return results;
}

/**
 * Verify all payloads
 */
async function verifyPayloads(genResults) {
  const verifiers = [
    { name: 'ISO 18013-5 mDoc', fn: verifyMDoc },
    { name: 'eIDAS2 SD-JWT', fn: verifySDJWT },
    { name: 'W3C DID/VC', fn: verifyW3C },
    { name: 'ICAO DTC', fn: verifyDTC },
    { name: 'NFC NDEF', fn: verifyNDEF },
    { name: 'BLE + PACE', fn: verifyBLEPACE },
  ];

  const results = [];

  for (let i = 0; i < verifiers.length; i++) {
    const ver = verifiers[i];
    const payload = genResults[i];

    process.stdout.write(`  [VERIFY] ${ver.name}... `);

    if (!payload || !payload.success) {
      console.log('⏭️  SKIP (generation failed)');
      results.push({ verified: false, family: ver.name, skipped: true });
      continue;
    }

    try {
      const result = await ver.fn(payload);
      if (result.verified) {
        console.log('✅');
      } else {
        console.log(`❌ (${result.errors?.length || 0} errors)`);
      }
      results.push(result);
    } catch (error) {
      console.log('❌');
      results.push({
        verified: false,
        family: ver.name,
        error: error.message,
        stack: error.stack,
      });
    }
  }

  return results;
}

/**
 * Inspect PostgreSQL and Redis datastores
 */
async function inspectDatastores() {
  const pg = await inspectPostgreSQL();
  const redis = await inspectRedis();

  return { postgresql: pg, redis };
}

/**
 * Inspect PostgreSQL
 */
async function inspectPostgreSQL() {
  process.stdout.write('  [INSPECT] PostgreSQL... ');

  try {
    // Check if psql is available and database connection works
    const pgHost = process.env.PGHOST || 'localhost';
    const pgPort = process.env.PGPORT || '5432';
    const pgDatabase = process.env.PGDATABASE || 'myid';
    const pgUser = process.env.PGUSER || 'postgres';

    // Try to connect and list tables
    const query = `
      SELECT schemaname, tablename, tableowner
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `;

    const result = await runCommand('psql', ['-t', '-A', '-c', query]);

    const tables = result.stdout.trim().split('\n').filter(Boolean);

    console.log(`✅ (${tables.length} tables)`);

    return {
      available: true,
      host: pgHost,
      port: pgPort,
      database: pgDatabase,
      user: pgUser,
      tableCount: tables.length,
      tables: tables.slice(0, 10), // First 10 tables
    };
  } catch (error) {
    console.log('⚠️  unavailable');
    return {
      available: false,
      error: error.message,
      note: 'PostgreSQL inspection skipped - connection not available',
    };
  }
}

/**
 * Inspect Redis
 */
async function inspectRedis() {
  process.stdout.write('  [INSPECT] Redis... ');

  try {
    const redisHost = process.env.REDIS_HOST || '127.0.0.1';
    const redisPort = process.env.REDIS_PORT_1 || '7100';

    // Import and use the Redis client
    const redisModule = await import('../../backend/lib/redis.mjs');
    const health = await redisModule.healthCheck();

    if (health.healthy) {
      console.log(`✅ (${health.mode})`);
      return {
        available: true,
        host: redisHost,
        port: redisPort,
        mode: health.mode,
        latency: health.latency || 'N/A',
      };
    } else {
      console.log('⚠️  fallback');
      return {
        available: false,
        mode: 'memory-fallback',
        note: 'Redis unavailable, using in-memory fallback',
      };
    }
  } catch (error) {
    console.log('⚠️  unavailable');
    return {
      available: false,
      error: error.message,
    };
  }
}

/**
 * Generate compliance report
 */
async function generateReport(reportPath, status, error = null) {
  console.log('\n📝 Generating reports...');

  // Create subdirectories
  await fs.mkdir(path.join(reportPath, 'sample_payloads'), { recursive: true });
  await fs.mkdir(path.join(reportPath, 'raw_logs'), { recursive: true });

  // Executive Summary
  await generateExecutiveSummary(reportPath, status, error);

  // Compliance Matrix
  await generateComplianceMatrix(reportPath);

  // Datastore Reports
  if (results.datastores) {
    await generateDatastoreReports(reportPath);
  }

  // Sample Payloads (redacted)
  await generateSamplePayloads(reportPath);

  console.log(`✅ Reports generated in: ${path.relative(REPO_ROOT, reportPath)}`);
}

/**
 * Generate executive summary
 */
async function generateExecutiveSummary(reportPath, status, error) {
  const timestamp = new Date().toISOString();

  let content = `# Executive Summary\n\n`;
  content += `**Generated:** ${timestamp}\n`;
  content += `**Status:** ${status}\n`;
  content += `**Iteration:** ${iteration}/${CONFIG.maxIterations}\n\n`;

  content += `## Result\n\n`;
  if (status === 'PASS') {
    content += `✅ **ALL TESTS PASSED**\n\n`;
  } else if (status === 'FAIL') {
    content += `❌ **TESTS FAILED**\n\n`;
  } else {
    content += `⚠️  **ERROR OCCURRED**\n\n`;
    if (error) {
      content += `\`\`\`\n${error.message}\n${error.stack}\n\`\`\`\n\n`;
    }
  }

  content += `## Existing QA Gates\n\n`;
  for (const qa of results.existingQA) {
    content += `- **${qa.gate}:** ${qa.status}\n`;
  }

  content += `\n## Payload Generation\n\n`;
  for (const gen of results.generation) {
    const icon = gen.success ? '✅' : '❌';
    content += `${icon} **${gen.family}:** ${gen.success ? 'Success' : 'Failed'}\n`;
  }

  content += `\n## Payload Verification\n\n`;
  for (const ver of results.verification) {
    const icon = ver.verified ? '✅' : ver.skipped ? '⏭️' : '❌';
    const errors = ver.errors?.length || 0;
    const warnings = ver.warnings?.length || 0;
    content += `${icon} **${ver.family}:** ${ver.verified ? 'Verified' : ver.skipped ? 'Skipped' : `Failed (${errors} errors, ${warnings} warnings)`}\n`;
  }

  content += `\n## Datastores\n\n`;
  if (results.datastores) {
    content += `- **PostgreSQL:** ${results.datastores.postgresql?.available ? '✅ Available' : '⚠️ Unavailable'}\n`;
    content += `- **Redis:** ${results.datastores.redis?.available ? '✅ Available' : '⚠️ Unavailable'}\n`;
  }

  await fs.writeFile(path.join(reportPath, 'EXEC_SUMMARY.md'), content);
}

/**
 * Generate compliance matrix
 */
async function generateComplianceMatrix(reportPath) {
  let content = `# Compliance Matrix\n\n`;
  content += `| Family | Generated | Verified | TC Claim | MC Claim | Issuer URL | Status |\n`;
  content += `|--------|-----------|----------|----------|----------|------------|--------|\n`;

  for (let i = 0; i < results.generation.length; i++) {
    const gen = results.generation[i];
    const ver = results.verification[i];

    const generated = gen.success ? '✅' : '❌';
    const verified = ver?.verified ? '✅' : '❌';
    const tcClaim = gen.claims?.tc ? '✅' : '❌';
    const mcClaim = gen.claims?.mc ? '✅' : '❌';
    const issuer = gen.claims?.issuer || 'N/A';
    const status = (gen.success && ver?.verified) ? 'PASS' : 'FAIL';

    content += `| ${gen.family} | ${generated} | ${verified} | ${tcClaim} | ${mcClaim} | ${issuer} | ${status} |\n`;
  }

  await fs.writeFile(path.join(reportPath, 'COMPLIANCE_MATRIX.md'), content);
}

/**
 * Generate datastore reports
 */
async function generateDatastoreReports(reportPath) {
  // PostgreSQL report
  let pgContent = `# PostgreSQL Datastore Inventory\n\n`;
  pgContent += `**Generated:** ${new Date().toISOString()}\n\n`;

  if (results.datastores.postgresql?.available) {
    pgContent += `## Connection Info\n\n`;
    pgContent += `- **Host:** ${results.datastores.postgresql.host}\n`;
    pgContent += `- **Port:** ${results.datastores.postgresql.port}\n`;
    pgContent += `- **Database:** ${results.datastores.postgresql.database}\n`;
    pgContent += `- **User:** ${results.datastores.postgresql.user}\n`;
    pgContent += `- **Tables:** ${results.datastores.postgresql.tableCount}\n\n`;

    pgContent += `## Tables (sample)\n\n`;
    for (const table of results.datastores.postgresql.tables || []) {
      pgContent += `- ${table}\n`;
    }
  } else {
    pgContent += `⚠️  PostgreSQL not available\n\n`;
    pgContent += `${results.datastores.postgresql.error || 'Connection failed'}\n`;
  }

  await fs.writeFile(path.join(reportPath, 'datastore_inventory_pg.md'), pgContent);

  // Redis report
  let redisContent = `# Redis Datastore Inventory\n\n`;
  redisContent += `**Generated:** ${new Date().toISOString()}\n\n`;

  if (results.datastores.redis?.available) {
    redisContent += `## Connection Info\n\n`;
    redisContent += `- **Host:** ${results.datastores.redis.host}\n`;
    redisContent += `- **Port:** ${results.datastores.redis.port}\n`;
    redisContent += `- **Mode:** ${results.datastores.redis.mode}\n`;
    redisContent += `- **Latency:** ${results.datastores.redis.latency}\n\n`;

    redisContent += `## Key Prefixes\n\n`;
    redisContent += `- session:\n`;
    redisContent += `- cache:\n`;
    redisContent += `- challenge:\n`;
    redisContent += `- ratelimit:\n`;
  } else {
    redisContent += `⚠️  Redis not available (using memory fallback)\n\n`;
    redisContent += `${results.datastores.redis.note || results.datastores.redis.error || 'Connection failed'}\n`;
  }

  await fs.writeFile(path.join(reportPath, 'datastore_inventory_redis.md'), redisContent);
}

/**
 * Generate sample payloads (redacted)
 */
async function generateSamplePayloads(reportPath) {
  const sampleDir = path.join(reportPath, 'sample_payloads');

  for (const gen of results.generation) {
    if (!gen.success) continue;

    const filename = `${gen.family.replace(/[\s+\/]/g, '_').toLowerCase()}.json`;

    // Redact sensitive fields
    const redacted = JSON.parse(JSON.stringify(gen));
    if (redacted.data?.credential?.jwt) {
      redacted.data.credential.jwt = '[REDACTED]';
    }
    if (redacted.data?.credentialJWT) {
      redacted.data.credentialJWT = '[REDACTED]';
    }
    if (redacted.data?.jwt) {
      redacted.data.jwt = '[REDACTED]';
    }
    if (redacted.data?.sdJWT) {
      redacted.data.sdJWT = '[REDACTED]';
    }

    await fs.writeFile(
      path.join(sampleDir, filename),
      JSON.stringify(redacted, null, 2)
    );
  }
}

/**
 * Run a command and return stdout/stderr
 */
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
      ...options,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr?.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        const error = new Error(`Command failed with code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });

    child.on('error', error => {
      reject(error);
    });
  });
}

// Run orchestrator
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
