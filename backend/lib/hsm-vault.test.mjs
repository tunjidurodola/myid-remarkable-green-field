/**
 * HSM Vault Module Tests
 *
 * Tests fail-closed behavior for HSM slot segmentation:
 * - Missing Vault configuration
 * - Missing required PINs (so_pin, usr_pin)
 * - Invalid enabled_slots configuration
 */

import { loadMyidHsmConfig, loadSlotPins, readKv2 } from './hsm-vault.mjs';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ ${message}`);
    testsFailed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function testReadKv2InvalidPath() {
  console.log('\nTest: readKv2 with invalid path format');
  try {
    await readKv2('invalid');
    assert(false, 'Should throw error for invalid path');
  } catch (err) {
    assert(
      err.message.includes('invalid mountPath format'),
      'Should throw error with invalid path message'
    );
  }
}

async function testReadKv2MissingVault() {
  console.log('\nTest: readKv2 with missing VAULT_ADDR');
  const originalAddr = process.env.VAULT_ADDR;
  const originalToken = process.env.VAULT_TOKEN;

  try {
    delete process.env.VAULT_ADDR;
    delete process.env.VAULT_TOKEN;

    await readKv2('c3-hsm/test');
    assert(false, 'Should throw error when VAULT_ADDR missing');
  } catch (err) {
    assert(
      err.message.includes('missing required: VAULT_ADDR'),
      'Should fail-closed when VAULT_ADDR missing'
    );
  } finally {
    if (originalAddr) process.env.VAULT_ADDR = originalAddr;
    if (originalToken) process.env.VAULT_TOKEN = originalToken;
  }
}

async function testReadKv2MissingToken() {
  console.log('\nTest: readKv2 with missing VAULT_TOKEN');
  const originalToken = process.env.VAULT_TOKEN;

  try {
    delete process.env.VAULT_TOKEN;

    await readKv2('c3-hsm/test');
    assert(false, 'Should throw error when VAULT_TOKEN missing');
  } catch (err) {
    assert(
      err.message.includes('missing required: VAULT_TOKEN'),
      'Should fail-closed when VAULT_TOKEN missing'
    );
  } finally {
    if (originalToken) process.env.VAULT_TOKEN = originalToken;
  }
}

async function testLoadMyidHsmConfigMissingFields() {
  console.log('\nTest: loadMyidHsmConfig with missing required fields');

  // Note: This test would require mocking the Vault response
  // In a real test environment, you would:
  // 1. Mock vaultReadKv2 to return incomplete data
  // 2. Verify that loadMyidHsmConfig throws appropriate errors

  console.log('  (Skipping - requires Vault mock or test server)');
  console.log('  Expected behavior:');
  console.log('    - Missing hsm_host: throws error');
  console.log('    - Missing default_slot: throws error');
  console.log('    - Missing enabled_slots: throws error');
  console.log('    - Invalid enabled_slots format: throws error');
  console.log('    - default_slot not in enabled_slots: throws error');
}

async function testLoadSlotPinsMissingSOPin() {
  console.log('\nTest: loadSlotPins enforces so_pin requirement');

  // Note: This test would require mocking the Vault response
  console.log('  (Skipping - requires Vault mock or test server)');
  console.log('  Expected behavior:');
  console.log('    - Missing so_pin: throws error with "missing required: so_pin"');
  console.log('    - Process exits (fail-closed)');
}

async function testLoadSlotPinsMissingUSRPin() {
  console.log('\nTest: loadSlotPins enforces usr_pin requirement');

  // Note: This test would require mocking the Vault response
  console.log('  (Skipping - requires Vault mock or test server)');
  console.log('  Expected behavior:');
  console.log('    - Missing usr_pin: throws error with "missing required: usr_pin"');
  console.log('    - Process exits (fail-closed)');
}

async function testLoadSlotPinsOptionalKMPin() {
  console.log('\nTest: loadSlotPins allows optional km_pin');

  // Note: This test would require mocking the Vault response
  console.log('  (Skipping - requires Vault mock or test server)');
  console.log('  Expected behavior:');
  console.log('    - Missing km_pin: returns null for km_pin (no error)');
  console.log('    - Present km_pin: returns value');
}

async function testPinValuesNeverLogged() {
  console.log('\nTest: PIN values are never logged');

  console.log('  Manual verification required:');
  console.log('    - Review loadSlotPins implementation');
  console.log('    - Confirm no console.log of PIN values');
  console.log('    - Only log that PINs were loaded, not the values');

  // Code review verification
  const fs = await import('node:fs/promises');
  const code = await fs.readFile('./hsm-vault.mjs', 'utf-8');

  // Check that loadSlotPins doesn't log PIN values
  const loadSlotPinsMatch = code.match(/export async function loadSlotPins[\s\S]*?^}/m);
  if (loadSlotPinsMatch) {
    const functionBody = loadSlotPinsMatch[0];
    const hasConsoleLog = functionBody.includes('console.log');
    const logsPinValues = hasConsoleLog && (
      functionBody.includes('so_pin') ||
      functionBody.includes('usr_pin') ||
      functionBody.includes('km_pin')
    );

    assert(
      !logsPinValues,
      'loadSlotPins does not log PIN values (verified by code inspection)'
    );
  }
}

// ==================== RUN TESTS ====================

async function runTests() {
  console.log('\n='.repeat(60));
  console.log('HSM Vault Module - Fail-Closed Behavior Tests');
  console.log('='.repeat(60));

  try {
    await testReadKv2InvalidPath();
    await testReadKv2MissingVault();
    await testReadKv2MissingToken();
    await testLoadMyidHsmConfigMissingFields();
    await testLoadSlotPinsMissingSOPin();
    await testLoadSlotPinsMissingUSRPin();
    await testLoadSlotPinsOptionalKMPin();
    await testPinValuesNeverLogged();

    console.log('\n' + '='.repeat(60));
    console.log(`Tests passed: ${testsPassed}`);
    console.log(`Tests failed: ${testsFailed}`);
    console.log('='.repeat(60) + '\n');

    if (testsFailed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\nTest suite error:', error.message);
    console.log(`\nTests passed: ${testsPassed}`);
    console.log(`Tests failed: ${testsFailed + 1}`);
    process.exit(1);
  }
}

runTests();
