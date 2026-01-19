/**
 * ICAO DTC Verifier
 * Validates ICAO DTC structure, MRZ, data groups, and CMS SignedData
 */

/**
 * Verify an ICAO DTC payload
 * @param {object} dtcPayload - The DTC payload to verify
 * @returns {object} Verification result
 */
export async function verifyDTC(dtcPayload) {
  const errors = [];
  const warnings = [];
  const checks = {};

  try {
    // Check 1: Validate payload structure
    checks.structure = validateStructure(dtcPayload, errors);

    // Check 2: Validate required claims (tc, mc)
    checks.claims = validateClaims(dtcPayload, errors);

    // Check 3: Validate issuer
    checks.issuer = validateIssuer(dtcPayload, errors);

    // Check 4: Validate MRZ format
    if (dtcPayload.data?.mrz) {
      checks.mrz = validateMRZ(dtcPayload.data.mrz, errors, warnings);
    } else {
      errors.push('Missing MRZ data');
    }

    // Check 5: Validate data groups
    if (dtcPayload.data?.dataGroups) {
      checks.dataGroups = validateDataGroups(dtcPayload.data.dataGroups, errors, warnings);
    } else {
      errors.push('Missing data groups');
    }

    // Check 6: Validate SOD (Security Object Data)
    if (dtcPayload.data?.sod) {
      checks.sod = validateSOD(dtcPayload.data.sod, dtcPayload.data.dataGroups, errors);
    } else {
      errors.push('Missing SOD');
    }

    // Check 7: Validate CMS SignedData structure
    if (dtcPayload.data?.cmsSignedData) {
      checks.cmsSignedData = validateCMSSignedData(dtcPayload.data.cmsSignedData, errors, warnings);
    } else {
      errors.push('Missing CMS SignedData');
    }

    // Check 8: Validate certificate chain
    if (dtcPayload.data?.certChain) {
      checks.certChain = validateCertChain(dtcPayload.data.certChain, errors, warnings);
    } else {
      warnings.push('No certificate chain provided');
    }

    const verified = errors.length === 0;

    return {
      success: true,
      verified,
      family: 'ICAO DTC',
      type: 'Digital Travel Credential',
      checks,
      errors,
      warnings,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      verified: false,
      family: 'ICAO DTC',
      type: 'Digital Travel Credential',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Validate DTC structure
 */
function validateStructure(payload, errors) {
  const required = ['success', 'family', 'type', 'data', 'claims', 'metadata'];
  const missing = required.filter(field => !(field in payload));

  if (missing.length > 0) {
    errors.push(`Missing required fields: ${missing.join(', ')}`);
    return false;
  }

  if (payload.family !== 'ICAO DTC') {
    errors.push(`Invalid family: expected 'ICAO DTC', got '${payload.family}'`);
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
 * Validate issuer
 */
function validateIssuer(payload, errors) {
  const issuer = payload.claims?.issuer;

  if (!issuer) {
    errors.push('Missing issuer in claims');
    return false;
  }

  const validIssuers = [
    'https://iss.trustvault.eu',
    'https://iss.trustvault.eu/backup',
  ];

  if (!validIssuers.includes(issuer)) {
    errors.push(`Invalid issuer: ${issuer}`);
    return false;
  }

  return true;
}

/**
 * Validate MRZ format and check digits
 */
function validateMRZ(mrz, errors, warnings) {
  if (!mrz.line1 || !mrz.line2) {
    errors.push('MRZ missing line1 or line2');
    return false;
  }

  if (!mrz.format) {
    warnings.push('MRZ missing format field');
  }

  // TD3 format validation (passport)
  if (mrz.format === 'TD3') {
    if (mrz.line1.length !== 44) {
      errors.push(`MRZ line1 invalid length: ${mrz.line1.length} (expected 44)`);
    }

    if (mrz.line2.length !== 44) {
      errors.push(`MRZ line2 invalid length: ${mrz.line2.length} (expected 44)`);
    }

    // Validate line1 starts with P<
    if (!mrz.line1.startsWith('P<')) {
      errors.push('MRZ line1 should start with P< for passport');
    }
  }

  // Validate check digits are present
  if (!mrz.checkDigits) {
    warnings.push('MRZ missing check digits');
  } else {
    const required = ['documentNumber', 'dateOfBirth', 'dateOfExpiry', 'composite'];
    const missing = required.filter(field => !(field in mrz.checkDigits));
    if (missing.length > 0) {
      warnings.push(`MRZ check digits missing: ${missing.join(', ')}`);
    }
  }

  return errors.length === 0;
}

/**
 * Validate data groups
 */
function validateDataGroups(dataGroups, errors, warnings) {
  if (Object.keys(dataGroups).length === 0) {
    errors.push('No data groups present');
    return false;
  }

  // DG1 is mandatory (MRZ)
  if (!dataGroups.DG1) {
    errors.push('Missing mandatory data group: DG1 (MRZ)');
  }

  // Validate each data group
  for (const [dgNum, dg] of Object.entries(dataGroups)) {
    if (!dg.name) {
      warnings.push(`Data group ${dgNum} missing name`);
    }

    if (!dg.content) {
      errors.push(`Data group ${dgNum} missing content`);
    }

    if (!dg.hash) {
      errors.push(`Data group ${dgNum} missing hash`);
    } else if (!/^[0-9a-f]{64}$/i.test(dg.hash)) {
      errors.push(`Data group ${dgNum} hash is not valid SHA-256`);
    }
  }

  return errors.length === 0;
}

/**
 * Validate SOD (Security Object Data)
 */
function validateSOD(sod, dataGroups, errors) {
  if (!sod.version) {
    errors.push('SOD missing version');
  }

  if (!sod.hashAlgorithm) {
    errors.push('SOD missing hashAlgorithm');
  } else if (sod.hashAlgorithm !== 'SHA-256') {
    errors.push(`SOD hashAlgorithm should be SHA-256, got ${sod.hashAlgorithm}`);
  }

  if (!sod.dataGroupHashes) {
    errors.push('SOD missing dataGroupHashes');
    return false;
  }

  // Verify SOD hashes match data group hashes
  if (dataGroups) {
    for (const [dgNum, dg] of Object.entries(dataGroups)) {
      const sodHash = sod.dataGroupHashes[dgNum];
      if (!sodHash) {
        errors.push(`SOD missing hash for data group ${dgNum}`);
      } else if (sodHash !== dg.hash) {
        errors.push(`SOD hash mismatch for ${dgNum}`);
      }
    }
  }

  // Validate ldsSecurityObject
  if (!sod.ldsSecurityObject) {
    errors.push('SOD missing ldsSecurityObject');
  } else {
    if (sod.ldsSecurityObject.version === undefined) {
      errors.push('ldsSecurityObject missing version');
    }

    if (!sod.ldsSecurityObject.hashAlgorithm) {
      errors.push('ldsSecurityObject missing hashAlgorithm');
    }

    if (!sod.ldsSecurityObject.dataGroupHashValues) {
      errors.push('ldsSecurityObject missing dataGroupHashValues');
    }
  }

  return errors.length === 0;
}

/**
 * Validate CMS SignedData structure
 */
function validateCMSSignedData(cms, errors, warnings) {
  if (!cms.contentType) {
    errors.push('CMS missing contentType');
  } else if (cms.contentType !== '1.2.840.113549.1.7.2') {
    errors.push(`CMS contentType should be SignedData OID (1.2.840.113549.1.7.2), got ${cms.contentType}`);
  }

  if (!cms.content) {
    errors.push('CMS missing content');
    return false;
  }

  const content = cms.content;

  if (content.version === undefined) {
    errors.push('CMS content missing version');
  }

  if (!content.digestAlgorithms || content.digestAlgorithms.length === 0) {
    errors.push('CMS content missing digestAlgorithms');
  }

  if (!content.encapContentInfo) {
    errors.push('CMS content missing encapContentInfo');
  } else {
    if (!content.encapContentInfo.eContentType) {
      errors.push('CMS encapContentInfo missing eContentType');
    }
    if (!content.encapContentInfo.eContent) {
      errors.push('CMS encapContentInfo missing eContent');
    }
  }

  if (!content.signerInfos || content.signerInfos.length === 0) {
    errors.push('CMS content missing signerInfos');
  } else {
    const signerInfo = content.signerInfos[0];
    if (!signerInfo.digestAlgorithm) {
      errors.push('SignerInfo missing digestAlgorithm');
    }
    if (!signerInfo.signatureAlgorithm) {
      errors.push('SignerInfo missing signatureAlgorithm');
    }
    if (!signerInfo.signature) {
      errors.push('SignerInfo missing signature');
    }
  }

  // Check for synthetic signature warning
  if (cms.note === 'SYNTHETIC_CMS_SIGNEDDATA') {
    warnings.push('CMS SignedData uses synthetic signature (not HSM-signed)');
  }

  return errors.length === 0;
}

/**
 * Validate certificate chain
 */
function validateCertChain(certChain, errors, warnings) {
  if (!certChain.csca) {
    errors.push('Certificate chain missing CSCA');
  } else {
    if (!certChain.csca.certificate) {
      errors.push('CSCA missing certificate');
    }
    if (!certChain.csca.subject) {
      warnings.push('CSCA missing subject');
    }
  }

  if (!certChain.ds) {
    errors.push('Certificate chain missing DS');
  } else {
    if (!certChain.ds.certificate) {
      errors.push('DS missing certificate');
    }
    if (!certChain.ds.subject) {
      warnings.push('DS missing subject');
    }
  }

  // Check for synthetic cert warning
  if (certChain.note === 'Synthetic certificate chain placeholder') {
    warnings.push('Certificate chain is synthetic placeholder');
  }

  return errors.length === 0;
}

export default {
  verifyDTC,
};
