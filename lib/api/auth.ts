/**
 * Authentication API module
 */

import { api, ApiError, ApiResponse } from './client';
import { EncryptedStorage } from '../storage/encrypted-storage';
import { Blake3Crypto } from '../crypto/blake3';
import { WebAuthnManager, PasskeyCredential } from '../auth/webauthn';

/**
 * Auth response interfaces
 */
export interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  profileImage?: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
  encryptionKey?: string;
}

export interface RegisterResponse {
  user: AuthUser;
  tokens: AuthTokens;
  encryptionKey: string;
}

export interface PasskeyLoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
  credentialId: string;
}

/**
 * Registration data
 */
export interface RegisterData {
  email: string;
  password: string;
  displayName?: string;
  acceptTerms: boolean;
}

/**
 * Login data
 */
export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Password reset request
 */
export interface ResetPasswordData {
  token: string;
  password: string;
  confirmPassword: string;
}

/**
 * Auth API client
 */
export const authApi = {
  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<ApiResponse<RegisterResponse>> {
    // Hash password before sending (additional client-side security)
    const passwordHash = Blake3Crypto.hash(data.password);

    const response = await api.post<RegisterResponse>('/auth/register', {
      email: data.email.toLowerCase().trim(),
      passwordHash,
      displayName: data.displayName?.trim(),
      acceptTerms: data.acceptTerms,
    }, { skipAuth: true });

    if (response.ok && response.data) {
      // Create local session
      const { user, tokens, encryptionKey } = response.data;

      await EncryptedStorage.createSession(user.id, encryptionKey, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        rememberMe: false,
      });
    }

    return response;
  },

  /**
   * Login with email and password
   */
  async login(data: LoginData): Promise<ApiResponse<LoginResponse>> {
    // Hash password before sending
    const passwordHash = Blake3Crypto.hash(data.password);

    const response = await api.post<LoginResponse>('/auth/login', {
      email: data.email.toLowerCase().trim(),
      passwordHash,
    }, { skipAuth: true });

    if (response.ok && response.data) {
      const { user, tokens, encryptionKey } = response.data;

      // Derive encryption key from password if not provided by server
      const localKey = encryptionKey || Blake3Crypto.deriveKey(data.password, user.id);

      await EncryptedStorage.createSession(user.id, localKey, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        rememberMe: data.rememberMe,
      });
    }

    return response;
  },

  /**
   * Login with passkey (WebAuthn)
   */
  async loginWithPasskey(): Promise<ApiResponse<PasskeyLoginResponse>> {
    // Check if WebAuthn is supported
    const webauthnSupported = typeof window !== 'undefined' &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function';
    if (!webauthnSupported) {
      throw new ApiError('WebAuthn is not supported on this device', 400, 'WEBAUTHN_NOT_SUPPORTED');
    }

    // Get authentication options from server
    const optionsResponse = await api.get<{
      challenge: string;
      rpId: string;
      allowCredentials?: { id: string; type: string }[];
      userVerification: string;
      timeout: number;
    }>('/auth/passkey/options', { skipAuth: true });

    if (!optionsResponse.ok) {
      throw new ApiError('Failed to get authentication options', 500, 'OPTIONS_FAILED');
    }

    // Perform WebAuthn authentication
    const allowedCredentials = optionsResponse.data.allowCredentials?.map(c => c.id);
    const assertion = await WebAuthnManager.authenticateWithPasskey(allowedCredentials);

    // Verify with server
    const response = await api.post<PasskeyLoginResponse>('/auth/passkey/verify', {
      credentialId: assertion.credentialId,
      authenticatorData: assertion.authenticatorData,
      clientDataJSON: assertion.clientDataJSON,
      signature: assertion.signature,
    }, { skipAuth: true });

    if (response.ok && response.data) {
      const { user, tokens, credentialId } = response.data;

      // Update passkey counter locally
      await EncryptedStorage.updatePasskeyCounter(credentialId, Date.now());

      // Derive encryption key from credential ID
      const encryptionKey = Blake3Crypto.hash(`passkey:${credentialId}:${user.id}`);

      await EncryptedStorage.createSession(user.id, encryptionKey, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        rememberMe: true, // Passkey logins are typically remembered
      });
    }

    return response;
  },

  /**
   * Register a new passkey for the current user
   */
  async registerPasskey(): Promise<ApiResponse<PasskeyCredential>> {
    // Check if WebAuthn is supported
    const webauthnSupported = typeof window !== 'undefined' &&
      window.PublicKeyCredential !== undefined &&
      typeof window.PublicKeyCredential === 'function';
    if (!webauthnSupported) {
      throw new ApiError('WebAuthn is not supported on this device', 400, 'WEBAUTHN_NOT_SUPPORTED');
    }

    // Get user info and registration options from server
    const optionsResponse = await api.get<{
      user: { id: string; name: string; displayName: string };
      challenge: string;
      excludeCredentials?: { id: string; type: string }[];
    }>('/auth/passkey/register/options');

    if (!optionsResponse.ok) {
      throw new ApiError('Failed to get registration options', 500, 'OPTIONS_FAILED');
    }

    const { user } = optionsResponse.data;

    // Perform WebAuthn registration
    const credential = await WebAuthnManager.registerPasskey(
      user.id,
      user.name,
      user.displayName
    );

    // Send credential to server for storage
    const response = await api.post<PasskeyCredential>('/auth/passkey/register/complete', {
      credentialId: credential.credentialId,
      publicKey: credential.publicKey,
      counter: credential.counter,
      deviceName: credential.deviceName,
    });

    if (response.ok && response.data) {
      // Store passkey locally
      await EncryptedStorage.storePasskey({
        id: response.data.id,
        credentialId: response.data.credentialId,
        publicKey: response.data.publicKey,
        counter: response.data.counter,
        createdAt: Date.now(),
        deviceName: credential.deviceName,
      });
    }

    return response;
  },

  /**
   * Logout (invalidate session)
   */
  async logout(): Promise<void> {
    try {
      // Notify server (best effort)
      await api.post('/auth/logout', {}, { retry: false });
    } catch {
      // Ignore server errors - we're logging out anyway
    } finally {
      // Clear local session
      await EncryptedStorage.endSession();
    }
  },

  /**
   * Logout from all devices
   */
  async logoutAll(): Promise<void> {
    try {
      await api.post('/auth/logout/all', {});
    } catch {
      // Ignore server errors
    } finally {
      const session = await EncryptedStorage.getCurrentSession();
      if (session) {
        await EncryptedStorage.endAllSessions(session.userId);
      }
    }
  },

  /**
   * Request password reset email
   */
  async requestPasswordReset(email: string): Promise<ApiResponse<{ message: string }>> {
    return api.post('/auth/password/reset/request', {
      email: email.toLowerCase().trim(),
    }, { skipAuth: true });
  },

  /**
   * Reset password with token
   */
  async resetPassword(data: ResetPasswordData): Promise<ApiResponse<{ message: string }>> {
    if (data.password !== data.confirmPassword) {
      throw new ApiError('Passwords do not match', 400, 'PASSWORDS_MISMATCH');
    }

    const passwordHash = Blake3Crypto.hash(data.password);

    return api.post('/auth/password/reset/complete', {
      token: data.token,
      passwordHash,
    }, { skipAuth: true });
  },

  /**
   * Change password (authenticated)
   */
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<{ message: string }>> {
    const currentHash = Blake3Crypto.hash(currentPassword);
    const newHash = Blake3Crypto.hash(newPassword);

    return api.post('/auth/password/change', {
      currentPasswordHash: currentHash,
      newPasswordHash: newHash,
    });
  },

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<ApiResponse<{ message: string }>> {
    return api.post('/auth/email/verify', { token }, { skipAuth: true });
  },

  /**
   * Resend verification email
   */
  async resendVerificationEmail(): Promise<ApiResponse<{ message: string }>> {
    return api.post('/auth/email/resend', {});
  },

  /**
   * Check if email is available
   */
  async checkEmailAvailability(email: string): Promise<ApiResponse<{ available: boolean }>> {
    return api.get('/auth/email/check', {
      params: { email: email.toLowerCase().trim() },
      skipAuth: true,
    });
  },

  /**
   * Get current authentication status
   */
  async getAuthStatus(): Promise<ApiResponse<{ authenticated: boolean; user?: AuthUser }>> {
    return api.get('/auth/status');
  },

  /**
   * Check if user is authenticated (local check)
   */
  isAuthenticated(): boolean {
    return EncryptedStorage.isAuthenticated();
  },

  /**
   * Refresh session activity
   */
  async refreshActivity(): Promise<void> {
    await EncryptedStorage.updateSessionActivity();
  },
};

export default authApi;
