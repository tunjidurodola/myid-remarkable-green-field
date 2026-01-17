# eIDAS2 Digital Identity Wallet

## Overview

eIDAS2 (European Digital Identity Regulation) defines the framework for European Digital Identity Wallets (EUDI Wallets).

---

## Key Features

- **Pan-European Recognition**: Valid across all EU member states
- **Qualified Electronic Signatures**: Legal equivalence to handwritten signatures
- **Person Identification Data (PID)**: Core identity attributes
- **Qualified Electronic Attestation of Attributes (QEAA)**: Verified attributes
- **Privacy by Design**: Selective disclosure and minimal data sharing

---

## Credential Types

### 1. Person Identification Data (PID)

Core identity credential containing:
- Family name, given name
- Birth date, birth place
- Nationality
- Current address
- Personal identifier (national ID)

### 2. Qualified Electronic Attestation of Attributes (QEAA)

Verified professional or personal attributes:
- Educational qualifications
- Professional licenses
- Age verification
- Residency status

---

## Implementation in myID.africa

### PID Creation
```typescript
const pid = eIDAS2Wallet.createPID(
  {
    did: 'did:pocketone:abc123',
    familyName: 'Hoffmeister',
    givenName: 'Anna',
    birthDate: '1990-05-15',
    nationality: 'DEU',
    personalIdentifier: 'DE123456789',
  },
  issuer,
  masterCode,
  trustCode
);
```

### Selective Disclosure
```typescript
const presentation = eIDAS2Wallet.createPresentation(
  pid,
  ['familyName', 'givenName', 'nationality']
);
```

---

## Security & Privacy

1. **Cryptographic Integrity**
   - JSON Web Signatures (JWS)
   - Qualified certificates
   - Timestamp tokens

2. **Privacy Protection**
   - Minimal disclosure
   - No tracking
   - User consent required

3. **Trust Framework**
   - Registered issuers only
   - Cross-border trust lists
   - Revocation mechanisms

---

## Qualified Electronic Signatures (QES)

### Requirements
- Qualified certificate from trusted CA
- Secure signature creation device (QSCD)
- User authentication
- Legal equivalence to handwritten signature

### Implementation
```typescript
// Sign document with QES
const signature = await qesSign(
  documentHash,
  certificateId,
  userId
);
```

---

## Integration Points

### 1. Authentication
- Sign in to government services
- Access healthcare records
- Financial services KYC

### 2. Document Signing
- Contract signing
- Official forms
- Legal declarations

### 3. Attribute Verification
- Age verification for restricted content
- Professional credential checks
- Residency verification

---

## Compliance

- ✅ eIDAS Regulation (EU) 910/2014
- ✅ eIDAS2 Regulation (EU) 2024/xxx
- ✅ GDPR compliant
- ✅ ISO 27001 security standards
- ✅ ETSI TS 119 312 (Electronic Signatures)

---

## Wallet Provider Requirements

1. **Certification**: Must be certified by member state
2. **Security**: Level of Assurance High (LoA High)
3. **Interoperability**: Support common protocols
4. **Availability**: 99.5% uptime SLA
5. **Privacy**: No user tracking or profiling

---

## Code Example

```typescript
import { eIDAS2Wallet } from '@/lib/credentials/eidas2';

// Create PID credential
const pid = eIDAS2Wallet.createPID(userData, issuer, mc, tc);

// Create QEAA
const qeaa = eIDAS2Wallet.createQEAA(
  { professionalLicense: 'Medical Doctor' },
  issuer,
  holderDID
);

// Verify credential
const isValid = await eIDAS2Wallet.verify(pid);

// Create selective disclosure
const presentation = eIDAS2Wallet.createPresentation(
  pid,
  ['familyName', 'nationality']
);
```

---

## Resources

- [eIDAS Regulation](https://digital-strategy.ec.europa.eu/en/policies/eidas-regulation)
- [EUDI Wallet Architecture](https://github.com/eu-digital-identity-wallet)
- [myID.africa eIDAS2 Implementation](../lib/credentials/eidas2.ts)
