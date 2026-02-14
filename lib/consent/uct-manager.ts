import { Blake3Crypto } from '../crypto/blake3';
import { v4 as uuidv4 } from 'uuid';

export interface UCTData {
  id: string;
  rpid: string;
  claims: string[];
  timestamp: number;
  expiresAt: number;
  token: string;
  hashAnchor: string;
  status: 'pending' | 'approved' | 'denied' | 'revoked';
}

export interface ConsentRequest {
  rpid: string;
  requestedClaims: string[];
  purpose: string;
  validityPeriod: number; // in seconds
}

/**
 * User Consent Token (UCT) Manager
 * Implements enterprise consent lifecycle
 */
export class UCTManager {
  /**
   * Create a new UCT from consent request
   */
  static createUCT(
    request: ConsentRequest,
    selectedClaims: string[],
    userMasterCode: string
  ): UCTData {
    const id = uuidv4();
    const timestamp = Date.now();
    const expiresAt = timestamp + (request.validityPeriod * 1000);

    // Generate hash anchor from selected claims
    const claimHashes = selectedClaims.map(claim =>
      Blake3Crypto.hashClaim(claim, userMasterCode)
    );
    const hashAnchor = Blake3Crypto.hash(claimHashes.join(''));

    // Generate the consent token
    const token = Blake3Crypto.generateConsentToken(
      request.rpid,
      selectedClaims,
      timestamp
    );

    return {
      id,
      rpid: request.rpid,
      claims: selectedClaims,
      timestamp,
      expiresAt,
      token,
      hashAnchor,
      status: 'pending',
    };
  }

  /**
   * Approve a UCT
   */
  static approveUCT(uct: UCTData): UCTData {
    return {
      ...uct,
      status: 'approved',
    };
  }

  /**
   * Deny a UCT
   */
  static denyUCT(uct: UCTData): UCTData {
    return {
      ...uct,
      status: 'denied',
    };
  }

  /**
   * Revoke a UCT
   */
  static revokeUCT(uct: UCTData): UCTData {
    return {
      ...uct,
      status: 'revoked',
    };
  }

  /**
   * Verify UCT is valid
   */
  static verifyUCT(uct: UCTData): boolean {
    // Check expiration
    if (Date.now() > uct.expiresAt) {
      return false;
    }

    // Check status
    if (uct.status !== 'approved') {
      return false;
    }

    // Verify token integrity
    const expectedToken = Blake3Crypto.generateConsentToken(
      uct.rpid,
      uct.claims,
      uct.timestamp
    );

    return expectedToken === uct.token;
  }

  /**
   * Parse RPID from QR code
   */
  static parseRPIDFromQR(qrData: string): ConsentRequest {
    try {
      const data = JSON.parse(qrData);
      return {
        rpid: data.rpid,
        requestedClaims: data.claims || [],
        purpose: data.purpose || 'Data verification',
        validityPeriod: data.validityPeriod || 3600, // Default 1 hour
      };
    } catch (error) {
      throw new Error('Invalid RPID QR code format');
    }
  }

  /**
   * Generate audit trail entry
   */
  static generateAuditEntry(uct: UCTData): {
    id: string;
    rpid: string;
    action: string;
    timestamp: number;
    details: any;
  } {
    return {
      id: uuidv4(),
      rpid: uct.rpid,
      action: `UCT ${uct.status}`,
      timestamp: Date.now(),
      details: {
        uctId: uct.id,
        claimsShared: uct.claims.length,
        expiresAt: uct.expiresAt,
      },
    };
  }

  /**
   * Format UCT for transmission
   */
  static formatForTransmission(uct: UCTData): string {
    return JSON.stringify({
      token: uct.token,
      rpid: uct.rpid,
      hashAnchor: uct.hashAnchor,
      timestamp: uct.timestamp,
      expiresAt: uct.expiresAt,
    });
  }
}
