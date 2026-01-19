/**
 * NFC NDEF Verifier
 * Validates NDEF record structure and encoding
 */

/**
 * Verify an NDEF payload
 * @param {object} ndefPayload - The NDEF payload to verify
 * @returns {object} Verification result
 */
export async function verifyNDEF(ndefPayload) {
  const errors = [];
  const warnings = [];
  const checks = {};

  try {
    // Check 1: Validate payload structure
    checks.structure = validateStructure(ndefPayload, errors);

    // Check 2: Validate required claims (tc, mc)
    checks.claims = validateClaims(ndefPayload, errors);

    // Check 3: Validate records
    if (ndefPayload.data?.records) {
      checks.records = validateRecords(ndefPayload.data.records, errors, warnings);
    } else {
      errors.push('Missing records');
    }

    // Check 4: Validate NDEF encoding
    if (ndefPayload.data?.encodedMessage) {
      checks.encoding = validateEncoding(ndefPayload.data.encodedMessage, errors, warnings);
    } else {
      errors.push('Missing encoded message');
    }

    // Check 5: Validate record types
    checks.recordTypes = validateRecordTypes(ndefPayload.data?.records, errors);

    const verified = errors.length === 0;

    return {
      success: true,
      verified,
      family: 'NFC NDEF',
      type: 'NDEF Message',
      checks,
      errors,
      warnings,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      verified: false,
      family: 'NFC NDEF',
      type: 'NDEF Message',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Validate NDEF structure
 */
function validateStructure(payload, errors) {
  const required = ['success', 'family', 'type', 'data', 'claims', 'metadata'];
  const missing = required.filter(field => !(field in payload));

  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
    return false;
  }

  if (payload.family !== 'NFC NDEF') {
    errors.push(`Invalid family: expected 'NFC NDEF', got '${payload.family}'`);
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
 * Validate NDEF records
 */
function validateRecords(records, errors, warnings) {
  if (!Array.isArray(records)) {
    errors.push('Records must be an array');
    return false;
  }

  if (records.length === 0) {
    errors.push('No records present');
    return false;
  }

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const recordId = record.id || `record-${i}`;

    if (record.tnf === undefined) {
      errors.push(`Record ${recordId} missing tnf (Type Name Format)`);
    }

    if (!record.type) {
      errors.push(`Record ${recordId} missing type`);
    }

    if (!record.payload) {
      errors.push(`Record ${recordId} missing payload`);
    }

    if (record.length === undefined) {
      warnings.push(`Record ${recordId} missing length`);
    }

    if (!record.encoding) {
      warnings.push(`Record ${recordId} missing encoding`);
    }
  }

  return errors.length === 0;
}

/**
 * Validate NDEF encoding
 */
function validateEncoding(encodedMessage, errors, warnings) {
  if (!encodedMessage.recordCount) {
    errors.push('Encoded message missing recordCount');
  }

  if (!encodedMessage.records || !Array.isArray(encodedMessage.records)) {
    errors.push('Encoded message missing records array');
    return false;
  }

  if (encodedMessage.totalSize === undefined) {
    warnings.push('Encoded message missing totalSize');
  }

  if (encodedMessage.encoding !== 'NDEF') {
    errors.push(`Invalid encoding: ${encodedMessage.encoding} (expected NDEF)`);
  }

  // Validate each encoded record
  for (const record of encodedMessage.records) {
    if (!record.header) {
      errors.push('Encoded record missing header');
    }

    if (record.typeLength === undefined) {
      errors.push('Encoded record missing typeLength');
    }

    if (record.payloadLength === undefined) {
      errors.push('Encoded record missing payloadLength');
    }

    if (!record.type) {
      errors.push('Encoded record missing type');
    }

    if (!record.payload) {
      errors.push('Encoded record missing payload');
    }
  }

  return errors.length === 0;
}

/**
 * Validate record types
 */
function validateRecordTypes(records, errors) {
  if (!records) {
    return false;
  }

  const foundTypes = {
    uri: false,
    text: false,
    token: false,
  };

  for (const record of records) {
    if (record.type === 'U') {
      foundTypes.uri = true;
    } else if (record.type === 'T') {
      foundTypes.text = true;
    } else if (record.type === 'application/jwt') {
      foundTypes.token = true;

      // Validate token is marked as synthetic
      if (record.note !== 'SYNTHETIC_TOKEN_NO_SECRETS') {
        errors.push('Token record must be marked as SYNTHETIC_TOKEN_NO_SECRETS');
      }
    }
  }

  if (!foundTypes.uri) {
    errors.push('Missing required URI record');
  }

  return errors.length === 0;
}

export default {
  verifyNDEF,
};
