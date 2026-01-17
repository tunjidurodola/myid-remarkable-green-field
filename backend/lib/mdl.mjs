/**
 * ISO 18013-5 Mobile Driving License (mDL) Module
 * Implements mDL credential handling with CBOR encoding and device engagement
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// ISO 18013-5 Namespaces
export const MDL_NAMESPACES = {
  MDL: 'org.iso.18013.5.1.mDL',
  AAMVA: 'org.iso.18013.5.1.aamva',
  POCKETONE: 'com.pocketone.claims',
};

// ISO 18013-5 Data Element Identifiers
export const MDL_DATA_ELEMENTS = {
  // Mandatory elements
  family_name: { namespace: MDL_NAMESPACES.MDL, mandatory: true, description: 'Family name' },
  given_name: { namespace: MDL_NAMESPACES.MDL, mandatory: true, description: 'Given name' },
  birth_date: { namespace: MDL_NAMESPACES.MDL, mandatory: true, description: 'Date of birth' },
  issue_date: { namespace: MDL_NAMESPACES.MDL, mandatory: true, description: 'Date of issue' },
  expiry_date: { namespace: MDL_NAMESPACES.MDL, mandatory: true, description: 'Date of expiry' },
  issuing_country: { namespace: MDL_NAMESPACES.MDL, mandatory: true, description: 'Alpha-2 country code' },
  issuing_authority: { namespace: MDL_NAMESPACES.MDL, mandatory: true, description: 'Issuing authority' },
  document_number: { namespace: MDL_NAMESPACES.MDL, mandatory: true, description: 'Document number' },

  // Optional elements
  portrait: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Portrait image (JPEG/JPEG2000)' },
  driving_privileges: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Driving privileges array' },
  un_distinguishing_sign: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'UN distinguishing sign' },
  administrative_number: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Administrative number' },
  sex: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Sex (1=male, 2=female)' },
  height: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Height in cm' },
  weight: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Weight in kg' },
  eye_colour: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Eye colour' },
  hair_colour: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Hair colour' },
  birth_place: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Place of birth' },
  resident_address: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Resident address' },
  portrait_capture_date: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Portrait capture date' },
  age_in_years: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Age in years' },
  age_birth_year: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Year of birth' },
  age_over_18: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Age over 18' },
  age_over_21: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Age over 21' },
  issuing_jurisdiction: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Issuing jurisdiction' },
  nationality: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Nationality' },
  resident_city: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Resident city' },
  resident_state: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Resident state' },
  resident_postal_code: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Resident postal code' },
  resident_country: { namespace: MDL_NAMESPACES.MDL, mandatory: false, description: 'Resident country' },

  // AAMVA elements (US/Canada specific)
  domestic_driving_privileges: { namespace: MDL_NAMESPACES.AAMVA, mandatory: false, description: 'Domestic driving privileges' },
  name_suffix: { namespace: MDL_NAMESPACES.AAMVA, mandatory: false, description: 'Name suffix' },
  organ_donor: { namespace: MDL_NAMESPACES.AAMVA, mandatory: false, description: 'Organ donor indicator' },
  veteran: { namespace: MDL_NAMESPACES.AAMVA, mandatory: false, description: 'Veteran indicator' },

  // pocketOne extensions
  master_code: { namespace: MDL_NAMESPACES.POCKETONE, mandatory: false, description: 'MasterCode hash' },
  trust_code: { namespace: MDL_NAMESPACES.POCKETONE, mandatory: false, description: 'TrustCode' },
};

/**
 * CBOR Encoding Helpers
 * Simplified CBOR encoding for mDL format
 */
export class CBOREncoder {
  /**
   * Encode a value to CBOR hex string
   */
  static encode(value) {
    // Simplified CBOR encoding - in production use a proper CBOR library
    const buffer = this.encodeValue(value);
    return buffer.toString('hex');
  }

  /**
   * Encode value to buffer
   */
  static encodeValue(value) {
    if (value === null || value === undefined) {
      return Buffer.from([0xf6]); // CBOR null
    }

    if (typeof value === 'boolean') {
      return Buffer.from([value ? 0xf5 : 0xf4]);
    }

    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return this.encodeInteger(value);
      }
      return this.encodeFloat(value);
    }

    if (typeof value === 'string') {
      return this.encodeString(value);
    }

    if (Buffer.isBuffer(value)) {
      return this.encodeBytes(value);
    }

    if (Array.isArray(value)) {
      return this.encodeArray(value);
    }

    if (typeof value === 'object') {
      return this.encodeMap(value);
    }

    throw new Error(`Unsupported CBOR type: ${typeof value}`);
  }

  static encodeInteger(num) {
    if (num >= 0) {
      if (num <= 23) return Buffer.from([num]);
      if (num <= 0xff) return Buffer.from([0x18, num]);
      if (num <= 0xffff) {
        const buf = Buffer.alloc(3);
        buf[0] = 0x19;
        buf.writeUInt16BE(num, 1);
        return buf;
      }
      if (num <= 0xffffffff) {
        const buf = Buffer.alloc(5);
        buf[0] = 0x1a;
        buf.writeUInt32BE(num, 1);
        return buf;
      }
    } else {
      const absNum = -1 - num;
      if (absNum <= 23) return Buffer.from([0x20 + absNum]);
      if (absNum <= 0xff) return Buffer.from([0x38, absNum]);
    }
    throw new Error('Integer too large');
  }

  static encodeString(str) {
    const strBuf = Buffer.from(str, 'utf8');
    const len = strBuf.length;
    let prefix;

    if (len <= 23) {
      prefix = Buffer.from([0x60 + len]);
    } else if (len <= 0xff) {
      prefix = Buffer.from([0x78, len]);
    } else if (len <= 0xffff) {
      prefix = Buffer.alloc(3);
      prefix[0] = 0x79;
      prefix.writeUInt16BE(len, 1);
    } else {
      prefix = Buffer.alloc(5);
      prefix[0] = 0x7a;
      prefix.writeUInt32BE(len, 1);
    }

    return Buffer.concat([prefix, strBuf]);
  }

  static encodeBytes(bytes) {
    const len = bytes.length;
    let prefix;

    if (len <= 23) {
      prefix = Buffer.from([0x40 + len]);
    } else if (len <= 0xff) {
      prefix = Buffer.from([0x58, len]);
    } else if (len <= 0xffff) {
      prefix = Buffer.alloc(3);
      prefix[0] = 0x59;
      prefix.writeUInt16BE(len, 1);
    } else {
      prefix = Buffer.alloc(5);
      prefix[0] = 0x5a;
      prefix.writeUInt32BE(len, 1);
    }

    return Buffer.concat([prefix, bytes]);
  }

  static encodeArray(arr) {
    const len = arr.length;
    let prefix;

    if (len <= 23) {
      prefix = Buffer.from([0x80 + len]);
    } else if (len <= 0xff) {
      prefix = Buffer.from([0x98, len]);
    } else {
      prefix = Buffer.alloc(3);
      prefix[0] = 0x99;
      prefix.writeUInt16BE(len, 1);
    }

    const elements = arr.map(el => this.encodeValue(el));
    return Buffer.concat([prefix, ...elements]);
  }

  static encodeMap(obj) {
    const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
    const len = entries.length;
    let prefix;

    if (len <= 23) {
      prefix = Buffer.from([0xa0 + len]);
    } else if (len <= 0xff) {
      prefix = Buffer.from([0xb8, len]);
    } else {
      prefix = Buffer.alloc(3);
      prefix[0] = 0xb9;
      prefix.writeUInt16BE(len, 1);
    }

    const elements = entries.flatMap(([k, v]) => [
      this.encodeValue(k),
      this.encodeValue(v),
    ]);

    return Buffer.concat([prefix, ...elements]);
  }

  static encodeFloat(num) {
    const buf = Buffer.alloc(9);
    buf[0] = 0xfb;
    buf.writeDoubleBE(num, 1);
    return buf;
  }

  /**
   * Decode CBOR hex string to value
   */
  static decode(hex) {
    const buffer = Buffer.from(hex, 'hex');
    return this.decodeValue(buffer, 0).value;
  }

  static decodeValue(buffer, offset) {
    const initial = buffer[offset];
    const majorType = initial >> 5;
    const additionalInfo = initial & 0x1f;

    switch (majorType) {
      case 0: return this.decodeUnsignedInt(buffer, offset, additionalInfo);
      case 1: return this.decodeNegativeInt(buffer, offset, additionalInfo);
      case 2: return this.decodeByteString(buffer, offset, additionalInfo);
      case 3: return this.decodeTextString(buffer, offset, additionalInfo);
      case 4: return this.decodeArray(buffer, offset, additionalInfo);
      case 5: return this.decodeMap(buffer, offset, additionalInfo);
      case 7: return this.decodeSpecial(buffer, offset, additionalInfo);
      default: throw new Error(`Unknown CBOR major type: ${majorType}`);
    }
  }

  static decodeUnsignedInt(buffer, offset, additionalInfo) {
    if (additionalInfo <= 23) return { value: additionalInfo, length: 1 };
    if (additionalInfo === 24) return { value: buffer[offset + 1], length: 2 };
    if (additionalInfo === 25) return { value: buffer.readUInt16BE(offset + 1), length: 3 };
    if (additionalInfo === 26) return { value: buffer.readUInt32BE(offset + 1), length: 5 };
    throw new Error('64-bit integers not supported');
  }

  static decodeNegativeInt(buffer, offset, additionalInfo) {
    const unsigned = this.decodeUnsignedInt(buffer, offset, additionalInfo);
    return { value: -1 - unsigned.value, length: unsigned.length };
  }

  static decodeByteString(buffer, offset, additionalInfo) {
    const lenResult = this.decodeUnsignedInt(buffer, offset, additionalInfo);
    const len = lenResult.value;
    const start = offset + lenResult.length;
    return { value: buffer.slice(start, start + len), length: lenResult.length + len };
  }

  static decodeTextString(buffer, offset, additionalInfo) {
    const lenResult = this.decodeUnsignedInt(buffer, offset, additionalInfo);
    const len = lenResult.value;
    const start = offset + lenResult.length;
    return { value: buffer.slice(start, start + len).toString('utf8'), length: lenResult.length + len };
  }

  static decodeArray(buffer, offset, additionalInfo) {
    const lenResult = this.decodeUnsignedInt(buffer, offset, additionalInfo);
    const len = lenResult.value;
    let currentOffset = offset + lenResult.length;
    const arr = [];

    for (let i = 0; i < len; i++) {
      const result = this.decodeValue(buffer, currentOffset);
      arr.push(result.value);
      currentOffset += result.length;
    }

    return { value: arr, length: currentOffset - offset };
  }

  static decodeMap(buffer, offset, additionalInfo) {
    const lenResult = this.decodeUnsignedInt(buffer, offset, additionalInfo);
    const len = lenResult.value;
    let currentOffset = offset + lenResult.length;
    const map = {};

    for (let i = 0; i < len; i++) {
      const keyResult = this.decodeValue(buffer, currentOffset);
      currentOffset += keyResult.length;
      const valueResult = this.decodeValue(buffer, currentOffset);
      currentOffset += valueResult.length;
      map[keyResult.value] = valueResult.value;
    }

    return { value: map, length: currentOffset - offset };
  }

  static decodeSpecial(buffer, offset, additionalInfo) {
    if (additionalInfo === 20) return { value: false, length: 1 };
    if (additionalInfo === 21) return { value: true, length: 1 };
    if (additionalInfo === 22) return { value: null, length: 1 };
    if (additionalInfo === 23) return { value: undefined, length: 1 };
    if (additionalInfo === 27) {
      return { value: buffer.readDoubleBE(offset + 1), length: 9 };
    }
    throw new Error(`Unknown CBOR special value: ${additionalInfo}`);
  }
}

/**
 * Device Engagement for mDL presentation
 * Generates QR codes for initiating mDL presentation sessions
 */
export class DeviceEngagement {
  /**
   * Generate device engagement structure
   */
  static generate(options = {}) {
    const sessionId = options.sessionId || uuidv4();
    const deviceKey = options.deviceKey || this.generateDeviceKey();

    const engagement = {
      version: '1.0',
      sessionId,
      deviceKey: {
        kty: 'EC',
        crv: 'P-256',
        x: deviceKey.x,
        y: deviceKey.y,
      },
      security: {
        cipherSuite: 1, // AES-256-GCM
        readerKeyRequired: options.readerKeyRequired || false,
      },
      originInfos: options.originInfos || [],
      timestamp: new Date().toISOString(),
    };

    return {
      engagement,
      sessionId,
      deviceKey,
      cbor: CBOREncoder.encode(engagement),
    };
  }

  /**
   * Generate ephemeral device key pair
   */
  static generateDeviceKey() {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();

    const publicKey = ecdh.getPublicKey();
    // Extract x and y coordinates (skip the 0x04 prefix for uncompressed)
    const x = publicKey.slice(1, 33).toString('base64url');
    const y = publicKey.slice(33, 65).toString('base64url');

    return {
      x,
      y,
      privateKey: ecdh.getPrivateKey().toString('base64url'),
      publicKey: publicKey.toString('base64url'),
    };
  }

  /**
   * Generate QR code data for device engagement
   */
  static generateQRData(engagement) {
    // mdoc: URI scheme with base64url encoded CBOR
    const cborData = typeof engagement.cbor === 'string'
      ? engagement.cbor
      : CBOREncoder.encode(engagement);

    return `mdoc://${Buffer.from(cborData, 'hex').toString('base64url')}`;
  }

  /**
   * Parse device engagement from QR data
   */
  static parseQRData(qrData) {
    if (!qrData.startsWith('mdoc://')) {
      throw new Error('Invalid mDL QR code format');
    }

    const base64Data = qrData.slice(7);
    const cborHex = Buffer.from(base64Data, 'base64url').toString('hex');
    return CBOREncoder.decode(cborHex);
  }
}

/**
 * Session Encryption for mDL presentation
 */
export class SessionEncryption {
  /**
   * Derive session keys using ECDH
   */
  static deriveSessionKeys(devicePrivateKey, readerPublicKey) {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(Buffer.from(devicePrivateKey, 'base64url'));

    const sharedSecret = ecdh.computeSecret(Buffer.from(readerPublicKey, 'base64url'));

    // Derive encryption and MAC keys using HKDF
    const salt = Buffer.alloc(32);
    const info = Buffer.from('SKDevice', 'utf8');

    const prk = crypto.createHmac('sha256', salt).update(sharedSecret).digest();
    const sessionKey = crypto.createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest();

    return {
      encryptionKey: sessionKey.slice(0, 16),
      macKey: sessionKey.slice(16),
    };
  }

  /**
   * Encrypt session data
   */
  static encrypt(data, key, associatedData = null) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    if (associatedData) {
      cipher.setAAD(Buffer.from(associatedData));
    }

    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('base64url'),
      iv: iv.toString('base64url'),
      tag: authTag.toString('base64url'),
    };
  }

  /**
   * Decrypt session data
   */
  static decrypt(encryptedData, key, associatedData = null) {
    const iv = Buffer.from(encryptedData.iv, 'base64url');
    const ciphertext = Buffer.from(encryptedData.ciphertext, 'base64url');
    const tag = Buffer.from(encryptedData.tag, 'base64url');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    if (associatedData) {
      decipher.setAAD(Buffer.from(associatedData));
    }

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
  }
}

/**
 * mDL Document Builder
 */
export class MDLDocument {
  constructor() {
    this.version = '1.0';
    this.docType = MDL_NAMESPACES.MDL;
    this.namespaces = {};
    this.issuerAuth = null;
    this.deviceAuth = null;
  }

  /**
   * Add data element to namespace
   */
  addElement(namespace, elementId, value, salt = null) {
    if (!this.namespaces[namespace]) {
      this.namespaces[namespace] = {};
    }

    this.namespaces[namespace][elementId] = {
      value,
      salt: salt || crypto.randomBytes(16).toString('hex'),
    };

    return this;
  }

  /**
   * Add mandatory mDL elements
   */
  setMandatoryElements(data) {
    const ns = MDL_NAMESPACES.MDL;

    return this
      .addElement(ns, 'family_name', data.familyName)
      .addElement(ns, 'given_name', data.givenName)
      .addElement(ns, 'birth_date', data.birthDate)
      .addElement(ns, 'issue_date', data.issueDate)
      .addElement(ns, 'expiry_date', data.expiryDate)
      .addElement(ns, 'issuing_country', data.issuingCountry)
      .addElement(ns, 'issuing_authority', data.issuingAuthority)
      .addElement(ns, 'document_number', data.documentNumber);
  }

  /**
   * Add portrait image
   */
  setPortrait(base64Image) {
    return this.addElement(MDL_NAMESPACES.MDL, 'portrait', base64Image);
  }

  /**
   * Add driving privileges
   */
  setDrivingPrivileges(privileges) {
    return this.addElement(MDL_NAMESPACES.MDL, 'driving_privileges', privileges);
  }

  /**
   * Add pocketOne extensions
   */
  setPocketOneExtensions(masterCode, trustCode) {
    const ns = MDL_NAMESPACES.POCKETONE;
    return this
      .addElement(ns, 'master_code', masterCode)
      .addElement(ns, 'trust_code', trustCode);
  }

  /**
   * Set issuer authentication
   */
  setIssuerAuth(signature, certificate, algorithm = 'ES256') {
    this.issuerAuth = {
      signature,
      certificate,
      algorithm,
    };
    return this;
  }

  /**
   * Set device authentication
   */
  setDeviceAuth(signature) {
    this.deviceAuth = {
      deviceSignature: signature,
    };
    return this;
  }

  /**
   * Build the mDL document
   */
  build() {
    // Extract just the values for the final document
    const namespaces = {};
    for (const [ns, elements] of Object.entries(this.namespaces)) {
      namespaces[ns] = {};
      for (const [key, data] of Object.entries(elements)) {
        namespaces[ns][key] = data.value;
      }
    }

    return {
      version: this.version,
      docType: this.docType,
      namespaces,
      issuerAuth: this.issuerAuth,
      deviceAuth: this.deviceAuth,
    };
  }

  /**
   * Build with salts included (for selective disclosure)
   */
  buildWithSalts() {
    return {
      version: this.version,
      docType: this.docType,
      namespaces: this.namespaces,
      issuerAuth: this.issuerAuth,
      deviceAuth: this.deviceAuth,
    };
  }

  /**
   * Encode to CBOR
   */
  toCBOR() {
    return CBOREncoder.encode(this.build());
  }

  /**
   * Create from existing document
   */
  static fromDocument(doc) {
    const mdl = new MDLDocument();
    mdl.version = doc.version;
    mdl.docType = doc.docType;
    mdl.issuerAuth = doc.issuerAuth;
    mdl.deviceAuth = doc.deviceAuth;

    // Convert namespaces to internal format with generated salts
    for (const [ns, elements] of Object.entries(doc.namespaces || {})) {
      for (const [key, value] of Object.entries(elements)) {
        if (typeof value === 'object' && value.salt) {
          mdl.namespaces[ns] = mdl.namespaces[ns] || {};
          mdl.namespaces[ns][key] = value;
        } else {
          mdl.addElement(ns, key, value);
        }
      }
    }

    return mdl;
  }
}

/**
 * Presentation Request handling
 */
export class PresentationRequest {
  /**
   * Create a presentation request
   */
  static create(options) {
    return {
      id: uuidv4(),
      type: 'mDL',
      docType: MDL_NAMESPACES.MDL,
      requestedElements: options.requestedElements || [],
      readerAuth: options.readerAuth || null,
      intentToRetain: options.intentToRetain || false,
      purpose: options.purpose || 'identity_verification',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate a presentation request
   */
  static validate(request) {
    const errors = [];

    if (!request.id) errors.push('Missing request ID');
    if (!request.docType) errors.push('Missing document type');
    if (!request.requestedElements || !Array.isArray(request.requestedElements)) {
      errors.push('Invalid requested elements');
    }

    // Validate requested elements exist
    for (const element of request.requestedElements || []) {
      if (!MDL_DATA_ELEMENTS[element]) {
        errors.push(`Unknown data element: ${element}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a presentation response
   */
  static createResponse(request, mdlDocument, disclosedElements) {
    const disclosed = {};

    for (const element of disclosedElements) {
      const elementDef = MDL_DATA_ELEMENTS[element];
      if (!elementDef) continue;

      const ns = elementDef.namespace;
      if (mdlDocument.namespaces[ns] && mdlDocument.namespaces[ns][element] !== undefined) {
        if (!disclosed[ns]) disclosed[ns] = {};
        disclosed[ns][element] = mdlDocument.namespaces[ns][element];
      }
    }

    return {
      requestId: request.id,
      docType: mdlDocument.docType,
      namespaces: disclosed,
      issuerAuth: mdlDocument.issuerAuth,
      deviceAuth: mdlDocument.deviceAuth,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate) {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

/**
 * Create age-over claims
 */
export function createAgeOverClaims(birthDate, thresholds = [18, 21, 65]) {
  const age = calculateAge(birthDate);
  const claims = {};

  for (const threshold of thresholds) {
    claims[`age_over_${threshold}`] = age >= threshold;
  }

  return claims;
}

export default {
  MDL_NAMESPACES,
  MDL_DATA_ELEMENTS,
  CBOREncoder,
  DeviceEngagement,
  SessionEncryption,
  MDLDocument,
  PresentationRequest,
  calculateAge,
  createAgeOverClaims,
};
