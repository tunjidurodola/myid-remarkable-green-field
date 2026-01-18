# myID.africa Compliance Review

**Review Date**: 2026-01-17
**Reviewer**: Agent2 (Code Review)
**Status**: ⚠️ BLOCKING ISSUES FOUND

---

## Executive Summary

This document provides a compliance assessment of the myID.africa PWA implementation against ISO 18013-5 (mDL), eIDAS2, ICAO DTC, and W3C DID/VC standards.

**Overall Assessment**: **NO-GO for client demo**

Critical issues identified:
- Missing signature verification in all credential formats
- No device binding implementation (ISO 18013-5 requirement)
- Incomplete CBOR encoding (custom implementation, not spec-compliant)
- No unit tests for any credential implementation
- Hardcoded secrets in configuration files
- Missing session transcript handling (ISO 18013-5 requirement)

---

## Compliance Matrix

### ISO 18013-5 (Mobile Driving License)

| Feature / Requirement | Standard Clause | Files | API Routes | Tests | Status |
|----------------------|-----------------|-------|------------|-------|--------|
| **Data Model** |
| Mandatory data elements | 7.2.3 | `lib/credentials/mdl-iso18013-5.ts`<br>`backend/lib/mdl.mjs` | None | ❌ None | ⚠️ Partial |
| Optional data elements | 7.2.4 | `backend/lib/mdl.mjs` (MDL_DATA_ELEMENTS) | None | ❌ None | ✅ Complete |
| Namespace structure | 7.2.1 | `backend/lib/mdl.mjs` (MDL_NAMESPACES) | None | ❌ None | ✅ Complete |
| CBOR encoding | 7.2.2 | `backend/lib/mdl.mjs` (CBOREncoder) | None | ❌ None | ❌ **CRITICAL: Custom implementation** |
| **Device Engagement** |
| QR code generation | 8.3.2.1 | `backend/lib/mdl.mjs` (DeviceEngagement) | None | ❌ None | ⚠️ Partial |
| Device key pair | 8.3.2.1.1 | `backend/lib/mdl.mjs:366` (generateDeviceKey) | None | ❌ None | ⚠️ Partial |
| Session establishment | 8.3.2.2 | `backend/lib/mdl.mjs` (SessionEncryption) | None | ❌ None | ❌ **CRITICAL: No session transcript** |
| **Cryptography** |
| Session key derivation | 9.1.1.4 | `backend/lib/mdl.mjs:416` (deriveSessionKeys) | None | ❌ None | ❌ **CRITICAL: Non-compliant HKDF** |
| Data encryption (AES-256-GCM) | 9.1.1.5 | `backend/lib/mdl.mjs:438` (encrypt) | None | ❌ None | ✅ Correct |
| **Signature Verification** |
| IssuerAuth structure | 9.1.2.4 | `lib/credentials/mdl-iso18013-5.ts:88` | None | ❌ None | ❌ **CRITICAL: Placeholder only** |
| IssuerAuth verification | 9.1.2.4 | `lib/credentials/mdl-iso18013-5.ts:144` | None | ❌ None | ❌ **CRITICAL: Stub implementation** |
| DeviceAuth (device signature) | 9.1.3 | Not implemented | None | ❌ None | ❌ **MISSING** |
| **Selective Disclosure** |
| Data element disclosure | 8.3.3.1.2 | `backend/lib/mdl.mjs:690` (createResponse) | None | ❌ None | ⚠️ Partial |
| Age-over proofs | Annex A | `lib/credentials/mdl-iso18013-5.ts:152`<br>`backend/lib/mdl.mjs:734` | None | ❌ None | ❌ **CRITICAL: Hash-based only (non-privacy-preserving)** |
| **Reader Authentication** |
| Reader authentication | 9.1.4 | Not implemented | None | ❌ None | ❌ **MISSING** |
| Certificate verification | 9.1.4.2 | Not implemented | None | ❌ None | ❌ **MISSING** |

**ISO 18013-5 Critical Gaps:**
1. ❌ CBOR encoding uses custom implementation instead of ISO-compliant library
2. ❌ No actual signature verification (stub returns `!!signature && !!certificate`)
3. ❌ Device binding not implemented
4. ❌ Session transcript not maintained
5. ❌ Age-over proofs are hash-based only (just hashes birth date with result, non-privacy-preserving)
6. ❌ Reader authentication completely missing
7. ❌ No session encryption key derivation tests

---

### eIDAS 2.0 (European Digital Identity)

| Feature / Requirement | Standard Clause | Files | API Routes | Tests | Status |
|----------------------|-----------------|-------|------------|-------|--------|
| **PID Credential** |
| Mandatory attributes | ARF 4.2.1 | `lib/credentials/eidas2.ts`<br>`backend/lib/eidas2.mjs` | None | ❌ None | ✅ Complete |
| Optional attributes | ARF 4.2.2 | `backend/lib/eidas2.mjs:119-152` | None | ❌ None | ✅ Complete |
| Age verification predicates | ARF 4.3 | `backend/lib/eidas2.mjs:220-243` | None | ❌ None | ✅ Complete |
| **Issuance & Verification Separation** |
| Issuer/Verifier role separation | ARF 6.2 | Mixed in routes | `/api/credentials` | ❌ None | ⚠️ **ISSUE: Not separated** |
| Qualified Trust Service Provider | eIDAS Art. 3(19) | Not implemented | None | ❌ None | ❌ **MISSING** |
| **Cryptography** |
| JWS signature (JsonWebSignature2020) | ARF 6.3.1 | `lib/credentials/eidas2.ts:104-110` | None | ❌ None | ❌ **CRITICAL: Placeholder only** |
| Signature verification | ARF 6.3.2 | `lib/credentials/eidas2.ts:157` | None | ❌ None | ❌ **CRITICAL: Stub implementation** |
| **Selective Disclosure** |
| SD-JWT format | ARF 6.4 | `lib/credentials/eidas2.ts:176-198` | None | ❌ None | ❌ **CRITICAL: JSON filtering only** |
| Hash-based disclosure | ARF 6.4.1 | Not implemented | None | ❌ None | ❌ **MISSING** |
| **Auditability** |
| Credential status | ARF 6.5 | Not implemented | None | ❌ None | ❌ **MISSING** |
| Revocation registry | ARF 6.5.2 | Not implemented | None | ❌ None | ❌ **MISSING** |
| Audit logs | ARF 7.2 | Partial in consent | `/api/consent` | ❌ None | ⚠️ Partial |
| **Crypto Hygiene** |
| Key generation (P-256/P-384) | ARF 6.3.3 | Not checked | HSM-based | ❌ None | ⚠️ Unknown |
| Key storage (HSM/secure element) | ARF 6.3.4 | `backend/lib/hsm-signer.mjs` | None | ❌ None | ⚠️ Not validated |
| Algorithm restrictions | ARF 6.3.5 | Mixed (ES256 vs SHA256) | None | ❌ None | ❌ **ISSUE: Inconsistent** |

**eIDAS2 Critical Gaps:**
1. ❌ No actual JWS signature implementation
2. ❌ Selective disclosure uses JSON field filtering, not SD-JWT
3. ❌ No credential revocation mechanism
4. ❌ Issuer/Verifier roles not properly separated in code
5. ❌ No qualified trust service provider integration
6. ⚠️ Crypto hygiene: Mix of SHA-256 and BLAKE3 (inconsistent)
7. ❌ No auditability beyond consent records

---

### ICAO 9303 DTC (Digital Travel Credential)

| Feature / Requirement | Standard Clause | Files | API Routes | Tests | Status |
|----------------------|-----------------|-------|------------|-------|--------|
| **Data Model** |
| Logical Data Structure (LDS) | Part 10, 4.1 | `lib/credentials/icao-dtc.ts` | None | ❌ None | ⚠️ Partial |
| Data Group 1 (MRZ) | Part 10, 4.6.1 | `lib/credentials/icao-dtc.ts:160-180` | None | ❌ None | ⚠️ Partial |
| Data Group 2 (Facial image) | Part 10, 4.6.2 | `lib/credentials/icao-dtc.ts:120-125` | None | ❌ None | ⚠️ Partial |
| Data Groups 3-16 | Part 10, 4.6 | `lib/credentials/icao-dtc.ts:32-43` | None | ❌ None | ⚠️ Partial |
| **Security Object (SOD)** |
| Hash algorithm | Part 10, 5.3.1 | `lib/credentials/icao-dtc.ts:104` | None | ❌ None | ❌ **ISSUE: Uses SHA256, not BLAKE3** |
| Data group hashing | Part 10, 5.3.2 | `lib/credentials/icao-dtc.ts:136-138` | None | ❌ None | ⚠️ Partial |
| SOD signature | Part 10, 5.3.3 | `lib/credentials/icao-dtc.ts:108` | None | ❌ None | ❌ **CRITICAL: Placeholder only** |
| **Signature Verification** |
| SOD verification | Part 10, 5.4 | `lib/credentials/icao-dtc.ts:185-196` | None | ❌ None | ❌ **CRITICAL: Stub implementation** |
| Certificate chain validation | Part 12, 7 | Not implemented | None | ❌ None | ❌ **MISSING** |
| **Active Authentication** |
| AA protocol | Part 11, 6 | `lib/credentials/icao-dtc.ts:202-211` | None | ❌ None | ❌ **CRITICAL: Mock implementation** |
| AA public key (DG15) | Part 10, 4.6.15 | Not implemented | None | ❌ None | ❌ **MISSING** |
| **Chip Authentication** |
| CA protocol | Part 11, 7 | Not implemented | None | ❌ None | ❌ **MISSING** |
| **Passive Authentication** |
| PA verification flow | Part 11, 5 | Partial in `verify()` | None | ❌ None | ⚠️ Partial |

**ICAO DTC Critical Gaps:**
1. ❌ Uses SHA-256 instead of BLAKE3 (inconsistent with project architecture)
2. ❌ No actual signature verification boundary
3. ❌ Active Authentication is mock (not real chip-based)
4. ❌ Chip Authentication completely missing
5. ❌ No certificate chain validation
6. ❌ Data model alignment incomplete (only DG1, DG2, DG7 implemented)
7. ❌ MRZ generation oversimplified (no check digits)

---

### W3C DID/VC (Decentralized Identifiers & Verifiable Credentials)

| Feature / Requirement | Standard Clause | Files | API Routes | Tests | Status |
|----------------------|-----------------|-------|------------|-------|--------|
| **DID Methods** |
| DID:pocketone method | Custom | `lib/credentials/w3c-did.ts:79` | None | ❌ None | ⚠️ Partial |
| DID Document structure | W3C DID Core 5.1 | `lib/credentials/w3c-did.ts:87-111` | None | ❌ None | ✅ Complete |
| DID Resolution | W3C DID Core 8 | `lib/credentials/w3c-did.ts:250-263` | None | ❌ None | ❌ **CRITICAL: Mock implementation** |
| **Verifiable Credentials** |
| VC Data Model | W3C VC 4.1 | `lib/credentials/w3c-did.ts:116-147` | None | ❌ None | ✅ Complete |
| Credential types | W3C VC 4.3 | `lib/credentials/w3c-did.ts:132` | None | ❌ None | ✅ Complete |
| Credential subjects | W3C VC 4.4 | `lib/credentials/w3c-did.ts:136-140` | None | ❌ None | ✅ Complete |
| **Verification** |
| Proof format (JWS) | W3C VC 5.1 | `lib/credentials/w3c-did.ts:140-146` | None | ❌ None | ❌ **CRITICAL: Placeholder only** |
| Proof verification | W3C VC 5.3 | `lib/credentials/w3c-did.ts:181-197` | None | ❌ None | ❌ **CRITICAL: Stub implementation** |
| Status checking | W3C VC 4.9 | Not implemented | None | ❌ None | ❌ **MISSING** |
| **Presentations** |
| VP Data Model | W3C VC 6 | `lib/credentials/w3c-did.ts:152-176` | None | ❌ None | ✅ Complete |
| Challenge-response | W3C VC 6.2 | `lib/credentials/w3c-did.ts:156, 206-209` | None | ❌ None | ⚠️ Partial |
| VP verification | W3C VC 6.3 | `lib/credentials/w3c-did.ts:202-221` | None | ❌ None | ❌ **CRITICAL: Stub implementation** |
| **Selective Disclosure** |
| SD-JWT VC | W3C VC 2.0 | `lib/credentials/w3c-did.ts:226-245` | None | ❌ None | ❌ **CRITICAL: JSON filtering only** |
| Privacy-preserving predicates | Extension | Not implemented | None | ❌ None | ❌ **MISSING** |

**W3C DID/VC Critical Gaps:**
1. ❌ DID resolution is mock (returns empty document)
2. ❌ No actual proof signing or verification
3. ❌ Selective disclosure uses JSON field filtering, not SD-JWT or BBS+
4. ❌ No credential status/revocation registry
5. ❌ No DID registry or resolver implementation
6. ❌ Challenge verification incomplete
7. ❌ No privacy-preserving predicate proof support

---

## Test Coverage Analysis

### Current State
- **E2E Tests**: 1 file (`tests/e2e/routes.spec.ts`) - Playwright route navigation only
- **Unit Tests**: ❌ **ZERO** unit tests for any credential implementation
- **Integration Tests**: ❌ None
- **Smoke Tests**: ✅ Basic health checks only (`scripts/smoke.mjs`)

### Required Tests (Missing)

#### ISO 18013-5
- ❌ CBOR encoding/decoding round-trip
- ❌ Device engagement QR code generation/parsing
- ❌ Session key derivation (ECDH + HKDF)
- ❌ Selective disclosure with valid/invalid requests
- ❌ IssuerAuth signature verification
- ❌ DeviceAuth signature verification
- ❌ Age-over proof generation and verification

#### eIDAS2
- ❌ PID credential creation and validation
- ❌ JWS signature creation and verification
- ❌ Country-specific claim mapping
- ❌ Age predicate computation
- ❌ Selective disclosure of PID attributes
- ❌ CBOR structure serialization

#### ICAO DTC
- ❌ MRZ generation with check digits
- ❌ Data group hashing
- ❌ SOD signature verification
- ❌ Active Authentication protocol
- ❌ Certificate chain validation

#### W3C DID/VC
- ❌ DID generation from public key
- ❌ DID Document creation
- ❌ VC issuance and verification
- ❌ VP creation and verification
- ❌ Challenge-response flow
- ❌ Selective disclosure

---

## Security Scan Results

### Hardcoded Secrets Found

**CRITICAL SECURITY ISSUE** ❌

Location: `ecosystem.config.cjs`

```javascript
JWT_SECRET: 'myid-jwt-secret-key-change-in-production-2026'
API_KEY: 'myid-api-key-dev-2026'
```

**Impact**: Development secrets committed to version control
**Risk Level**: HIGH
**Remediation**:
1. Move to environment variables (`.env` files)
2. Add `.env` to `.gitignore`
3. Rotate both secrets immediately
4. Update `docs/SECURITY.md` to document secret management

### Dependency Vulnerabilities

**High Severity** (3):
- `glob` (v10.2.0 - 10.4.5): Command injection via CLI (GHSA-5j98-mcp5-4vw2)
  - CVE Score: 7.5/10
  - Via: `@next/eslint-plugin-next`
  - Fix: Upgrade `eslint-config-next` to 16.1.3

**Low Severity** (1):
- `pm2` (≤6.0.14): Regular Expression DoS (GHSA-x5gf-qvw8-r2rm)
  - CVE Score: 4.3/10
  - Direct dependency
  - Fix: Monitor for updates

**Recommended Actions**:
1. ✅ **IMMEDIATE**: Upgrade `eslint-config-next` to 16.1.3
2. ⚠️ **MONITOR**: pm2 vulnerability is low severity but should be tracked

---

## Crypto Hygiene Issues

### Algorithm Inconsistencies

**ISSUE**: Mixed use of SHA-256 and BLAKE3

1. **BLAKE3** (correct, project standard):
   - `backend/lib/selective-disclosure.mjs` ✅
   - `lib/crypto/blake3.ts` ✅
   - MasterCode/TrustCode generation ✅

2. **SHA-256** (inconsistent):
   - `lib/credentials/icao-dtc.ts:104` (SOD hash) ❌
   - `backend/lib/eidas2.mjs:157` (personal identifier) ❌
   - `backend/lib/eidas2.mjs:196` (masterCodeHash) ❌

**Recommendation**: Standardize on BLAKE3 throughout, or document exceptions with rationale.

### Key Derivation Issues

1. **Weak KDF** in `lib/crypto/blake3.ts:239-245`:
   ```typescript
   static deriveKey(password: string, salt: string, iterations: number = 10000): string {
     let key = this.hash(`${salt}:${password}`);
     for (let i = 0; i < iterations; i++) {
       key = this.hash(`${key}:${i}`);
     }
     return key;
   }
   ```
   **Issue**: Not cryptographically sound. Should use PBKDF2, Argon2, or scrypt.
   **Location**: `lib/crypto/blake3.ts:239`

2. **Incorrect HKDF** in `backend/lib/mdl.mjs:416-432`:
   ```javascript
   const prk = crypto.createHmac('sha256', salt).update(sharedSecret).digest();
   const sessionKey = crypto.createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest();
   ```
   **Issue**: Not compliant with ISO 18013-5 session key derivation spec.
   **Location**: `backend/lib/mdl.mjs:423-427`

### Missing Cryptographic Protections

- ❌ No nonce/timestamp replay protection in API endpoints
- ❌ No rate limiting on MasterCode/TrustCode generation
- ❌ No HSM connection verification (assumes HSM available)
- ❌ No certificate pinning for external API calls

---

## API Route Coverage

### Implemented Routes

| Route | Method | Auth | Purpose | Tests |
|-------|--------|------|---------|-------|
| `/api/health` | GET | None | Health check | ✅ Smoke test |
| `/health` | GET | None | Health check (alt) | ✅ Smoke test |
| `/api/auth/*` | POST | None/JWT | Authentication | ❌ None |
| `/api/user/profile` | GET | JWT | User profile | ❌ None |
| `/api/mastercode/*` | POST | API Key | MC generation | ❌ None |
| `/api/trustcode/*` | POST | JWT | TC issuance | ❌ None |
| `/api/mdl/*` | POST | JWT | mDL operations | ❌ None |
| `/api/consent/*` | POST | JWT | Consent management | ❌ None |
| `/api/credentials/*` | GET/POST | JWT | Credential CRUD | ❌ None |
| `/api/qes/*` | POST | JWT | QES operations | ❌ None |

### Missing Routes (Required for Standards)

- ❌ `/api/credentials/revoke` - Credential revocation (eIDAS2, W3C VC)
- ❌ `/api/credentials/status` - Credential status check (W3C VC)
- ❌ `/api/did/resolve/:did` - DID resolution (W3C DID)
- ❌ `/api/mdl/device-engagement` - Device engagement generation (ISO 18013-5)
- ❌ `/api/mdl/session/:sessionId` - Session management (ISO 18013-5)
- ❌ `/api/presentation/request` - Presentation request (all standards)
- ❌ `/api/presentation/verify` - Presentation verification (all standards)

---

## Recommendations

### CRITICAL (Must Fix Before Demo)

1. **Implement Actual Signature Verification**
   - Files: All credential implementations
   - Add HSM-backed signing and verification
   - Add certificate chain validation

2. **Replace Custom CBOR Encoder**
   - File: `backend/lib/mdl.mjs`
   - Use `cbor2` or `cbor-x` npm package
   - Remove lines 67-323 (CBOREncoder class)

3. **Remove Hardcoded Secrets**
   - File: `ecosystem.config.cjs`
   - Move to environment variables
   - Rotate exposed secrets

4. **Add Unit Tests**
   - Minimum: One test file per credential type
   - Cover signature verification, encoding/decoding, validation

5. **Fix Age-Over Proofs**
   - Files: `lib/credentials/mdl-iso18013-5.ts:152`, `backend/lib/selective-disclosure.mjs:462-487`
   - Current implementation just hashes birth date + result (non-privacy-preserving)
   - Either document as hash-based only or implement privacy-preserving predicates

### HIGH PRIORITY (Needed for Production)

6. **Implement Device Binding** (ISO 18013-5)
   - Add DeviceAuth signatures
   - Implement session transcript
   - Add reader authentication

7. **Implement Credential Revocation**
   - Add status list 2021 support (W3C VC)
   - Add revocation endpoints
   - Add status checking in verification

8. **Separate Issuer/Verifier Roles** (eIDAS2)
   - Split credential issuance and verification logic
   - Different API keys/permissions
   - Audit trail separation

9. **Standardize Hash Algorithm**
   - Choose: BLAKE3 everywhere OR document SHA-256 exceptions
   - Update ICAO DTC to use BLAKE3
   - Update eIDAS2 identifier generation

10. **Fix Key Derivation**
    - Replace custom KDF with Argon2/PBKDF2
    - Fix HKDF in session key derivation

### MEDIUM PRIORITY (Quality Improvements)

11. **Add Integration Tests**
    - End-to-end credential issuance flow
    - Presentation request/response cycle
    - Multi-credential presentations

12. **Implement DID Resolution**
    - Real DID registry (blockchain or centralized)
    - Cache DID documents
    - Handle did:pocketone method properly

13. **Add Rate Limiting**
    - MC/TC generation endpoints
    - Credential issuance endpoints
    - Authentication endpoints

14. **Add HSM Health Checks**
    - Verify HSM connection on startup
    - Probe key availability
    - Graceful degradation if HSM unavailable

15. **Improve Selective Disclosure**
    - Implement SD-JWT for eIDAS2/W3C VC
    - Add BBS+ signatures for unlinkability
    - Use BLAKE3 commitments consistently

---

## Files Requiring Changes

### High Priority

| File | Issues | Lines | Required Changes |
|------|--------|-------|------------------|
| `ecosystem.config.cjs` | Hardcoded secrets | 51, 69 | Move to environment variables |
| `lib/credentials/mdl-iso18013-5.ts` | No real verification | 144-147 | Implement HSM signature verification |
| `lib/credentials/eidas2.ts` | No real verification | 157-171 | Implement JWS verification |
| `lib/credentials/icao-dtc.ts` | No real verification | 185-196 | Implement SOD verification |
| `lib/credentials/w3c-did.ts` | No real verification | 181-221 | Implement proof verification |
| `backend/lib/mdl.mjs` | Custom CBOR, bad HKDF | 67-323, 416-432 | Replace with spec-compliant library |
| `lib/crypto/blake3.ts` | Weak KDF | 239-245 | Replace with Argon2/PBKDF2 |

### Medium Priority

| File | Issues | Lines | Required Changes |
|------|--------|-------|------------------|
| `lib/credentials/mdl-iso18013-5.ts` | Hash-based age-over only | 152-168 | Implement privacy-preserving predicate proofs |
| `lib/credentials/icao-dtc.ts` | SHA-256 inconsistency | 104, 148 | Switch to BLAKE3 |
| `backend/lib/eidas2.mjs` | SHA-256 inconsistency | 157, 196 | Switch to BLAKE3 |
| `backend/lib/mdl.mjs` | No session transcript | 411-481 | Add session transcript handling |
| `lib/credentials/w3c-did.ts` | Mock DID resolution | 250-263 | Implement real DID registry |

### New Files Required

- `tests/unit/credentials/mdl.test.ts` - mDL unit tests
- `tests/unit/credentials/eidas2.test.ts` - eIDAS2 unit tests
- `tests/unit/credentials/icao-dtc.test.ts` - ICAO DTC unit tests
- `tests/unit/credentials/w3c-did.test.ts` - W3C DID/VC unit tests
- `backend/routes/revocation.mjs` - Credential revocation API
- `backend/routes/presentation.mjs` - Presentation request/verify API
- `.env.example` - Environment variable template

---

## Conclusion

The current implementation provides a **structural foundation** but lacks **critical security and compliance features** required for production use or client demonstration.

**Estimated Effort to Production-Ready**:
- Fix critical issues (1-5): ~2-3 weeks
- High priority items (6-10): ~2-3 weeks
- Medium priority items (11-15): ~1-2 weeks

**Total**: ~5-8 weeks of focused development

**Recommendation**: **NO-GO** for client demo until critical issues 1-5 are resolved.
