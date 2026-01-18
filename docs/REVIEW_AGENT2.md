# Agent2 Code Review - Phase 4 Hardening

**Date**: 2026-01-17
**Reviewer**: Agent2 (Code Review & Compliance)
**Scope**: ISO 18013-5, eIDAS2, ICAO DTC, W3C DID/VC compliance review

---

## Executive Summary

This review assesses the myID.africa PWA implementation against international digital identity standards. While the codebase demonstrates a solid architectural foundation and comprehensive documentation, **critical compliance and security gaps prevent client demonstration or production deployment**.

### Overall Assessment: **NO-GO** ❌

**Key Findings**:
- ❌ **0/4** credential formats have working signature verification
- ❌ **Hardcoded secrets** in version control
- ❌ **Custom CBOR implementation** not ISO 18013-5 compliant
- ❌ **Zero unit tests** for credential implementations
- ❌ **Age-over proofs are hash-based only** (not privacy-preserving)
- ⚠️ **High-severity dependency vulnerability** (glob CVE 7.5/10)

---

## Compliance Review Summary

### ISO 18013-5 (Mobile Driving License)
**Status**: ❌ **NOT COMPLIANT**

**Critical Issues**:
1. Custom CBOR encoder/decoder instead of spec-compliant library
2. IssuerAuth signature verification is stub: `return !!signature && !!certificate`
3. No DeviceAuth implementation
4. Session encryption doesn't maintain session transcript (required by spec)
5. HKDF key derivation doesn't follow ISO 18013-5 specification
6. Age-over proofs are hash-based only (just hashes, non-privacy-preserving)
7. No reader authentication

**Files Affected**:
- `lib/credentials/mdl-iso18013-5.ts` (frontend)
- `backend/lib/mdl.mjs` (backend)

**Evidence**:
```typescript
// mdl-iso18013-5.ts:144
static verify(doc: MDLDocument): boolean {
  // In production, verify the issuerAuth signature against the certificate
  return !!doc.issuerAuth.signature && !!doc.issuerAuth.certificate; // ❌ STUB
}

// mdl-iso18013-5.ts:163
const proof = Blake3Crypto.hash(
  `${doc.namespaces['org.iso.18013.5.1'].birth_date}:${ageThreshold}:${isOver}`
); // ❌ Hash-based only (non-privacy-preserving) - includes birth date in hash!
```

---

### eIDAS 2.0 (European Digital Identity)
**Status**: ❌ **NOT COMPLIANT**

**Critical Issues**:
1. JWS signature creation and verification are placeholders
2. Selective disclosure uses JSON field filtering, not SD-JWT
3. No credential revocation mechanism
4. Issuer and Verifier roles not separated
5. No QEAA (Qualified Electronic Attestation of Attributes) implementation
6. Mixed use of SHA-256 and BLAKE3 (crypto hygiene issue)

**Files Affected**:
- `lib/credentials/eidas2.ts` (frontend)
- `backend/lib/eidas2.mjs` (backend)

**Evidence**:
```typescript
// eidas2.ts:157-171
static async verify(credential: eIDAS2Credential): Promise<boolean> {
  // In production, verify the JWS signature
  if (!credential.proof.jws) return false; // ❌ No actual verification!

  // Verify expiration
  if (credential.expirationDate) {
    const expiry = new Date(credential.expirationDate);
    if (expiry < new Date()) return false;
  }

  // Verify issuer is trusted
  // This would check against a registry of trusted eIDAS issuers // ❌ NOT IMPLEMENTED

  return true; // ❌ Always returns true if jws exists
}
```

---

### ICAO 9303 DTC (Digital Travel Credential)
**Status**: ❌ **NOT COMPLIANT**

**Critical Issues**:
1. SOD signature verification is stub
2. Uses SHA-256 instead of BLAKE3 (inconsistent)
3. Active Authentication is mock implementation
4. No Chip Authentication
5. No certificate chain validation
6. MRZ generation missing check digits

**Files Affected**:
- `lib/credentials/icao-dtc.ts` (frontend)
- `backend/lib/icao-dtc.mjs` (backend - not found, only frontend exists)

**Evidence**:
```typescript
// icao-dtc.ts:185-196
static verify(doc: DTCDocument): boolean {
  // Verify all data group hashes
  for (const [key, dataGroup] of Object.entries(doc.dataGroups)) {
    const expectedHash = doc.securityObject.dataGroupHashes[key];
    if (dataGroup.dataGroupHash !== expectedHash) {
      return false;
    }
  }

  // In production, verify the SOD signature against the certificate
  return !!doc.securityObject.signature && !!doc.securityObject.certificate; // ❌ STUB
}
```

---

### W3C DID/VC (Verifiable Credentials)
**Status**: ❌ **NOT COMPLIANT**

**Critical Issues**:
1. DID resolution returns mock/empty documents
2. Proof verification is stub
3. No credential status checking
4. Selective disclosure uses JSON filtering, not SD-JWT or BBS+
5. No DID registry implementation

**Files Affected**:
- `lib/credentials/w3c-did.ts` (frontend)
- `backend/lib/did-vc.mjs` (backend)

**Evidence**:
```typescript
// w3c-did.ts:181-197
static async verifyCredential(credential: VerifiableCredential): Promise<boolean> {
  // Check expiration
  if (credential.expirationDate) {
    const expiry = new Date(credential.expirationDate);
    if (expiry < new Date()) return false;
  }

  // In production, verify the proof signature // ❌ NOT IMPLEMENTED
  if (!credential.proof.jws && !credential.proof.proofValue) {
    return false;
  }

  // Verify issuer DID is resolvable // ❌ NOT IMPLEMENTED
  // This would resolve the DID and verify the signature

  return true; // ❌ Always returns true if proof exists
}
```

---

## Security Audit Findings

### 1. Hardcoded Secrets (CRITICAL) ❌

**Location**: `ecosystem.config.cjs:51, 69`

**Finding**:
```javascript
env: {
  JWT_SECRET: 'myid-jwt-secret-key-change-in-production-2026',
  API_KEY: 'myid-api-key-dev-2026',
  // ...
}
```

**Impact**: Development secrets committed to git. Anyone with repo access has JWT signing key.

**Remediation**:
1. Create `.env` file (add to `.gitignore`)
2. Move secrets to environment variables
3. Update `ecosystem.config.cjs` to use `process.env.JWT_SECRET`
4. **ROTATE BOTH SECRETS IMMEDIATELY**
5. Add to deployment docs

---

### 2. Dependency Vulnerabilities

**High Severity** (Action Required):
```
Package: glob
Version: 10.2.0 - 10.4.5
CVE: GHSA-5j98-mcp5-4vw2
Score: 7.5/10 (HIGH)
Issue: Command injection via CLI
Via: @next/eslint-plugin-next
```

**Fix**: Upgrade `eslint-config-next` to 16.1.3
```bash
npm install eslint-config-next@16.1.3
```

**Low Severity** (Monitor):
```
Package: pm2
Version: ≤6.0.14
CVE: GHSA-x5gf-qvw8-r2rm
Score: 4.3/10 (LOW)
Issue: RegEx DoS
```

---

### 3. Cryptographic Hygiene Issues

**Issue 1: Inconsistent Hash Algorithms**

Mixed use of SHA-256 and BLAKE3:
- BLAKE3: Selective disclosure, MasterCode, TrustCode ✅
- SHA-256: ICAO DTC SOD, eIDAS2 personal identifier ❌

**Location**:
- `lib/credentials/icao-dtc.ts:104` (hashAlgorithm: 'SHA256')
- `backend/lib/eidas2.mjs:157` (crypto.createHash('sha256'))
- `backend/lib/eidas2.mjs:196` (crypto.createHash('sha256'))

**Recommendation**: Standardize on BLAKE3 OR document why SHA-256 is required for specific standards.

**Issue 2: Weak Key Derivation Function**

**Location**: `lib/crypto/blake3.ts:239-245`

```typescript
static deriveKey(password: string, salt: string, iterations: number = 10000): string {
  let key = this.hash(`${salt}:${password}`);
  for (let i = 0; i < iterations; i++) {
    key = this.hash(`${key}:${i}`); // ❌ Not cryptographically sound
  }
  return key;
}
```

**Issue**: Custom KDF is not a standard construction. Vulnerable to attacks.

**Recommendation**: Use Argon2, scrypt, or PBKDF2 from `crypto` module.

---

## Test Coverage Audit

### Current State

**E2E Tests**: 1 file
- `tests/e2e/routes.spec.ts` (171 lines)
- Playwright route navigation only
- No credential operations tested

**Unit Tests**: ❌ **ZERO**
- No tests for credential implementations
- No tests for signature verification
- No tests for selective disclosure
- No tests for CBOR encoding

**Integration Tests**: ❌ **ZERO**

**Smoke Tests**: ✅ 1 file
- `scripts/smoke.mjs` (127 lines)
- Health checks only
- Auth enforcement checks

### Required Tests (ALL MISSING)

**ISO 18013-5**:
- CBOR encoding/decoding round-trip
- Device engagement QR generation/parsing
- Session key derivation (ECDH + HKDF)
- IssuerAuth signature creation and verification
- DeviceAuth signature
- Selective disclosure
- Age-over proofs

**eIDAS2**:
- PID credential creation and validation
- JWS signature creation and verification
- Country claim mapping
- Age predicate computation
- Selective disclosure

**ICAO DTC**:
- MRZ generation with check digits
- Data group hashing
- SOD signature verification
- Active Authentication

**W3C DID/VC**:
- DID generation
- VC issuance and verification
- VP creation and verification
- Challenge-response

**Test Coverage**: **0%** for credential logic

---

## Required Changes (Prioritized)

### BLOCKING (Must Fix Before Any Demo)

#### 1. Remove Hardcoded Secrets
**Files**: `ecosystem.config.cjs`
**Effort**: 2 hours
**Change**:
```diff
- JWT_SECRET: 'myid-jwt-secret-key-change-in-production-2026',
- API_KEY: 'myid-api-key-dev-2026',
+ JWT_SECRET: process.env.JWT_SECRET,
+ API_KEY: process.env.API_KEY,
```
Create `.env` file and add to `.gitignore`.

#### 2. Fix Dependency Vulnerability
**Files**: `package.json`
**Effort**: 30 minutes
**Command**:
```bash
npm install eslint-config-next@16.1.3
npm audit
```

#### 3. Implement Signature Verification (Choose ONE credential type)
**Files**: `lib/credentials/mdl-iso18013-5.ts` OR `lib/credentials/eidas2.ts`
**Effort**: 1-2 days
**Change**:
- Integrate with `backend/lib/hsm-signer.mjs`
- Implement actual signature creation
- Implement actual signature verification
- Add certificate chain validation

#### 4. Replace Custom CBOR Encoder
**Files**: `backend/lib/mdl.mjs:67-323`
**Effort**: 4-6 hours
**Change**:
```bash
npm install cbor-x
```
Remove `CBOREncoder` class, use `cbor-x` library.

#### 5. Fix Age-Over Proof Documentation
**Files**: `lib/credentials/mdl-iso18013-5.ts:152-168`, `backend/lib/selective-disclosure.mjs:462-487`
**Effort**: 1 day OR 5 minutes
**Options**:
- **Option A** (5 min): Document as hash-based selective disclosure (non-privacy-preserving)
- **Option B** (1 day): Implement privacy-preserving predicate proofs

---

### HIGH PRIORITY (Needed for Production)

#### 6. Add Minimum Unit Tests
**Files**: Create `tests/unit/credentials/*.test.ts`
**Effort**: 1-2 days
**Coverage**:
- One test file per credential type
- Test validation logic
- Test encoding/decoding
- Test basic signature flow (even if mocked)

#### 7. Implement Device Binding (ISO 18013-5)
**Files**: `backend/lib/mdl.mjs`
**Effort**: 2-3 days
**Add**:
- DeviceAuth signature generation
- Session transcript maintenance
- Reader authentication

#### 8. Implement Credential Revocation
**Files**: Create `backend/routes/revocation.mjs`
**Effort**: 2-3 days
**Add**:
- Status List 2021 support
- Revocation endpoints
- Status checking in verification

#### 9. Separate Issuer/Verifier Roles
**Files**: All route files
**Effort**: 1-2 days
**Split**:
- Issuance endpoints (require issuer API key)
- Verification endpoints (require verifier API key)
- Different audit trails

#### 10. Standardize Hash Algorithm
**Files**: `lib/credentials/icao-dtc.ts:104`, `backend/lib/eidas2.mjs:157,196`
**Effort**: 2-4 hours
**Change**:
```diff
- hashAlgorithm: 'SHA256',
+ hashAlgorithm: 'BLAKE3',

- crypto.createHash('sha256')
+ Blake3Crypto.hash()
```

---

### MEDIUM PRIORITY (Quality & Completeness)

#### 11. Fix Key Derivation Function
**Files**: `lib/crypto/blake3.ts:239-245`
**Effort**: 2-3 hours
**Replace**:
```typescript
import { pbkdf2Sync } from 'crypto';

static deriveKey(password: string, salt: string, iterations: number = 100000): string {
  return pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('hex');
}
```

#### 12. Implement SD-JWT for Selective Disclosure
**Files**: `lib/credentials/eidas2.ts:176-198`, `lib/credentials/w3c-did.ts:226-245`
**Effort**: 3-5 days
**Library**: `@sd-jwt/core`

#### 13. Implement DID Resolution
**Files**: `lib/credentials/w3c-did.ts:250-263`
**Effort**: 1 week
**Options**:
- Use existing DID resolver library
- Implement custom `did:pocketone` method
- Connect to blockchain or centralized registry

#### 14. Add HSM Health Checks
**Files**: `backend/lib/hsm-signer.mjs`
**Effort**: 4-6 hours
**Add**:
- Connection probe on startup
- Key availability check
- Graceful degradation

#### 15. Fix ISO 18013-5 Session Key Derivation
**Files**: `backend/lib/mdl.mjs:416-432`
**Effort**: 1 day
**Change**: Implement spec-compliant HKDF per ISO 18013-5 Section 9.1.1.4

---

## File-Level Change Summary

### Critical Path Files (Week 1-2)

| File | Issues | Required Changes |
|------|--------|------------------|
| `ecosystem.config.cjs` | Hardcoded secrets | Move to env vars |
| `package.json` | Vuln dependency | Upgrade eslint-config-next |
| `lib/credentials/mdl-iso18013-5.ts` | Stub verification | Implement HSM signing |
| `backend/lib/mdl.mjs` | Custom CBOR, bad HKDF | Use cbor-x library, fix KDF |
| `.gitignore` | Missing .env | Add .env files |

### High Priority Files (Week 3-4)

| File | Issues | Required Changes |
|------|--------|------------------|
| `lib/credentials/eidas2.ts` | Stub verification, JSON SD | Implement JWS, SD-JWT |
| `lib/credentials/icao-dtc.ts` | SHA-256, stub verify | Use BLAKE3, real verify |
| `lib/credentials/w3c-did.ts` | Mock resolution, stub verify | Implement resolver, verify |
| `lib/crypto/blake3.ts` | Weak KDF | Use PBKDF2/Argon2 |
| `tests/unit/credentials/` | Missing | Create test files |

### Medium Priority Files (Week 5-6)

| File | Issues | Required Changes |
|------|--------|------------------|
| `backend/routes/revocation.mjs` | Missing | Create revocation API |
| `backend/routes/presentation.mjs` | Missing | Create presentation API |
| `backend/lib/hsm-signer.mjs` | No health check | Add connection probe |
| All credential files | JSON field filter | Implement SD-JWT |

---

## Documentation Deliverables

✅ **Created**:
1. `docs/COMPLIANCE.md` - Detailed compliance matrix with test coverage
2. `docs/DEMO_READINESS.md` - Go/No-Go checklist with decision rationale
3. `docs/REVIEW_AGENT2.md` - This review document

✅ **Previously Created** (Agent1):
- `docs/RUNTIME.md` - Runtime configuration
- `docs/SECURITY.md` - Security architecture
- `scripts/smoke.mjs` - Smoke tests

---

## Recommendations

### For Immediate Action (Next 48 Hours)

1. **DO NOT demo** this system to clients claiming:
   - ISO 18013-5 compliance
   - eIDAS2 compliance
   - Privacy-preserving predicate proofs
   - Cryptographic security

2. **FIX immediately**:
   - Remove hardcoded secrets (2 hours)
   - Fix dependency vulnerability (30 min)
   - Add disclaimers to README

3. **DECIDE**:
   - Delay demo until critical fixes complete (6-8 weeks), OR
   - Demo as "architecture prototype" with explicit disclaimers

### For Production Readiness (6-8 Weeks)

**Week 1-2**: Fix blocking issues (#1-5)
**Week 3-4**: High priority items (#6-10)
**Week 5-6**: Medium priority items (#11-15)
**Week 7-8**: Integration testing and hardening

---

## Final Assessment

**Code Quality**: ⚠️ **FAIR**
- Good architecture and structure
- Excellent documentation
- Missing critical implementations

**Security Posture**: ❌ **POOR**
- Hardcoded secrets
- High-severity vulnerability
- Placeholder cryptography

**Standards Compliance**: ❌ **NONE**
- 0 out of 4 standards compliant
- Multiple false claims
- Fundamental gaps in all specs

**Test Coverage**: ❌ **UNACCEPTABLE**
- 0% unit test coverage
- Only basic E2E smoke tests
- No credential operation tests

**Production Readiness**: ❌ **NOT READY**
- Estimated 6-8 weeks to minimum viable
- 3-4 months to full production quality

---

## Reviewer Sign-Off

**Recommendation**: **NO-GO for client demo**

**Blocking Issues**: 4 critical, 4 high-priority
**Estimated Fix Time**: 6-8 weeks minimum

**Conditional Approval**: Architecture demo only, with explicit disclaimers that cryptographic operations are simulated.

**Final Note**: This codebase shows promise and good architectural decisions. However, the gap between current state and production-ready is substantial. Do not rush to demo - the reputational risk of demonstrating non-functional security features outweighs the benefit of showing the system early.

---

**Agent2 Review Complete**
**Date**: 2026-01-17
**Status**: NO-GO ❌
