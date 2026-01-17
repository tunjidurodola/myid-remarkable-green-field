# myID.africa Security Architecture

This document describes the security model and cryptographic primitives used in myID.africa PWA.

## Table of Contents

1. [PII Storage in PWA](#pii-storage-in-pwa)
2. [BLAKE3 Selective Disclosure](#blake3-selective-disclosure)
3. [MasterCode and TrustCode](#mastercode-and-trustcode)
4. [Cryptographic Primitives](#cryptographic-primitives)

---

## PII Storage in PWA

### Storage Layer

The PWA uses **IndexedDB** as the primary storage mechanism with **localStorage** as a fallback. All personally identifiable information (PII) is encrypted at rest.

**Implementation**: `lib/storage/encrypted-storage.ts`

### Data Stores

The following data stores contain encrypted PII:

1. **userData**
   - User profile information (name, phone, email, etc.)
   - Birth date, address, government-issued IDs
   - Stored as encrypted JSON strings

2. **credentials**
   - Verifiable credentials (mDL, eIDAS2, W3C VCs)
   - Indexed by credential format
   - Includes issuance and expiration timestamps

3. **consentHistory**
   - Record of disclosure consents given to relying parties
   - Includes rpId, claims disclosed, and UCT (User Consent Token)
   - Indexed by rpId and timestamp

4. **otpSecrets**
   - Time-based OTP secrets for 2FA
   - Encrypted using session encryption key

5. **passkeys**
   - WebAuthn credential metadata
   - Public keys, counter values, device information
   - Not encrypted (public data only)

6. **sessions**
   - Session metadata and tokens
   - Encryption keys, access tokens, refresh tokens
   - Indexed by userId and expiration time

### Encryption Method

**Current Implementation**: XOR-based encryption (demo/development mode)

```javascript
encrypt(data, key) → base64(xor(data, key))
decrypt(data, key) → xor(base64_decode(data), key)
```

**Production Requirement**: Web Crypto API with AES-GCM

- Algorithm: AES-GCM-256
- Key derivation: PBKDF2 or session-derived key material
- IV: Randomly generated per encryption operation

### Session Management

Sessions are ephemeral and bound to device:

- **Default duration**: 24 hours
- **Extended duration**: 30 days (remember me)
- **Activity timeout**: 30 minutes of inactivity
- **Storage**: Session ID in sessionStorage, session data in IndexedDB/localStorage

### Data Lifecycle

- **Creation**: Encrypted on write with session-derived key
- **Access**: Decrypted on read using session encryption key
- **Deletion**: Complete wipe on logout via `clearAll()`
- **Expiry**: Automatic cleanup of expired sessions

### Security Properties

- ✓ PII never transmitted unencrypted
- ✓ Encryption keys never leave browser memory
- ✓ Session-scoped encryption prevents cross-session data access
- ✓ No PII in cookies or sessionStorage (only session ID)
- ⚠ Current XOR encryption is placeholder - production must use AES-GCM

---

## BLAKE3 Selective Disclosure

### Overview

myID.africa uses **BLAKE3 cryptographic hashing** for privacy-preserving selective disclosure of identity claims. This allows users to prove possession of claims without revealing unnecessary information.

**Implementation**: `backend/lib/selective-disclosure.mjs`

### Architecture

#### 1. Claim Commitments

Each claim is committed using BLAKE3:

```
commitment = BLAKE3(claimType || ":" || claimValue || ":" || salt)
```

- **claimType**: Claim identifier (e.g., "given_name", "birth_date")
- **claimValue**: Actual claim value (serialized as JSON if object)
- **salt**: Cryptographically random 16-byte value unique to this claim

**Properties**:
- Deterministic: Same input produces same commitment
- Collision-resistant: Infeasible to find two inputs with same hash
- Pre-image resistant: Cannot derive original value from commitment
- Salt ensures unlinkability between presentations

#### 2. Merkle Tree Construction

Claims are organized into a Merkle tree for efficient verification:

```
leafHash = BLAKE3("leaf:" || commitment)
nodeHash = BLAKE3("node:" || sort(child1, child2))
```

- Leaves are ordered deterministically (sorted by claimType)
- Parent nodes combine sorted child hashes
- Root hash represents entire credential

#### 3. Selective Disclosure Process

**Credential Issuance**:
1. Issuer creates commitments for all claims
2. Builds Merkle tree from commitments
3. Signs the Merkle root
4. Issues credential with commitments and tree structure

**Presentation Creation**:
1. User selects which claims to reveal
2. For each revealed claim:
   - Include claim value and salt
   - Generate Merkle proof (path from leaf to root)
3. Presentation contains only revealed claims + proofs

**Verification**:
1. Verifier receives presentation with partial claims
2. For each claim:
   - Recompute commitment from (claimType, value, salt)
   - Verify Merkle proof against root hash
3. Verify root hash signature from issuer

### Predicate Proofs

Users can prove statements about claims without revealing values:

#### Age Over Proof
```javascript
proof = BLAKE3("age_over:" || threshold || ":" || result || ":" || nonce)
```

Proves age ≥ threshold without revealing birth date.

#### Range Proof
```javascript
proof = BLAKE3("range:" || claimType || ":" || min || ":" || max || ":" || result || ":" || nonce)
```

Proves value is within [min, max] without revealing exact value.

#### Membership Proof
```javascript
proof = BLAKE3("membership:" || claimType || ":" || hash(allowedValues) || ":" || result || ":" || nonce)
```

Proves value is in allowed set without revealing which one.

### Security Properties

- ✓ **Unlinkability**: Unique salts prevent correlation between presentations
- ✓ **Minimal disclosure**: Only requested claims revealed
- ✓ **Non-interactive**: Proofs verified without issuer interaction
- ✓ **Quantum-resistant**: BLAKE3 provides 256-bit security level
- ✓ **Efficient verification**: O(log n) proof size for n claims

### BLAKE3 Specifications

- **Output size**: 256 bits (32 bytes) default
- **Output size (compatibility)**: 160 bits (20 bytes) for BLAKE3-160
- **Performance**: ~1 GB/s on typical hardware
- **Library**: `@noble/hashes/blake3` (audited implementation)

---

## MasterCode and TrustCode

### Overview

**MasterCode (MC)** and **TrustCode (TC)** are cryptographically-bound identity tokens using the pocketOne OID namespace.

**Implementation**:
- MasterCode: `backend/routes/mastercode.mjs`
- TrustCode: `backend/routes/trustcode.mjs`

### pocketOne OID Namespace

```
OID_BASE:     1.3.6.1.4.1.64273
CLAIM_ROOT:   1.3.6.1.4.1.64273.5
MASTER_CODE:  1.3.6.1.4.1.64273.5.1824
TRUST_CODE:   1.3.6.1.4.1.64273.5.1825
```

**OID Allocation**:
- `1.3.6.1.4.1.64273`: pocketOne enterprise number (IANA-assigned)
- `.5`: Identity namespace
- `.1824`: MasterCode claim type
- `.1825`: TrustCode claim type

### MasterCode (MC)

#### Format
```
XXXX-XXXX-XXXX-XXXX
```

- 16 characters (4 segments of 4)
- Character set: `[A-Z2-9]` excluding confusing chars (0, O, 1, I)
- Example: `A7K9-PQ3M-8FVW-2R4X`

#### Generation

```javascript
// 1. Generate cryptographically random bytes
randomBytes = crypto.randomBytes(16)

// 2. Map to character set
for each byte:
  char = CHARSET[byte % 32]

// 3. Format as XXXX-XXXX-XXXX-XXXX
```

#### BLAKE3 Commitment

```
mc_hash = BLAKE3(mastercode)
mc_hash_160 = BLAKE3-160(mastercode)  // For compatibility
```

- Full hash: 64 hex characters (256 bits)
- Truncated hash: 40 hex characters (160 bits)

#### Properties

- Unique per user (1:1 mapping)
- Permanent (never expires)
- Transferable (can be reassigned if user loses access)
- Usable as claim in verifiable credentials

### TrustCode (TC)

#### Format
```
XXXXXXXXX
```

- 9 characters (no dashes)
- Character set: `[A-Z2-9]` excluding confusing chars
- Example: `K7M9PQ3F8`

#### Generation

TrustCodes are **derived** from MasterCodes using BLAKE3:

```javascript
input = mastercode || ":" || purpose || ":" || timestamp
hash = BLAKE3(input)

// Map first 9 bytes to character set
for i in 0..8:
  trustcode[i] = CHARSET[hash[i] % 32]
```

**Derivation Parameters**:
- `mastercode`: Parent MasterCode (e.g., "A7K9-PQ3M-8FVW-2R4X")
- `purpose`: Purpose identifier (e.g., "general", "employment", "healthcare")
- `timestamp`: Unix timestamp (ensures uniqueness)

#### Properties

- Many TrustCodes per MasterCode (1:N relationship)
- Purpose-specific (different purpose → different TC)
- Time-bound (can have expiration)
- Cryptographically linked to parent MC

### Usage as Claims

Both MC and TC are embedded as claims in verifiable credentials:

```json
{
  "credentialSubject": {
    "id": "did:pocketone:...",
    "claims": {
      "1.3.6.1.4.1.64273.5.1824": "A7K9-PQ3M-8FVW-2R4X",  // MC
      "1.3.6.1.4.1.64273.5.1825": "K7M9PQ3F8",             // TC
      "given_name": { "value": "...", "salt": "..." },
      "family_name": { "value": "...", "salt": "..." }
    }
  }
}
```

### Selective Disclosure with MC/TC

MC and TC commitments participate in the Merkle tree:

```
// MasterCode commitment
mc_commitment = BLAKE3("1.3.6.1.4.1.64273.5.1824:A7K9-PQ3M-8FVW-2R4X:salt1")

// TrustCode commitment
tc_commitment = BLAKE3("1.3.6.1.4.1.64273.5.1825:K7M9PQ3F8:salt2")

// Both included as leaves in Merkle tree
merkleRoot = buildTree([mc_commitment, tc_commitment, ...other_claims])
```

Users can selectively disclose MC/TC:
- Reveal MC only (proves identity root)
- Reveal TC only (proves purpose-specific authorization)
- Reveal both (proves full lineage)
- Reveal neither (prove other claims only)

### Security Properties

- ✓ **Cryptographic binding**: TC provably derived from MC
- ✓ **Privacy-preserving**: Can reveal TC without exposing MC
- ✓ **Purpose separation**: Different purposes yield different TCs
- ✓ **Auditability**: All MC/TC issuance logged in database
- ✓ **Revocability**: Both MC and TC can be revoked independently
- ✓ **OID standardization**: Globally unique claim identifiers

---

## Cryptographic Primitives

### Hash Functions

- **BLAKE3**: Primary hash function
  - 256-bit output (default)
  - 160-bit output (compatibility mode)
  - Library: `@noble/hashes/blake3`

### Encryption

- **Current (Development)**: XOR-based encryption
- **Required (Production)**: AES-GCM-256 via Web Crypto API

### Random Number Generation

- **Client-side**: `crypto.randomUUID()`, Web Crypto API
- **Server-side**: `crypto.randomBytes()` from Node.js

### Digital Signatures

- **HSM-backed**: PKCS#11 interface to Utimaco HSM
- **Algorithms**: RSA-PSS, ECDSA (P-256, P-384)
- **Certificates**: pocketOne_CA (slot 0, label pocketOne_CA)

### Key Management

- **Session Keys**: Derived from authentication, stored in-memory only
- **HSM Keys**: Stored in hardware security module, never exported
- **Salts**: Random per-claim, 16 bytes minimum
- **Nonces**: Random per-operation, 16 bytes minimum

---

## Compliance & Standards

### Frameworks Supported

- **ISO 18013-5**: Mobile Driving License (mDL)
- **eIDAS 2.0**: European Digital Identity Wallet
- **W3C Verifiable Credentials**: DID-based identity
- **ICAO DTC**: Digital Travel Credential

### Audit Trail

All security-relevant operations are logged:
- MC/TC issuance and revocation
- Credential issuance
- Disclosure consent (with UCT)
- HSM signing operations
- Authentication events

**Logs are stored in**:
- PostgreSQL database (structured audit log)
- PM2 process logs (application logs)
- HSM audit logs (hardware-level)

---

## Threat Model

### Mitigated Risks

- ✓ Credential theft: Encrypted storage, session-scoped keys
- ✓ Replay attacks: Nonces, timestamps, UCT
- ✓ Correlation tracking: Unlinkable presentations via unique salts
- ✓ Over-disclosure: Selective disclosure, predicate proofs
- ✓ MITM: TLS for all network communication
- ✓ Phishing: WebAuthn passkey authentication

### Residual Risks

- ⚠ Browser compromise: If attacker gains access to browser runtime, encryption keys in memory are exposed
- ⚠ HSM compromise: Physical access to HSM could allow key extraction (mitigated by PIN and audit logs)
- ⚠ Database breach: MC/TC hashes in database could be analyzed (mitigated by salting)

### Recommendations

1. Migrate from XOR to AES-GCM for production PII encryption
2. Implement key rotation for session encryption keys
3. Add hardware security key support for high-value operations
4. Implement remote attestation for credential issuance
5. Add rate limiting for MC/TC generation endpoints

---

## References

- BLAKE3: https://github.com/BLAKE3-team/BLAKE3
- Selective Disclosure JWT: https://datatracker.ietf.org/doc/draft-ietf-oauth-selective-disclosure-jwt/
- ISO 18013-5: Mobile Driving License
- eIDAS 2.0: European Digital Identity Regulation
- W3C Verifiable Credentials: https://www.w3.org/TR/vc-data-model/
- pocketOne OID namespace: 1.3.6.1.4.1.64273
