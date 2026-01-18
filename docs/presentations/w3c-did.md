# W3C Decentralized Identifiers (DIDs) & Verifiable Credentials

## Overview

W3C DID and Verifiable Credentials (VC) provide a decentralized, privacy-preserving identity framework.

---

## Key Concepts

### Decentralized Identifiers (DIDs)
- Self-sovereign identity
- No central authority
- Cryptographically verifiable
- Platform-independent

### Verifiable Credentials
- Tamper-evident credentials
- Cryptographic proofs
- Selective disclosure
- Privacy-preserving

---

## DID Structure

```
did:pocketone:abc123def456
│   │         │
│   │         └─ Identifier
│   └─────────── Method
└─────────────── Scheme
```

### DID Document

```json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:pocketone:abc123",
  "verificationMethod": [{
    "id": "did:pocketone:abc123#keys-1",
    "type": "JsonWebKey2020",
    "controller": "did:pocketone:abc123",
    "publicKeyJwk": { ... }
  }],
  "authentication": ["did:pocketone:abc123#keys-1"]
}
```

---

## Verifiable Credential Structure

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://pocketone.io/credentials/v1"
  ],
  "id": "urn:uuid:12345",
  "type": ["VerifiableCredential", "IdentityCredential"],
  "issuer": "did:pocketone:issuer123",
  "issuanceDate": "2024-01-16T00:00:00Z",
  "credentialSubject": {
    "id": "did:pocketone:holder456",
    "familyName": "Hoffmeister",
    "givenName": "Anna"
  },
  "proof": {
    "type": "JsonWebSignature2020",
    "created": "2024-01-16T00:00:00Z",
    "proofPurpose": "assertionMethod",
    "verificationMethod": "did:pocketone:issuer123#keys-1",
    "jws": "eyJhbG..."
  }
}
```

---

## Implementation in myID.africa

### Generate DID
```typescript
const publicKey = await generateKeyPair();
const did = W3CDID.generate(publicKey);
// Result: "did:pocketone:abc123..."
```

### Create DID Document
```typescript
const didDocument = W3CDID.createDIDDocument(did, publicKey);
```

### Issue Credential
```typescript
const credential = W3CDID.createCredential(
  issuerDID,
  subjectDID,
  {
    familyName: 'Hoffmeister',
    givenName: 'Anna',
    nationality: 'DEU',
    masterCode: mc,
    trustCode: tc
  },
  'IdentityCredential'
);
```

---

## Verifiable Presentations

### Purpose
- Present one or more credentials
- Prove control of DID
- Respond to verification requests

### Creation
```typescript
const presentation = W3CDID.createPresentation(
  holderDID,
  [credential1, credential2],
  challenge,
  domain
);
```

---

## Selective Disclosure

Share only required attributes:

```typescript
const selective = W3CDID.createSelectiveDisclosure(
  credential,
  ['familyName', 'nationality'] // Only these fields
);
```

---

## pocketOne DID Method

### Method Specification

**Method Name**: `pocketone`

**Method-Specific ID**: BLAKE3 hash of public key (first 32 characters)

**DID Format**: `did:pocketone:{id}`

### Resolution
```typescript
const didDocument = await W3CDID.resolveDID(did);
```

### Security
- Master Code (MC) binding
- Trust Code (TC) verification
- HSM-backed key operations

---

## Integration Points

### 1. Identity Proofing
```
User → Verify Identity → Issue VC → Store in Wallet
```

### 2. Authentication
```
User → Present VP → Verify Proof → Grant Access
```

### 3. Authorization
```
Relying Party → Request Claims → User Consents → Present VC
```

---

## Trust Triangle

```
        Issuer
       /      \
      /        \
    VC          Trust
    /            \
   /              \
Holder ----→---- Verifier
     Presents VP
```

---

## Privacy Features

### 1. Unlinkability
- Different DIDs for different contexts
- No correlation between presentations

### 2. Minimal Disclosure
- Share only required attributes
- Hash-based selective disclosure (non-ZKP) for predicates

### 3. Holder Binding
- Cryptographic proof of DID control
- Prevents credential theft

---

## Credential Types in myID.africa

| Type | Description | Use Case |
|------|-------------|----------|
| IdentityCredential | Core identity data | Government services |
| AgeCredential | Age verification | Age-restricted content |
| AddressCredential | Proof of address | Banking, shipping |
| EducationCredential | Qualifications | Employment |
| HealthCredential | Medical records | Healthcare |

---

## Verification Process

```typescript
// Verify credential
const isValid = await W3CDID.verifyCredential(credential);

// Verify presentation
const isPresentationValid = await W3CDID.verifyPresentation(
  presentation,
  challenge
);
```

### Verification Steps
1. Check credential expiration
2. Resolve issuer DID
3. Verify proof signature
4. Validate credential status
5. Check revocation status

---

## Revocation

### Status List 2021
```json
{
  "credentialStatus": {
    "id": "https://myid.africa/status/1#0",
    "type": "StatusList2021Entry",
    "statusPurpose": "revocation",
    "statusListIndex": "0",
    "statusListCredential": "https://myid.africa/status/1"
  }
}
```

---

## Compliance

- ✅ W3C DID Core v1.0
- ✅ W3C Verifiable Credentials v1.1
- ✅ JSON-LD 1.1
- ✅ DID Resolution v0.3
- ✅ OpenID Connect for VCs

---

## Code Example

```typescript
import { W3CDID } from '@/lib/credentials/w3c-did';

// Generate DID
const did = W3CDID.generate(publicKey);

// Create credential
const vc = W3CDID.createCredential(
  issuerDID,
  holderDID,
  { familyName: 'Hoffmeister', givenName: 'Anna' },
  'IdentityCredential'
);

// Create presentation
const vp = W3CDID.createPresentation(
  holderDID,
  [vc],
  challenge,
  'myid.africa'
);

// Verify
const isValid = await W3CDID.verifyPresentation(vp, challenge);
```

---

## Resources

- [W3C DID Core](https://www.w3.org/TR/did-core/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [myID.africa DID Implementation](../lib/credentials/w3c-did.ts)
- [DID Method Registry](https://w3c.github.io/did-spec-registries/)
