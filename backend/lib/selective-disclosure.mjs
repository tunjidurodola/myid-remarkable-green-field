/**
 * Selective Disclosure Module
 * Implements BLAKE3-based claim commitments, Merkle trees, and proof generation
 */

import crypto from 'crypto';
import { blake3 } from '@noble/hashes/blake3.js';
import { bytesToHex, hexToBytes, utf8ToBytes, randomBytes } from '@noble/hashes/utils.js';

/**
 * BLAKE3 hashing utilities
 */
export class Blake3 {
  /**
   * Hash data using BLAKE3 (256-bit output)
   */
  static hash(data) {
    const input = typeof data === 'string' ? utf8ToBytes(data) : data;
    return bytesToHex(blake3(input));
  }

  /**
   * Hash with custom output length
   */
  static hashWithLength(data, outputLength) {
    const input = typeof data === 'string' ? utf8ToBytes(data) : data;
    return bytesToHex(blake3(input, { dkLen: outputLength }));
  }

  /**
   * Hash to 160 bits (20 bytes)
   */
  static hash160(data) {
    return this.hashWithLength(data, 20);
  }

  /**
   * Generate secure random bytes as hex string
   */
  static randomHex(length = 32) {
    return bytesToHex(randomBytes(length));
  }
}

/**
 * Salt generation for claims
 */
export class SaltGenerator {
  /**
   * Generate a random salt for a claim
   */
  static generate(length = 16) {
    return Blake3.randomHex(length);
  }

  /**
   * Generate salts for multiple claims
   */
  static generateForClaims(claims) {
    const salts = {};
    for (const claimKey of Object.keys(claims)) {
      salts[claimKey] = this.generate();
    }
    return salts;
  }

  /**
   * Generate deterministic salt from seed
   */
  static fromSeed(seed, claimKey) {
    return Blake3.hash(`salt:${seed}:${claimKey}`);
  }
}

/**
 * Claim commitment generation using BLAKE3
 */
export class ClaimCommitment {
  /**
   * Create a commitment for a single claim
   * commitment = BLAKE3(claimType || ":" || claimValue || ":" || salt)
   */
  static create(claimType, claimValue, salt = null) {
    const actualSalt = salt || SaltGenerator.generate();
    const serializedValue = typeof claimValue === 'object'
      ? JSON.stringify(claimValue)
      : String(claimValue);

    const commitment = Blake3.hash(`${claimType}:${serializedValue}:${actualSalt}`);

    return {
      claimType,
      commitment,
      salt: actualSalt,
    };
  }

  /**
   * Create commitments for multiple claims
   */
  static createBatch(claims, salts = null) {
    const actualSalts = salts || SaltGenerator.generateForClaims(claims);
    const commitments = {};

    for (const [claimType, claimValue] of Object.entries(claims)) {
      const result = this.create(claimType, claimValue, actualSalts[claimType]);
      commitments[claimType] = {
        commitment: result.commitment,
        salt: result.salt,
      };
    }

    return commitments;
  }

  /**
   * Verify a claim commitment
   */
  static verify(claimType, claimValue, salt, commitment) {
    const serializedValue = typeof claimValue === 'object'
      ? JSON.stringify(claimValue)
      : String(claimValue);

    const expected = Blake3.hash(`${claimType}:${serializedValue}:${salt}`);
    return this.constantTimeCompare(expected, commitment);
  }

  /**
   * Constant-time string comparison
   */
  static constantTimeCompare(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }
}

/**
 * Merkle tree construction for claims
 */
export class MerkleTree {
  constructor() {
    this.leaves = [];
    this.layers = [];
    this.leafMap = new Map(); // Maps claim type to leaf index
  }

  /**
   * Add a leaf to the tree
   */
  addLeaf(claimType, commitment) {
    const leafHash = Blake3.hash(`leaf:${commitment}`);
    this.leafMap.set(claimType, this.leaves.length);
    this.leaves.push({
      claimType,
      commitment,
      hash: leafHash,
    });
    return leafHash;
  }

  /**
   * Build the tree from commitments
   */
  static fromCommitments(commitments) {
    const tree = new MerkleTree();

    // Sort claim types for deterministic ordering
    const sortedClaimTypes = Object.keys(commitments).sort();

    for (const claimType of sortedClaimTypes) {
      const { commitment } = commitments[claimType];
      tree.addLeaf(claimType, commitment);
    }

    tree.build();
    return tree;
  }

  /**
   * Build the Merkle tree layers
   */
  build() {
    if (this.leaves.length === 0) {
      throw new Error('Cannot build empty Merkle tree');
    }

    // Start with leaf hashes
    let currentLayer = this.leaves.map(leaf => leaf.hash);
    this.layers = [currentLayer];

    // Build up the tree
    while (currentLayer.length > 1) {
      const nextLayer = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;

        // Sort for deterministic ordering
        const [first, second] = [left, right].sort();
        const parent = Blake3.hash(`node:${first}:${second}`);
        nextLayer.push(parent);
      }

      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }

    return this;
  }

  /**
   * Get the Merkle root
   */
  getRoot() {
    if (this.layers.length === 0) {
      return null;
    }
    return this.layers[this.layers.length - 1][0];
  }

  /**
   * Generate proof for a specific claim
   */
  getProof(claimType) {
    const leafIndex = this.leafMap.get(claimType);
    if (leafIndex === undefined) {
      throw new Error(`Claim type not found: ${claimType}`);
    }

    const proof = [];
    let index = leafIndex;

    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRight = index % 2 === 1;
      const siblingIndex = isRight ? index - 1 : index + 1;

      if (siblingIndex < layer.length) {
        proof.push({
          position: isRight ? 'left' : 'right',
          hash: layer[siblingIndex],
        });
      } else {
        // Duplicate for odd number of nodes
        proof.push({
          position: isRight ? 'left' : 'right',
          hash: layer[index],
        });
      }

      index = Math.floor(index / 2);
    }

    return {
      claimType,
      leafHash: this.leaves[leafIndex].hash,
      proof,
      root: this.getRoot(),
    };
  }

  /**
   * Verify a Merkle proof
   */
  static verifyProof(leafHash, proof, expectedRoot) {
    let currentHash = leafHash;

    for (const step of proof) {
      const [first, second] = step.position === 'left'
        ? [step.hash, currentHash]
        : [currentHash, step.hash];

      // Sort for deterministic ordering (same as in build)
      const [sortedFirst, sortedSecond] = [first, second].sort();
      currentHash = Blake3.hash(`node:${sortedFirst}:${sortedSecond}`);
    }

    return currentHash === expectedRoot;
  }

  /**
   * Export tree for storage
   */
  toJSON() {
    return {
      leaves: this.leaves,
      layers: this.layers,
      root: this.getRoot(),
    };
  }

  /**
   * Import tree from storage
   */
  static fromJSON(json) {
    const tree = new MerkleTree();
    tree.leaves = json.leaves;
    tree.layers = json.layers;

    for (let i = 0; i < json.leaves.length; i++) {
      tree.leafMap.set(json.leaves[i].claimType, i);
    }

    return tree;
  }
}

/**
 * Selective disclosure proof generation and verification
 */
export class SelectiveDisclosure {
  /**
   * Create a selective disclosure credential
   */
  static createCredential(claims, options = {}) {
    // Generate commitments with salts
    const commitments = ClaimCommitment.createBatch(claims);

    // Build Merkle tree
    const tree = MerkleTree.fromCommitments(commitments);

    return {
      credentialId: options.credentialId || crypto.randomUUID(),
      issuedAt: new Date().toISOString(),
      issuer: options.issuer || 'pocketOne',
      subject: options.subject,
      commitments,
      merkleRoot: tree.getRoot(),
      merkleTree: tree.toJSON(),
    };
  }

  /**
   * Create a presentation with selective disclosure
   */
  static createPresentation(credential, revealedClaims, originalClaims) {
    const tree = MerkleTree.fromJSON(credential.merkleTree);
    const disclosed = {};
    const proofs = {};

    for (const claimType of revealedClaims) {
      if (!originalClaims[claimType]) {
        throw new Error(`Claim not found: ${claimType}`);
      }

      // Include the claim value and salt for verification
      disclosed[claimType] = {
        value: originalClaims[claimType],
        salt: credential.commitments[claimType].salt,
      };

      // Generate Merkle proof
      proofs[claimType] = tree.getProof(claimType);
    }

    return {
      presentationId: crypto.randomUUID(),
      credentialId: credential.credentialId,
      issuer: credential.issuer,
      subject: credential.subject,
      merkleRoot: credential.merkleRoot,
      disclosed,
      proofs,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Verify a selective disclosure presentation
   */
  static verifyPresentation(presentation) {
    const results = {
      valid: true,
      claims: {},
      errors: [],
    };

    for (const [claimType, claimData] of Object.entries(presentation.disclosed)) {
      // Verify the commitment
      const commitment = Blake3.hash(
        `${claimType}:${typeof claimData.value === 'object' ? JSON.stringify(claimData.value) : String(claimData.value)}:${claimData.salt}`
      );

      const leafHash = Blake3.hash(`leaf:${commitment}`);

      // Verify Merkle proof
      const proof = presentation.proofs[claimType];
      const proofValid = MerkleTree.verifyProof(
        leafHash,
        proof.proof,
        presentation.merkleRoot
      );

      if (!proofValid) {
        results.valid = false;
        results.errors.push(`Invalid proof for claim: ${claimType}`);
      }

      results.claims[claimType] = {
        value: claimData.value,
        verified: proofValid,
      };
    }

    return results;
  }

  /**
   * Create a disclosure request
   */
  static createRequest(options) {
    return {
      requestId: crypto.randomUUID(),
      rpId: options.rpId,
      rpName: options.rpName,
      requestedClaims: options.requestedClaims,
      purpose: options.purpose,
      intentToRetain: options.intentToRetain || false,
      nonce: Blake3.randomHex(16),
      createdAt: new Date().toISOString(),
      expiresAt: options.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min default
    };
  }

  /**
   * Validate a disclosure request
   */
  static validateRequest(request) {
    const errors = [];

    if (!request.requestId) errors.push('Missing request ID');
    if (!request.rpId) errors.push('Missing RP ID');
    if (!request.requestedClaims || !Array.isArray(request.requestedClaims)) {
      errors.push('Invalid requested claims');
    }
    if (!request.nonce) errors.push('Missing nonce');

    // Check expiration
    if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
      errors.push('Request has expired');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Predicate proofs for selective disclosure
 * Allows proving statements about claims without revealing the value
 */
export class PredicateProof {
  /**
   * Create an age-over proof without revealing birth date
   */
  static createAgeOverProof(birthDate, threshold) {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    const isOver = age >= threshold;
    const nonce = Blake3.randomHex(16);

    // Create a commitment to the result without revealing the actual age
    const proof = Blake3.hash(`age_over:${threshold}:${isOver}:${nonce}`);

    return {
      type: 'age_over',
      threshold,
      result: isOver,
      proof,
      nonce,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a range proof (value is within range)
   */
  static createRangeProof(value, min, max, claimType) {
    const numValue = Number(value);
    const inRange = numValue >= min && numValue <= max;
    const nonce = Blake3.randomHex(16);

    const proof = Blake3.hash(`range:${claimType}:${min}:${max}:${inRange}:${nonce}`);

    return {
      type: 'range',
      claimType,
      min,
      max,
      result: inRange,
      proof,
      nonce,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a membership proof (value is one of allowed values)
   */
  static createMembershipProof(value, allowedValues, claimType) {
    const isMember = allowedValues.includes(value);
    const nonce = Blake3.randomHex(16);

    // Hash the allowed values for the proof
    const allowedHash = Blake3.hash(JSON.stringify(allowedValues.sort()));
    const proof = Blake3.hash(`membership:${claimType}:${allowedHash}:${isMember}:${nonce}`);

    return {
      type: 'membership',
      claimType,
      allowedValuesHash: allowedHash,
      result: isMember,
      proof,
      nonce,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Verify a predicate proof
   */
  static verifyProof(proofData, expectedResult) {
    switch (proofData.type) {
      case 'age_over': {
        const expected = Blake3.hash(
          `age_over:${proofData.threshold}:${proofData.result}:${proofData.nonce}`
        );
        return expected === proofData.proof && proofData.result === expectedResult;
      }
      case 'range': {
        const expected = Blake3.hash(
          `range:${proofData.claimType}:${proofData.min}:${proofData.max}:${proofData.result}:${proofData.nonce}`
        );
        return expected === proofData.proof && proofData.result === expectedResult;
      }
      case 'membership': {
        const expected = Blake3.hash(
          `membership:${proofData.claimType}:${proofData.allowedValuesHash}:${proofData.result}:${proofData.nonce}`
        );
        return expected === proofData.proof && proofData.result === expectedResult;
      }
      default:
        return false;
    }
  }
}

/**
 * Batch operations for efficient processing
 */
export class BatchOperations {
  /**
   * Create commitments for multiple credentials
   */
  static createBatchCommitments(credentialsData) {
    return credentialsData.map(data => ({
      id: data.id,
      ...ClaimCommitment.createBatch(data.claims),
    }));
  }

  /**
   * Verify multiple presentations
   */
  static verifyBatchPresentations(presentations) {
    return presentations.map(presentation => ({
      presentationId: presentation.presentationId,
      ...SelectiveDisclosure.verifyPresentation(presentation),
    }));
  }
}

export default {
  Blake3,
  SaltGenerator,
  ClaimCommitment,
  MerkleTree,
  SelectiveDisclosure,
  PredicateProof,
  BatchOperations,
};
