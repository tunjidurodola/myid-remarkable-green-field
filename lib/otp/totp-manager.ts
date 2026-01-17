import * as OTPAuth from 'otpauth';

export interface TOTPSecret {
  id: string;
  service: string;
  secret: string;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512';
  digits: number;
  period: number;
}

/**
 * TOTP Manager for OTP authentication
 */
export class TOTPManager {
  /**
   * Generate TOTP code
   */
  static generateCode(secret: TOTPSecret): string {
    const totp = new OTPAuth.TOTP({
      issuer: secret.service,
      label: secret.service,
      algorithm: secret.algorithm,
      digits: secret.digits,
      period: secret.period,
      secret: OTPAuth.Secret.fromBase32(secret.secret),
    });

    return totp.generate();
  }

  /**
   * Get time remaining for current code
   */
  static getTimeRemaining(period: number = 30): number {
    const now = Math.floor(Date.now() / 1000);
    return period - (now % period);
  }

  /**
   * Validate TOTP code
   */
  static validateCode(secret: TOTPSecret, code: string, window: number = 1): boolean {
    const totp = new OTPAuth.TOTP({
      issuer: secret.service,
      label: secret.service,
      algorithm: secret.algorithm,
      digits: secret.digits,
      period: secret.period,
      secret: OTPAuth.Secret.fromBase32(secret.secret),
    });

    const delta = totp.validate({ token: code, window });
    return delta !== null;
  }

  /**
   * Parse TOTP URI from QR code
   */
  static parseURI(uri: string): Partial<TOTPSecret> {
    try {
      const totp = OTPAuth.URI.parse(uri);
      if (totp instanceof OTPAuth.TOTP) {
        return {
          service: totp.issuer || totp.label,
          secret: totp.secret.base32,
          algorithm: totp.algorithm as 'SHA1' | 'SHA256' | 'SHA512',
          digits: totp.digits,
          period: totp.period,
        };
      }
      throw new Error('Invalid TOTP URI');
    } catch (error) {
      throw new Error('Failed to parse TOTP URI');
    }
  }

  /**
   * Generate a new secret
   */
  static generateSecret(): string {
    const secret = new OTPAuth.Secret({ size: 20 });
    return secret.base32;
  }

  /**
   * Create TOTP URI for QR code generation
   */
  static createURI(secret: TOTPSecret, accountName: string): string {
    const totp = new OTPAuth.TOTP({
      issuer: secret.service,
      label: accountName,
      algorithm: secret.algorithm,
      digits: secret.digits,
      period: secret.period,
      secret: OTPAuth.Secret.fromBase32(secret.secret),
    });

    return totp.toString();
  }
}
