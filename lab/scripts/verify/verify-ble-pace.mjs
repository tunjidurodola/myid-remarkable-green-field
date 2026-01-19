/**
 * BLE + PACE Verifier
 * Validates BLE GATT structure and PACE protocol transcript model
 *
 * IMPORTANT: This verifies scaffolding structure only - NOT full PACE authentication
 */

/**
 * Verify a BLE + PACE payload
 * @param {object} blePacePayload - The BLE/PACE payload to verify
 * @returns {object} Verification result
 */
export async function verifyBLEPACE(blePacePayload) {
  const errors = [];
  const warnings = [];
  const checks = {};

  try {
    // Check 1: Validate payload structure
    checks.structure = validateStructure(blePacePayload, errors);

    // Check 2: Validate required claims (tc, mc)
    checks.claims = validateClaims(blePacePayload, errors);

    // Check 3: Validate implementation status
    checks.implementationStatus = validateImplementationStatus(blePacePayload, errors, warnings);

    // Check 4: Validate BLE GATT structure
    if (blePacePayload.data?.ble) {
      checks.ble = validateBLEStructure(blePacePayload.data.ble, errors, warnings);
    } else {
      errors.push('Missing BLE data');
    }

    // Check 5: Validate PACE transcript
    if (blePacePayload.data?.pace) {
      checks.pace = validatePACETranscript(blePacePayload.data.pace, errors, warnings);
    } else {
      warnings.push('Missing PACE transcript');
    }

    const verified = errors.length === 0;

    return {
      success: true,
      verified,
      family: 'BLE + PACE',
      type: 'Protocol Scaffold',
      checks,
      errors,
      warnings,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      verified: false,
      family: 'BLE + PACE',
      type: 'Protocol Scaffold',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Validate BLE+PACE structure
 */
function validateStructure(payload, errors) {
  const required = ['success', 'family', 'type', 'data', 'claims', 'metadata'];
  const missing = required.filter(field => !(field in payload));

  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
    return false;
  }

  if (payload.family !== 'BLE + PACE') {
    errors.push(`Invalid family: expected 'BLE + PACE', got '${payload.family}'`);
    return false;
  }

  return true;
}

/**
 * Validate required claims (tc, mc)
 */
function validateClaims(payload, errors) {
  const claims = payload.claims || {};

  if (!claims.tc) {
    errors.push('Missing required claim: tc (trustCode)');
    return false;
  }

  if (!claims.mc) {
    errors.push('Missing required claim: mc (masterCode)');
    return false;
  }

  if (!claims.tc.startsWith('TC-')) {
    errors.push(`Invalid tc format: ${claims.tc}`);
  }

  if (!claims.mc.startsWith('MC-')) {
    errors.push(`Invalid mc format: ${claims.mc}`);
  }

  return errors.length === 0;
}

/**
 * Validate implementation status
 */
function validateImplementationStatus(payload, errors, warnings) {
  const metadata = payload.metadata || {};

  if (!metadata.implementationStatus) {
    errors.push('Missing implementationStatus in metadata');
    return false;
  }

  if (metadata.implementationStatus !== 'SCAFFOLDING_ONLY') {
    errors.push(`Invalid implementationStatus: ${metadata.implementationStatus} (expected: SCAFFOLDING_ONLY)`);
  }

  if (metadata.fullPACEAuthentication === true) {
    errors.push('fullPACEAuthentication should be false (this is scaffolding only)');
  }

  if (!metadata.note) {
    warnings.push('Missing implementation note in metadata');
  } else if (!metadata.note.includes('scaffolding')) {
    warnings.push('Implementation note should mention scaffolding status');
  }

  return errors.length === 0;
}

/**
 * Validate BLE GATT structure
 */
function validateBLEStructure(ble, errors, warnings) {
  if (!ble.serviceUUID) {
    errors.push('BLE missing serviceUUID');
  }

  if (!ble.characteristics) {
    errors.push('BLE missing characteristics');
    return false;
  }

  // Validate required characteristics
  const requiredChars = ['deviceInfo', 'command', 'response', 'session'];
  for (const charName of requiredChars) {
    if (!ble.characteristics[charName]) {
      errors.push(`BLE missing required characteristic: ${charName}`);
    } else {
      const char = ble.characteristics[charName];

      if (!char.uuid) {
        errors.push(`Characteristic ${charName} missing uuid`);
      }

      if (!char.properties || !Array.isArray(char.properties)) {
        errors.push(`Characteristic ${charName} missing properties array`);
      }

      if (!char.encoding) {
        warnings.push(`Characteristic ${charName} missing encoding`);
      }
    }
  }

  // Validate message format
  if (!ble.messageFormat) {
    warnings.push('BLE missing messageFormat specification');
  } else {
    if (!ble.messageFormat.header) {
      errors.push('BLE messageFormat missing header');
    }
    if (!ble.messageFormat.payload) {
      errors.push('BLE messageFormat missing payload');
    }
  }

  // Validate connection parameters
  if (!ble.connectionParams) {
    warnings.push('BLE missing connectionParams');
  } else {
    const required = ['minInterval', 'maxInterval', 'mtu'];
    for (const param of required) {
      if (ble.connectionParams[param] === undefined) {
        warnings.push(`BLE connectionParams missing ${param}`);
      }
    }
  }

  // Check for scaffolding note
  if (ble.note && !ble.note.includes('scaffolding')) {
    warnings.push('BLE should be marked as scaffolding');
  }

  return errors.length === 0;
}

/**
 * Validate PACE protocol transcript
 */
function validatePACETranscript(pace, errors, warnings) {
  if (!pace.version) {
    errors.push('PACE missing version');
  }

  if (!pace.protocol || pace.protocol !== 'PACE') {
    errors.push('PACE protocol field must be "PACE"');
  }

  if (!pace.specification) {
    warnings.push('PACE missing specification reference');
  }

  if (pace.implementationStatus !== 'TRANSCRIPT_MODEL_ONLY') {
    errors.push(`PACE implementationStatus should be TRANSCRIPT_MODEL_ONLY, got ${pace.implementationStatus}`);
  }

  // Validate phases
  if (!pace.phases || !Array.isArray(pace.phases)) {
    errors.push('PACE missing phases array');
    return false;
  }

  if (pace.phases.length !== 3) {
    warnings.push(`PACE should have 3 phases (got ${pace.phases.length})`);
  }

  // Validate each phase
  for (const phase of pace.phases) {
    if (!phase.phase || !phase.name) {
      errors.push('PACE phase missing phase number or name');
    }

    if (!phase.steps || !Array.isArray(phase.steps)) {
      errors.push(`PACE phase ${phase.phase} missing steps array`);
      continue;
    }

    // Validate steps
    for (const step of phase.steps) {
      if (!step.step) {
        errors.push('PACE step missing step number');
      }

      if (!step.name) {
        errors.push('PACE step missing name');
      }

      if (!step.direction) {
        errors.push('PACE step missing direction');
      }

      if (!step.synthetic) {
        warnings.push(`PACE step ${step.step} should be marked as synthetic`);
      }

      // Validate APDU structure for commands
      if (step.direction && step.direction.includes('IFD → PICC')) {
        if (!step.apdu) {
          errors.push(`PACE step ${step.step} missing APDU`);
        } else {
          const required = ['cla', 'ins', 'p1', 'p2'];
          for (const field of required) {
            if (!step.apdu[field]) {
              errors.push(`PACE step ${step.step} APDU missing ${field}`);
            }
          }
        }
      }

      // Validate response structure
      if (step.direction && step.direction.includes('PICC → IFD')) {
        if (!step.response) {
          errors.push(`PACE step ${step.step} missing response`);
        } else {
          if (!step.response.data) {
            errors.push(`PACE step ${step.step} response missing data`);
          }
          if (!step.response.sw1sw2) {
            errors.push(`PACE step ${step.step} response missing sw1sw2`);
          }
        }
      }
    }
  }

  // Validate crypto parameters
  if (!pace.cryptoParameters) {
    errors.push('PACE missing cryptoParameters');
  } else {
    const required = ['keyAgreement', 'curve', 'symmetricCipher', 'mac', 'kdf'];
    for (const param of required) {
      if (!pace.cryptoParameters[param]) {
        errors.push(`PACE cryptoParameters missing ${param}`);
      }
    }
  }

  // Validate test vectors
  if (!pace.testVectors) {
    warnings.push('PACE missing testVectors');
  } else {
    if (!pace.testVectors.note || !pace.testVectors.note.includes('Synthetic')) {
      errors.push('PACE testVectors must be marked as synthetic');
    }
  }

  // Validate security notes
  if (!pace.securityNotes || !Array.isArray(pace.securityNotes)) {
    warnings.push('PACE missing securityNotes');
  } else {
    const hasTranscriptNote = pace.securityNotes.some(note =>
      note.includes('transcript model') || note.includes('scaffolding')
    );
    if (!hasTranscriptNote) {
      errors.push('PACE securityNotes should mention transcript/scaffolding status');
    }
  }

  // Validate future integration guidance
  if (!pace.futureIntegration) {
    warnings.push('PACE missing futureIntegration guidance');
  } else {
    if (!pace.futureIntegration.requiredComponents) {
      warnings.push('PACE futureIntegration missing requiredComponents');
    }
    if (!pace.futureIntegration.standards) {
      warnings.push('PACE futureIntegration missing standards');
    }
  }

  return errors.length === 0;
}

export default {
  verifyBLEPACE,
};
