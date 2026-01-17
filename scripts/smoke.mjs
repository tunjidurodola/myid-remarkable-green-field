#!/usr/bin/env node
import http from 'node:http';

/**
 * Smoke tests for myID.africa PWA deployment
 * Validates health endpoints and authentication behavior
 */

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout: ${url}`));
    });
  });
}

async function runTests() {
  const tests = [];

  // Test 1: myid-pwa-server health endpoint
  console.log('[1/6] Testing myid-pwa-server health endpoint...');
  try {
    const res = await httpGet('http://127.0.0.1:9495/api/health');
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    console.log('  ✓ GET http://127.0.0.1:9495/api/health = 200');
    tests.push({ name: 'pwa-server-health', passed: true });
  } catch (err) {
    console.error(`  ✗ FAILED: ${err.message}`);
    tests.push({ name: 'pwa-server-health', passed: false, error: err.message });
  }

  // Test 2: myid-hsm health endpoint (try both /api/health and /health)
  console.log('[2/6] Testing myid-hsm health endpoint...');
  try {
    let res;
    let endpoint;
    try {
      res = await httpGet('http://127.0.0.1:6321/api/health');
      endpoint = '/api/health';
    } catch {
      res = await httpGet('http://127.0.0.1:6321/health');
      endpoint = '/health';
    }
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    console.log(`  ✓ GET http://127.0.0.1:6321${endpoint} = 200`);
    tests.push({ name: 'hsm-health', passed: true });
  } catch (err) {
    console.error(`  ✗ FAILED: ${err.message}`);
    tests.push({ name: 'hsm-health', passed: false, error: err.message });
  }

  // Test 3: PWA root endpoint
  console.log('[3/6] Testing PWA root endpoint...');
  try {
    const res = await httpGet('http://127.0.0.1:6230/');
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    console.log('  ✓ GET http://127.0.0.1:6230/ = 200');
    tests.push({ name: 'pwa-root', passed: true });
  } catch (err) {
    console.error(`  ✗ FAILED: ${err.message}`);
    tests.push({ name: 'pwa-root', passed: false, error: err.message });
  }

  // Test 4-6: Unauthenticated API calls should return 401/403/400 (not 500)
  const authTests = [
    { path: '/api/user/profile', description: 'user profile' },
    { path: '/api/mastercode', description: 'mastercode' },
    { path: '/api/credentials', description: 'credentials' },
  ];

  for (let i = 0; i < authTests.length; i++) {
    const test = authTests[i];
    console.log(`[${4 + i}/6] Testing unauthenticated ${test.description}...`);
    try {
      const res = await httpGet(`http://127.0.0.1:6321${test.path}`);
      // Accept 400-level responses (401 Unauthorized, 403 Forbidden, 404 Not Found, etc.)
      // Reject 500-level responses (server errors)
      if (res.status >= 500) {
        throw new Error(`Expected 4xx, got ${res.status} (server error)`);
      }
      if (res.status < 400) {
        throw new Error(`Expected 4xx, got ${res.status} (should require auth)`);
      }
      console.log(`  ✓ GET http://127.0.0.1:6321${test.path} = ${res.status} (auth enforced)`);
      tests.push({ name: `auth-${test.description}`, passed: true });
    } catch (err) {
      console.error(`  ✗ FAILED: ${err.message}`);
      tests.push({ name: `auth-${test.description}`, passed: false, error: err.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  const passed = tests.filter(t => t.passed).length;
  const failed = tests.filter(t => !t.passed).length;
  console.log(`Tests: ${passed} passed, ${failed} failed, ${tests.length} total`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✓ All smoke tests passed');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('\nUnexpected error:', err);
  process.exit(1);
});
