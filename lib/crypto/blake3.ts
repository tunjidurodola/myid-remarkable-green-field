import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex, hexToBytes, utf8ToBytes, randomBytes } from '@noble/hashes/utils';

/**
 * MasterCode generation result
 */
export interface MasterCodeResult {
  /** The full MasterCode (256-bit BLAKE3 hash as hex) */
  masterCode: string;
  /** Full 256-bit BLAKE3 hash (64 hex chars) */
  hash_b3: string;
  /** Truncated 160-bit hash (40 hex chars) for display/sharing */
  hash_b3_160: string;
}

/**
 * TrustCode generation result
 */
export interface TrustCodeResult {
  /** The TrustCode (derived from MasterCode + entropy) */
  trustCode: string;
  /** The entropy used (for recovery purposes) */
  entropy: string;
  /** Timestamp of generation */
  generatedAt: number;
}

/**
 * PII data structure for MasterCode generation
 */
export interface PIIData {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // Format: YYYY-MM-DD
  nationalId: string;
  /** Optional additional fields for enhanced uniqueness */
  middleName?: string;
  gender?: string;
  countryCode?: string;
}

/**
 * BLAKE3 hashing utilities for selective disclosure and claim commitments
 */
export class Blake3Crypto {
  /**
   * Hash arbitrary data using BLAKE3 (256-bit output)
   */
  static hash(data: string | Uint8Array): string {
    const input = typeof data === 'string' ? utf8ToBytes(data) : data;
    return bytesToHex(blake3(input));
  }

  /**
   * Hash with custom output length
   */
  static hashWithLength(data: string | Uint8Array, outputLength: number): string {
    const input = typeof data === 'string' ? utf8ToBytes(data) : data;
    return bytesToHex(blake3(input, { dkLen: outputLength }));
  }

  /**
   * Hash to 160 bits (20 bytes) - used for shorter identifiers
   */
  static hash160(data: string | Uint8Array): string {
    return this.hashWithLength(data, 20);
  }

  /**
   * Create a keyed hash for selective disclosure
   */
  static keyedHash(data: string, key: string): string {
    const keyBytes = hexToBytes(key.length === 64 ? key : key.padEnd(64, '0'));
    const dataBytes = utf8ToBytes(data);
    return bytesToHex(blake3(dataBytes, { key: keyBytes }));
  }

  /**
   * Generate secure random bytes as hex string
   */
  static generateRandomBytes(length: number = 32): string {
    return bytesToHex(randomBytes(length));
  }

  /**
   * Generate a nonce for commitments
   */
  static generateNonce(): string {
    return this.generateRandomBytes(16);
  }

  /**
   * Hash PII data for MasterCode generation
   * Returns the full hash, hash_b3, and truncated hash_b3_160
   *
   * Format: BLAKE3(firstName || lastName || dateOfBirth || nationalID || [optionalFields])
   */
  static generateMasterCode(piiData: PIIData): MasterCodeResult {
    // Normalize and concatenate PII fields in deterministic order
    const normalizedData = [
      piiData.firstName.trim().toLowerCase(),
      piiData.lastName.trim().toLowerCase(),
      piiData.dateOfBirth.trim(), // Keep as-is for consistency
      piiData.nationalId.trim().toUpperCase(),
      piiData.middleName?.trim().toLowerCase() || '',
      piiData.gender?.trim().toLowerCase() || '',
      piiData.countryCode?.trim().toUpperCase() || '',
    ].join('|');

    const hash_b3 = this.hash(normalizedData);
    const hash_b3_160 = hash_b3.substring(0, 40); // First 160 bits (40 hex chars)

    return {
      masterCode: hash_b3,
      hash_b3,
      hash_b3_160,
    };
  }

  /**
   * Generate trustCode from MasterCode and additional entropy
   * Used for creating shareable verification codes
   */
  static generateTrustCode(masterCode: string, entropy?: string): TrustCodeResult {
    const actualEntropy = entropy || this.generateRandomBytes(16);
    const trustCode = this.hash(`${masterCode}:${actualEntropy}`);

    return {
      trustCode,
      entropy: actualEntropy,
      generatedAt: Date.now(),
    };
  }

  /**
   * Verify a TrustCode against a MasterCode and entropy
   */
  static verifyTrustCode(
    trustCode: string,
    masterCode: string,
    entropy: string
  ): boolean {
    const expected = this.hash(`${masterCode}:${entropy}`);
    return this.constantTimeCompare(expected, trustCode);
  }

  /**
   * Create claim commitment for selective disclosure
   * @param value - The claim value to commit to
   * @param nonce - Optional nonce (generated if not provided)
   */
  static createClaimCommitment(value: string, nonce?: string): {
    commitment: string;
    nonce: string;
  } {
    const actualNonce = nonce || this.generateNonce();
    const commitment = this.hash(`${value}:${actualNonce}`);
    return { commitment, nonce: actualNonce };
  }

  /**
   * Verify a claim commitment
   */
  static verifyClaimCommitment(
    claimValue: string,
    nonce: string,
    commitment: string
  ): boolean {
    const expected = this.hash(`${claimValue}:${nonce}`);
    return this.constantTimeCompare(expected, commitment);
  }

  /**
   * Generate consent token hash
   * Used for creating unique consent receipts
   */
  static generateConsentToken(
    rpid: string,
    claims: string[],
    timestamp: number,
    userId?: string
  ): string {
    const sortedClaims = [...claims].sort();
    const data = JSON.stringify({
      rpid,
      claims: sortedClaims,
      timestamp,
      userId: userId || '',
    });
    return this.hash(data);
  }

  /**
   * Create a deterministic claim hash
   */
  static hashClaim(claimType: string, claimValue: string): string {
    return this.hash(`${claimType}:${claimValue}`);
  }

  /**
   * Hash sensitive data with a user-specific salt
   */
  static hashWithSalt(data: string, salt: string): string {
    return this.hash(`${salt}:${data}`);
  }

  /**
   * Create a merkle tree leaf for credential claims
   */
  static createMerkleLeaf(claimType: string, claimValue: string, nonce: string): string {
    return this.hash(`leaf:${claimType}:${claimValue}:${nonce}`);
  }

  /**
   * Combine two merkle hashes into a parent node
   */
  static combineMerkleNodes(left: string, right: string): string {
    // Sort to ensure deterministic ordering
    const [first, second] = [left, right].sort();
    return this.hash(`node:${first}:${second}`);
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Derive a key from a password/passphrase (simple derivation)
   * Note: For production, use proper KDF like Argon2 or PBKDF2
   */
  static deriveKey(password: string, salt: string, iterations: number = 10000): string {
    let key = this.hash(`${salt}:${password}`);
    for (let i = 0; i < iterations; i++) {
      key = this.hash(`${key}:${i}`);
    }
    return key;
  }
}
