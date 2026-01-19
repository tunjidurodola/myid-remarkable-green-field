/**
 * NFC NDEF Generator
 * Generates NDEF records for engagement URIs and compact tokens
 */

import crypto from 'crypto';

const POLICY = {
  slot: '0006',
  engagementUriScheme: 'myid://',
  deepLinkBase: 'https://aud.pocket.one/engage',
};

/**
 * Generate NDEF records
 * @param {object} options - Generation options
 * @returns {object} Generated NDEF records
 */
export async function generateNDEF(options = {}) {
  const {
    trustCode = 'TC-TEST-NDEF-001',
    masterCode = 'MC-MASTER-NDEF-001',
    includeCompactToken = true,
  } = options;

  try {
    const records = [];

    // Generate engagement URI record
    const engagementRecord = generateEngagementRecord(trustCode, masterCode);
    records.push(engagementRecord);

    // Generate deep link URI record
    const deepLinkRecord = generateDeepLinkRecord(trustCode, masterCode);
    records.push(deepLinkRecord);

    // Generate compact token record (if requested)
    if (includeCompactToken) {
      const tokenRecord = generateCompactTokenRecord(trustCode, masterCode);
      records.push(tokenRecord);
    }

    // Generate text record
    const textRecord = generateTextRecord('myID Credential Tap');
    records.push(textRecord);

    // Encode NDEF message
    const ndefMessage = encodeNDEFMessage(records);

    return {
      success: true,
      family: 'NFC NDEF',
      type: 'NDEF Message',
      data: {
        records,
        encodedMessage: ndefMessage,
      },
      claims: {
        tc: trustCode,
        mc: masterCode,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        slot: POLICY.slot,
        recordCount: records.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      family: 'NFC NDEF',
      type: 'NDEF Message',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Generate engagement URI record
 * Format: myid://engage?tc=...&mc=...&session=...
 */
function generateEngagementRecord(tc, mc) {
  const sessionId = crypto.randomUUID();
  const uri = `${POLICY.engagementUriScheme}engage?tc=${tc}&mc=${mc}&session=${sessionId}`;

  return {
    tnf: 0x01, // Well-known type
    type: 'U', // URI
    id: 'engagement',
    payload: uri,
    encoding: 'UTF-8',
    length: uri.length,
  };
}

/**
 * Generate deep link URI record
 * Format: https://aud.pocket.one/engage?tc=...&mc=...
 */
function generateDeepLinkRecord(tc, mc) {
  const nonce = crypto.randomBytes(8).toString('hex');
  const uri = `${POLICY.deepLinkBase}?tc=${tc}&mc=${mc}&nonce=${nonce}`;

  return {
    tnf: 0x01, // Well-known type
    type: 'U', // URI
    id: 'deeplink',
    payload: uri,
    encoding: 'UTF-8',
    length: uri.length,
  };
}

/**
 * Generate compact token record
 * This is a placeholder token (NO SECRETS)
 */
function generateCompactTokenRecord(tc, mc) {
  // Compact token format: base64url(header.payload.signature)
  // For testing only - no real secrets
  const header = { alg: 'ES256', typ: 'compact+jwt' };
  const payload = {
    tc,
    mc,
    iss: 'https://iss.trustvault.eu',
    aud: 'https://aud.pocket.one',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
    jti: crypto.randomUUID(),
  };

  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureB64 = crypto.randomBytes(32).toString('base64url'); // Synthetic

  const compactToken = `${headerB64}.${payloadB64}.${signatureB64}`;

  return {
    tnf: 0x02, // MIME type
    type: 'application/jwt',
    id: 'token',
    payload: compactToken,
    encoding: 'base64url',
    length: compactToken.length,
    note: 'SYNTHETIC_TOKEN_NO_SECRETS',
  };
}

/**
 * Generate text record
 */
function generateTextRecord(text) {
  return {
    tnf: 0x01, // Well-known type
    type: 'T', // Text
    id: 'label',
    payload: text,
    encoding: 'UTF-8',
    language: 'en',
    length: text.length,
  };
}

/**
 * Encode NDEF message to bytes
 * Simplified encoding for testing
 */
function encodeNDEFMessage(records) {
  const encoded = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const isFirst = i === 0;
    const isLast = i === records.length - 1;

    // NDEF record header byte
    let header = record.tnf;
    if (isFirst) header |= 0x80; // MB (Message Begin)
    if (isLast) header |= 0x40; // ME (Message End)
    if (record.id) header |= 0x08; // IL (ID Length present)

    const typeLength = record.type.length;
    const payloadLength = record.payload.length;
    const idLength = record.id ? record.id.length : 0;

    encoded.push({
      header: `0x${header.toString(16).padStart(2, '0')}`,
      typeLength,
      payloadLength,
      idLength,
      type: record.type,
      id: record.id || null,
      payload: record.payload,
    });
  }

  return {
    recordCount: records.length,
    records: encoded,
    totalSize: encoded.reduce((sum, r) => sum + r.payloadLength + r.typeLength + (r.idLength || 0) + 3, 0),
    encoding: 'NDEF',
  };
}

export default {
  generateNDEF,
};
