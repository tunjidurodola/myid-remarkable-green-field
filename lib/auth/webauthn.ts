/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck - Disabling TS checks due to complex WebAuthn types
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';

/**
 * WebAuthn / Passkey Manager
 * Implements FIDO2/WebAuthn authentication for passwordless login
 */

export interface PasskeyCredential {
  id: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  createdAt: number;
  deviceName?: string;
  lastUsed?: number;
}

export class WebAuthnManager {
  private static readonly RP_NAME = 'myID.africa';
  private static readonly RP_ID = 'myid.africa';

  /**
   * Register a new passkey
   */
  static async registerPasskey(
    userId: string,
    userName: string,
    userDisplayName: string
  ): Promise<PasskeyCredential> {
    try {
      // In production, fetch these options from the backend
      const registrationOptions = {
        challenge: this.generateChallenge(),
        rp: {
          name: this.RP_NAME,
          id: this.RP_ID,
        },
        user: {
          id: userId,
          name: userName,
          displayName: userDisplayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' as const }, // ES256
          { alg: -257, type: 'public-key' as const }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform' as const, // or 'cross-platform' for security keys
          requireResidentKey: true,
          residentKey: 'required' as const,
          userVerification: 'required' as const,
        },
        timeout: 60000,
        attestation: 'direct' as const,
      };

      const credential = await startRegistration(registrationOptions);

      // In production, send credential to backend for verification
      return {
        id: crypto.randomUUID(),
        credentialId: credential.id,
        publicKey: credential.response.publicKey || '',
        counter: 0,
        createdAt: Date.now(),
      };
    } catch (error) {
      console.error('Passkey registration failed:', error);
      throw new Error('Failed to register passkey');
    }
  }

  /**
   * Authenticate using passkey
   */
  static async authenticateWithPasskey(
    allowedCredentials?: string[]
  ): Promise<{
    credentialId: string;
    signature: string;
    authenticatorData: string;
    clientDataJSON: string;
  }> {
    try {
      const authenticationOptions = {
        challenge: this.generateChallenge(),
        rpId: this.RP_ID,
        allowCredentials: allowedCredentials?.map((id) => ({
          id,
          type: 'public-key' as const,
          transports: ['internal', 'usb', 'nfc', 'ble'] as AuthenticatorTransport[],
        })),
        userVerification: 'required' as UserVerificationRequirement,
        timeout: 60000,
      };

      const assertion = await startAuthentication(authenticationOptions);

      return {
        credentialId: assertion.id,
        signature: assertion.response.signature,
        authenticatorData: assertion.response.authenticatorData,
        clientDataJSON: assertion.response.clientDataJSON,
      };
    } catch (error) {
      console.error('Passkey authentication failed:', error);
      throw new Error('Failed to authenticate with passkey');
    }
  }

  /**
   * Register FIDO hardware security key
   */
  static async registerSecurityKey(
    userId: string,
    userName: string
  ): Promise<PasskeyCredential> {
    try {
      // eslint-disable-next-line
      const registrationOptions = {
        challenge: this.generateChallenge(),
        rp: {
          name: this.RP_NAME,
          id: this.RP_ID,
        },
        user: {
          id: userId,
          name: userName,
          displayName: userName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' as const }, // ES256
          { alg: -257, type: 'public-key' as const }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'cross-platform' as const, // External security key
          requireResidentKey: false,
          userVerification: 'discouraged' as const, // U2F keys do not support UV
        },
        timeout: 60000,
        attestation: 'direct' as const,
      };

      const credential = await startRegistration(registrationOptions);

      return {
        id: crypto.randomUUID(),
        credentialId: credential.id,
        publicKey: credential.response.publicKey || '',
        counter: 0,
        createdAt: Date.now(),
        deviceName: 'Security Key',
      };
    } catch (error) {
      console.error('Security key registration failed:', error);
      throw new Error('Failed to register security key');
    }
  }

  /**
   * Check if WebAuthn is supported
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' &&
           window.PublicKeyCredential !== undefined &&
           typeof window.PublicKeyCredential === 'function';
  }

  /**
   * Check if platform authenticator (Touch ID, Face ID, Windows Hello) is available
   */
  static async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Check if conditional UI is supported (autofill)
   */
  static async isConditionalMediationAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      return await PublicKeyCredential.isConditionalMediationAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Generate random challenge
   */
  private static generateChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Parse authenticator data
   */
  static parseAuthenticatorData(data: string): {
    rpIdHash: string;
    flags: {
      userPresent: boolean;
      userVerified: boolean;
      backupEligible: boolean;
      backupState: boolean;
    };
    counter: number;
  } {
    const buffer = Uint8Array.from(atob(data), c => c.charCodeAt(0));

    return {
      rpIdHash: btoa(String.fromCharCode(...buffer.slice(0, 32))),
      flags: {
        userPresent: !!(buffer[32] & 0x01),
        userVerified: !!(buffer[32] & 0x04),
        backupEligible: !!(buffer[32] & 0x08),
        backupState: !!(buffer[32] & 0x10),
      },
      counter: new DataView(buffer.buffer, 33, 4).getUint32(0, false),
    };
  }
}
