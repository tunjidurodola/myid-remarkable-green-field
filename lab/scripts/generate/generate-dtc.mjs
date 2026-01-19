/**
 * ICAO DTC (Digital Travel Credential) Generator
 * Generates synthetic CMS SignedData payloads consistent with ICAO Doc 9303
 */

import crypto from 'crypto';
import forge from 'node-forge';

const POLICY = {
  issuer: 'https://iss.trustvault.eu',
  slot: '0003',
  issuingCountry: 'ZAF',
  issuingAuthority: 'Department of Home Affairs',
};

/**
 * Generate an ICAO DTC payload
 * @param {object} options - Generation options
 * @returns {object} Generated DTC with CMS SignedData
 */
export async function generateDTC(options = {}) {
  const {
    trustCode = 'TC-TEST-DTC-001',
    masterCode = 'MC-MASTER-DTC-001',
    includeCertChain = true,
  } = options;

  try {
    // Generate synthetic travel document data
    const travelData = {
      documentType: 'P', // Passport
      documentNumber: `ZA${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
      issuingCountry: POLICY.issuingCountry,
      nationality: 'ZAF',
      primaryIdentifier: 'SMITH',
      secondaryIdentifier: 'JOHN MICHAEL',
      dateOfBirth: '850615', // YYMMDD format
      sex: 'M',
      dateOfExpiry: '340101',
      dateOfIssue: '240101',
      optionalData: '',
      // pocketOne extensions
      trustCode,
      masterCode,
    };

    // Generate MRZ (Machine Readable Zone)
    const mrz = generateMRZ(travelData);

    // Create data groups (DG1-DG16)
    const dataGroups = createDataGroups(travelData, mrz);

    // Create Security Object Data (SOD)
    const sod = createSOD(dataGroups);

    // Generate synthetic certificate chain
    const certChain = includeCertChain ? generateSyntheticCertChain() : null;

    // Create CMS SignedData structure
    const cmsSignedData = createCMSSignedData(sod, certChain);

    return {
      success: true,
      family: 'ICAO DTC',
      type: 'Digital Travel Credential',
      data: {
        travelData,
        mrz,
        dataGroups,
        sod,
        cmsSignedData,
        certChain,
      },
      claims: {
        tc: trustCode,
        mc: masterCode,
        issuer: POLICY.issuer,
        issuingCountry: POLICY.issuingCountry,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        slot: POLICY.slot,
        cmsFormat: 'SignedData',
        dataGroupCount: Object.keys(dataGroups).length,
      },
    };
  } catch (error) {
    return {
      success: false,
      family: 'ICAO DTC',
      type: 'Digital Travel Credential',
      error: error.message,
      stack: error.stack,
    };
  }
}

/**
 * Generate MRZ according to ICAO Doc 9303
 */
function generateMRZ(data) {
  // TD3 format (passport)
  // Line 1: P<ISSUING_COUNTRY<SURNAME<<GIVEN_NAMES<<<<<<<<<<<<<<<
  // Line 2: DOCUMENT_NUMBER<CHECK_DIGIT<NATIONALITY<DOB<CHECK<SEX<EXPIRY<CHECK<<<<<<<<CHECK

  const line1Parts = [
    'P<',
    data.issuingCountry,
    data.primaryIdentifier.replace(/ /g, '<'),
    '<<',
    data.secondaryIdentifier.replace(/ /g, '<'),
  ];
  const line1 = line1Parts.join('').padEnd(44, '<');

  // Calculate check digits
  const docNumCheck = calculateMRZCheckDigit(data.documentNumber);
  const dobCheck = calculateMRZCheckDigit(data.dateOfBirth);
  const expiryCheck = calculateMRZCheckDigit(data.dateOfExpiry);
  const compositeCheck = calculateMRZCheckDigit(
    data.documentNumber + docNumCheck +
    data.dateOfBirth + dobCheck +
    data.dateOfExpiry + expiryCheck
  );

  const line2Parts = [
    data.documentNumber,
    docNumCheck,
    data.nationality,
    data.dateOfBirth,
    dobCheck,
    data.sex,
    data.dateOfExpiry,
    expiryCheck,
    data.optionalData || '',
  ];
  const line2Base = line2Parts.join('').padEnd(43, '<');
  const line2 = line2Base + compositeCheck;

  return {
    line1,
    line2,
    format: 'TD3',
    checkDigits: {
      documentNumber: docNumCheck,
      dateOfBirth: dobCheck,
      dateOfExpiry: expiryCheck,
      composite: compositeCheck,
    },
  };
}

/**
 * Calculate MRZ check digit using ICAO algorithm
 */
function calculateMRZCheckDigit(input) {
  const weights = [7, 3, 1];
  let sum = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    let value;

    if (char >= '0' && char <= '9') {
      value = parseInt(char, 10);
    } else if (char >= 'A' && char <= 'Z') {
      value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
    } else if (char === '<') {
      value = 0;
    } else {
      value = 0;
    }

    sum += value * weights[i % 3];
  }

  return (sum % 10).toString();
}

/**
 * Create ICAO data groups
 */
function createDataGroups(data, mrz) {
  return {
    DG1: {
      name: 'MRZ Information',
      content: mrz,
      hash: crypto.createHash('sha256').update(JSON.stringify(mrz)).digest('hex'),
    },
    DG2: {
      name: 'Encoded Face',
      content: 'SYNTHETIC_FACE_IMAGE_DATA',
      hash: crypto.createHash('sha256').update('SYNTHETIC_FACE_IMAGE_DATA').digest('hex'),
    },
    DG11: {
      name: 'Additional Personal Details',
      content: {
        fullName: `${data.secondaryIdentifier} ${data.primaryIdentifier}`,
        placeOfBirth: 'Cape Town, South Africa',
        trustCode: data.trustCode,
        masterCode: data.masterCode,
      },
      hash: crypto.createHash('sha256').update(
        JSON.stringify({
          fullName: `${data.secondaryIdentifier} ${data.primaryIdentifier}`,
          placeOfBirth: 'Cape Town, South Africa',
        })
      ).digest('hex'),
    },
    DG14: {
      name: 'Security Options',
      content: {
        activeAuthentication: true,
        chipAuthentication: true,
        pace: false, // PACE not fully implemented
      },
      hash: crypto.createHash('sha256').update('SECURITY_OPTIONS').digest('hex'),
    },
  };
}

/**
 * Create Security Object Data (SOD)
 */
function createSOD(dataGroups) {
  const dgHashes = {};
  for (const [dgNum, dg] of Object.entries(dataGroups)) {
    dgHashes[dgNum] = dg.hash;
  }

  const sod = {
    version: 'v1',
    hashAlgorithm: 'SHA-256',
    dataGroupHashes: dgHashes,
    ldsSecurityObject: {
      version: 0,
      hashAlgorithm: {
        algorithm: '2.16.840.1.101.3.4.2.1', // SHA-256 OID
      },
      dataGroupHashValues: dgHashes,
    },
  };

  return sod;
}

/**
 * Generate synthetic certificate chain
 */
function generateSyntheticCertChain() {
  try {
    // Generate CSCA (Country Signing CA) certificate
    const cscaKeys = forge.pki.rsa.generateKeyPair(2048);
    const cscaCert = forge.pki.createCertificate();
    cscaCert.publicKey = cscaKeys.publicKey;
    cscaCert.serialNumber = '01';
    cscaCert.validity.notBefore = new Date();
    cscaCert.validity.notAfter = new Date();
    cscaCert.validity.notAfter.setFullYear(cscaCert.validity.notBefore.getFullYear() + 10);

    const cscaAttrs = [
      { name: 'commonName', value: 'CSCA-ZA' },
      { name: 'countryName', value: 'ZA' },
      { name: 'organizationName', value: 'Department of Home Affairs' },
    ];
    cscaCert.setSubject(cscaAttrs);
    cscaCert.setIssuer(cscaAttrs);
    cscaCert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true },
    ]);
    cscaCert.sign(cscaKeys.privateKey, forge.md.sha256.create());

    // Generate DS (Document Signer) certificate
    const dsKeys = forge.pki.rsa.generateKeyPair(2048);
    const dsCert = forge.pki.createCertificate();
    dsCert.publicKey = dsKeys.publicKey;
    dsCert.serialNumber = '02';
    dsCert.validity.notBefore = new Date();
    dsCert.validity.notAfter = new Date();
    dsCert.validity.notAfter.setFullYear(dsCert.validity.notBefore.getFullYear() + 3);

    const dsAttrs = [
      { name: 'commonName', value: 'DS-ZA-001' },
      { name: 'countryName', value: 'ZA' },
      { name: 'organizationName', value: 'Department of Home Affairs' },
    ];
    dsCert.setSubject(dsAttrs);
    dsCert.setIssuer(cscaAttrs);
    dsCert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true },
    ]);
    dsCert.sign(cscaKeys.privateKey, forge.md.sha256.create());

    return {
      csca: {
        certificate: forge.pki.certificateToPem(cscaCert),
        subject: 'CN=CSCA-ZA, C=ZA, O=Department of Home Affairs',
        issuer: 'CN=CSCA-ZA, C=ZA, O=Department of Home Affairs',
        serialNumber: '01',
      },
      ds: {
        certificate: forge.pki.certificateToPem(dsCert),
        subject: 'CN=DS-ZA-001, C=ZA, O=Department of Home Affairs',
        issuer: 'CN=CSCA-ZA, C=ZA, O=Department of Home Affairs',
        serialNumber: '02',
      },
      privateKey: forge.pki.privateKeyToPem(dsKeys.privateKey),
    };
  } catch (error) {
    console.error('Certificate generation error:', error);
    return {
      csca: { certificate: 'SYNTHETIC_CSCA_CERT' },
      ds: { certificate: 'SYNTHETIC_DS_CERT' },
      note: 'Synthetic certificate chain placeholder',
    };
  }
}

/**
 * Create CMS SignedData structure
 */
function createCMSSignedData(sod, certChain) {
  const sodContent = JSON.stringify(sod.ldsSecurityObject);

  return {
    contentType: '1.2.840.113549.1.7.2', // SignedData OID
    content: {
      version: 1,
      digestAlgorithms: ['2.16.840.1.101.3.4.2.1'], // SHA-256
      encapContentInfo: {
        eContentType: '1.2.840.113549.1.7.1', // data
        eContent: Buffer.from(sodContent).toString('base64'),
      },
      certificates: certChain ? [certChain.csca.certificate, certChain.ds.certificate] : [],
      signerInfos: [
        {
          version: 1,
          sid: {
            issuerAndSerialNumber: {
              issuer: 'CN=CSCA-ZA, C=ZA',
              serialNumber: '02',
            },
          },
          digestAlgorithm: '2.16.840.1.101.3.4.2.1',
          signatureAlgorithm: '1.2.840.113549.1.1.11', // sha256WithRSAEncryption
          signature: crypto.randomBytes(256).toString('base64'), // Synthetic signature
        },
      ],
    },
    note: 'SYNTHETIC_CMS_SIGNEDDATA',
  };
}

export default {
  generateDTC,
};
