# ICAO 9303 Digital Travel Credential (DTC)

## Overview

ICAO Doc 9303 defines standards for machine-readable travel documents (MRTD), including passports, visas, and Digital Travel Credentials.

---

## Key Features

- **Global Standards**: Recognized by 193 ICAO member states
- **Security Object Data (SOD)**: Cryptographically signed data groups
- **Biometric Data**: Facial image, fingerprints, iris scans
- **Active Authentication**: Proves chip authenticity
- **Data Groups**: Modular data structure (DG1-DG16)

---

## Data Groups Structure

### Mandatory Data Groups

| DG | Content | Description |
|----|---------|-------------|
| DG1 | MRZ | Machine Readable Zone |
| DG2 | Face | Facial image (JPEG2000) |

### Optional Data Groups

| DG | Content | Description |
|----|---------|-------------|
| DG3 | Fingerprints | Two fingerprint images |
| DG4 | Iris | Iris biometric data |
| DG7 | Signature | Signature/usual mark |
| DG11 | Personal | Additional personal details |
| DG12 | Document | Additional document details |
| DG14 | Security | Security options |
| DG15 | AA Key | Active Authentication public key |

---

## Machine Readable Zone (MRZ)

### Format (TD3 - Passport)

```
P<ZAFHOFFMEISTER<<ANNA<<<<<<<<<<<<<<<<<<<<<<<<
DL123456789ZAF9005155F3401011234567890<<<<<94
```

### Components
- Document type (P)
- Issuing state (ZAF)
- Name (HOFFMEISTER<<ANNA)
- Document number
- Nationality
- Date of birth (YYMMDD)
- Sex (M/F/<)
- Expiration date
- Check digits

---

## Implementation in myID.africa

### DTC Creation
```typescript
const dtc = ICAODTCCredential.create(
  {
    documentType: 'P',
    issuingState: 'ZAF',
    documentNumber: 'DL123456789',
    familyName: 'HOFFMEISTER',
    givenNames: 'ANNA',
    nationality: 'ZAF',
    dateOfBirth: '1990-05-15',
    sex: 'F',
    dateOfIssue: '2024-01-01',
    dateOfExpiry: '2034-01-01',
    issuingAuthority: 'Department of Home Affairs',
    facialImage: base64Image,
  },
  masterCode,
  trustCode
);
```

### MRZ Generation
```typescript
const mrz = ICAODTCCredential.generateMRZ(documentData);
```

---

## Security Features

### 1. Passive Authentication (PA)
- Verifies document authenticity
- Checks SOD signature
- Validates data group hashes

### 2. Active Authentication (AA)
- Proves chip is genuine
- Prevents chip cloning
- Challenge-response protocol

```typescript
const { response, signature } = ICAODTCCredential.performActiveAuthentication(
  dtc,
  challenge
);
```

### 3. Chip Authentication (CA)
- Establishes secure channel
- Prevents eavesdropping
- Protects biometric data

---

## Selective Disclosure

```typescript
// Request only specific data groups
const disclosed = ICAODTCCredential.extractData(
  dtc,
  ['DG1', 'DG2', 'DG11'] // MRZ, Face, Additional personal
);
```

---

## Biometric Matching

### Face Recognition
- ISO/IEC 19794-5 standard
- Quality score minimum 50
- Liveness detection

### Fingerprint
- ISO/IEC 19794-2 standard
- Minutiae-based matching
- Two fingers minimum

---

## Integration with myID.africa

### 1. Onboarding
- NFC chip reading (Step 8)
- MRZ scanning (Step 7)
- Biometric extraction

### 2. Storage
- Encrypted DTC in IndexedDB
- Data groups stored separately
- Biometrics in secure enclave

### 3. Presentation
- Generate DTC on demand
- Sign with HSM
- QR code or NFC transmission

---

## Compliance

- ✅ ICAO Doc 9303 Part 10 (Logical Data Structure)
- ✅ ICAO Doc 9303 Part 11 (Security Mechanisms)
- ✅ ISO/IEC 7816 (Smart Cards)
- ✅ ISO/IEC 14443 (Contactless Cards)
- ✅ BSI TR-03110 (Advanced Security)

---

## Code Example

```typescript
import { ICAODTCCredential } from '@/lib/credentials/icao-dtc';

// Create DTC
const dtc = ICAODTCCredential.create(documentData, mc, tc);

// Verify integrity
const isValid = ICAODTCCredential.verify(dtc);

// Perform Active Authentication
const aaResult = ICAODTCCredential.performActiveAuthentication(
  dtc,
  randomChallenge
);

// Extract selective data
const minimal = ICAODTCCredential.extractData(dtc, ['DG1']);
```

---

## Travel Use Cases

### 1. Border Control
- Automated border gates
- Biometric verification
- Document validation

### 2. Hotel Check-in
- Identity verification
- Age confirmation
- Nationality check

### 3. Car Rental
- Driver's license validation
- Identity confirmation
- Age verification

---

## Resources

- [ICAO Doc 9303](https://www.icao.int/publications/pages/publication.aspx?docnum=9303)
- [myID.africa DTC Implementation](../lib/credentials/icao-dtc.ts)
- [BSI Technical Guidelines](https://www.bsi.bund.de/EN/Themen/Unternehmen-und-Organisationen/Standards-und-Zertifizierung/Technische-Richtlinien/TR-nach-Thema-sortiert/tr03110/tr-03110.html)
