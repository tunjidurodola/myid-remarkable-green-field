/**
 * Lib module exports
 */

// API
export * from './api';

// Crypto
export { Blake3Crypto, type PIIData, type MasterCodeResult, type TrustCodeResult } from './crypto/blake3';

// Auth
export { WebAuthnManager, type PasskeyCredential } from './auth/webauthn';

// Storage
export {
  EncryptedStorage,
  type SessionData,
  type StoredPasskey,
} from './storage/encrypted-storage';

// Design tokens
export { authTokens, designTokens, type AuthTokens as AuthTokensType, type DesignTokens } from './design-tokens';

// Constants
export * from './constants';
