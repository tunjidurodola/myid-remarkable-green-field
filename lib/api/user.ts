/**
 * User API module - Profile, MasterCode, and TrustCodes management
 */

import { api, ApiResponse } from './client';
import { EncryptedStorage } from '../storage/encrypted-storage';
import { Blake3Crypto, PIIData, MasterCodeResult, TrustCodeResult } from '../crypto/blake3';

/**
 * User profile data
 */
export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  profileImage?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  preferences: {
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    privacy: {
      showProfile: boolean;
      shareData: boolean;
    };
  };
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
  };
  stats: {
    trustCodesGenerated: number;
    verificationsCompleted: number;
    lastActivityAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Profile update data
 */
export interface ProfileUpdateData {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  preferences?: Partial<UserProfile['preferences']>;
}

/**
 * MasterCode data stored on server (encrypted references only)
 */
export interface StoredMasterCode {
  id: string;
  hash_b3_160: string; // Truncated hash for verification
  createdAt: string;
  lastUsedAt?: string;
  status: 'active' | 'revoked';
}

/**
 * TrustCode data
 */
export interface TrustCode {
  id: string;
  code: string;
  label?: string;
  createdAt: string;
  expiresAt?: string;
  usageCount: number;
  maxUsage?: number;
  status: 'active' | 'expired' | 'revoked';
}

/**
 * TrustCode creation request
 */
export interface CreateTrustCodeRequest {
  label?: string;
  expiresIn?: number; // Duration in seconds
  maxUsage?: number;
}

/**
 * User API client
 */
export const userApi = {
  /**
   * Get current user's profile
   */
  async getProfile(): Promise<ApiResponse<UserProfile>> {
    return api.get<UserProfile>('/user/profile');
  },

  /**
   * Update user profile
   */
  async updateProfile(data: ProfileUpdateData): Promise<ApiResponse<UserProfile>> {
    return api.patch<UserProfile>('/user/profile', data);
  },

  /**
   * Upload profile image
   */
  async uploadProfileImage(file: File): Promise<ApiResponse<{ imageUrl: string }>> {
    const formData = new FormData();
    formData.append('image', file);

    const token = EncryptedStorage.getAccessToken();
    const response = await fetch('/api/user/profile/image', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to upload image');
    }

    return {
      data,
      status: response.status,
      headers: response.headers,
      ok: true,
    };
  },

  /**
   * Delete profile image
   */
  async deleteProfileImage(): Promise<ApiResponse<{ message: string }>> {
    return api.delete('/user/profile/image');
  },

  /**
   * Generate MasterCode from PII data
   * Note: PII data is hashed client-side and only the hash is sent to server
   */
  async generateMasterCode(piiData: PIIData): Promise<{
    localResult: MasterCodeResult;
    serverResponse: ApiResponse<StoredMasterCode>;
  }> {
    // Generate MasterCode locally
    const localResult = Blake3Crypto.generateMasterCode(piiData);

    // Store encrypted PII locally
    const encryptionKey = EncryptedStorage.getEncryptionKey();
    if (encryptionKey) {
      await EncryptedStorage.storeUserData('pii', piiData, encryptionKey);
    }

    // Send only the truncated hash to server for storage/verification
    const serverResponse = await api.post<StoredMasterCode>('/user/mastercode', {
      hash_b3_160: localResult.hash_b3_160,
    });

    return {
      localResult,
      serverResponse,
    };
  },

  /**
   * Get MasterCode status from server
   */
  async getMasterCode(): Promise<ApiResponse<StoredMasterCode | null>> {
    return api.get<StoredMasterCode | null>('/user/mastercode');
  },

  /**
   * Verify a MasterCode hash (check if it matches the stored one)
   */
  async verifyMasterCode(hash_b3_160: string): Promise<ApiResponse<{ valid: boolean }>> {
    return api.post('/user/mastercode/verify', { hash_b3_160 });
  },

  /**
   * Revoke current MasterCode (requires new identity verification)
   */
  async revokeMasterCode(): Promise<ApiResponse<{ message: string }>> {
    return api.post('/user/mastercode/revoke', {});
  },

  /**
   * Generate a TrustCode from the local MasterCode
   */
  async generateTrustCode(options?: CreateTrustCodeRequest): Promise<{
    localResult: TrustCodeResult;
    serverResponse: ApiResponse<TrustCode>;
  }> {
    // Get local MasterCode
    const encryptionKey = EncryptedStorage.getEncryptionKey();
    if (!encryptionKey) {
      throw new Error('No encryption key available');
    }

    const piiData = await EncryptedStorage.getUserData('pii', encryptionKey);
    if (!piiData) {
      throw new Error('PII data not found - please generate MasterCode first');
    }

    // Regenerate MasterCode from stored PII
    const masterCodeResult = Blake3Crypto.generateMasterCode(piiData);

    // Generate TrustCode locally
    const localResult = Blake3Crypto.generateTrustCode(masterCodeResult.masterCode);

    // Register TrustCode with server
    const serverResponse = await api.post<TrustCode>('/user/trustcodes', {
      trustCode: localResult.trustCode,
      entropy: localResult.entropy, // Encrypted before sending
      label: options?.label,
      expiresIn: options?.expiresIn,
      maxUsage: options?.maxUsage,
    });

    return {
      localResult,
      serverResponse,
    };
  },

  /**
   * Get all TrustCodes for the current user
   */
  async getTrustCodes(): Promise<ApiResponse<TrustCode[]>> {
    return api.get<TrustCode[]>('/user/trustcodes');
  },

  /**
   * Get a specific TrustCode
   */
  async getTrustCode(id: string): Promise<ApiResponse<TrustCode>> {
    return api.get<TrustCode>(`/user/trustcodes/${id}`);
  },

  /**
   * Update TrustCode label
   */
  async updateTrustCode(
    id: string,
    data: { label?: string }
  ): Promise<ApiResponse<TrustCode>> {
    return api.patch<TrustCode>(`/user/trustcodes/${id}`, data);
  },

  /**
   * Revoke a TrustCode
   */
  async revokeTrustCode(id: string): Promise<ApiResponse<{ message: string }>> {
    return api.post(`/user/trustcodes/${id}/revoke`, {});
  },

  /**
   * Delete a TrustCode
   */
  async deleteTrustCode(id: string): Promise<ApiResponse<{ message: string }>> {
    return api.delete(`/user/trustcodes/${id}`);
  },

  /**
   * Verify a TrustCode (public endpoint for verifiers)
   */
  async verifyTrustCode(trustCode: string): Promise<ApiResponse<{
    valid: boolean;
    userId?: string;
    hash_b3_160?: string;
    expiresAt?: string;
  }>> {
    return api.post('/verify/trustcode', { trustCode }, { skipAuth: true });
  },

  /**
   * Get verification history
   */
  async getVerificationHistory(params?: {
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<{
    items: Array<{
      id: string;
      verifierName: string;
      verifierDomain: string;
      claimsVerified: string[];
      timestamp: string;
      status: 'success' | 'failed';
    }>;
    total: number;
  }>> {
    return api.get('/user/verifications', { params });
  },

  /**
   * Get consent history
   */
  async getConsentHistory(params?: {
    limit?: number;
    offset?: number;
    status?: 'approved' | 'denied' | 'revoked';
  }): Promise<ApiResponse<{
    items: Array<{
      id: string;
      rpName: string;
      rpDomain: string;
      claims: string[];
      grantedAt: string;
      expiresAt?: string;
      status: 'approved' | 'denied' | 'revoked';
    }>;
    total: number;
  }>> {
    return api.get('/user/consents', { params });
  },

  /**
   * Revoke a consent
   */
  async revokeConsent(consentId: string): Promise<ApiResponse<{ message: string }>> {
    return api.post(`/user/consents/${consentId}/revoke`, {});
  },

  /**
   * Get passkeys for the current user
   */
  async getPasskeys(): Promise<ApiResponse<Array<{
    id: string;
    deviceName?: string;
    createdAt: string;
    lastUsedAt?: string;
  }>>> {
    return api.get('/user/passkeys');
  },

  /**
   * Delete a passkey
   */
  async deletePasskey(passkeyId: string): Promise<ApiResponse<{ message: string }>> {
    // Delete from server
    const response = await api.delete<{ message: string }>(`/user/passkeys/${passkeyId}`);

    if (response.ok) {
      // Delete locally
      await EncryptedStorage.deletePasskey(passkeyId);
    }

    return response;
  },

  /**
   * Get user's trusted emails
   */
  async getTrustedEmails(): Promise<ApiResponse<Array<{
    id: string;
    email: string;
    label?: string;
    verified: boolean;
    isPrimary: boolean;
    addedAt: string;
  }>>> {
    return api.get('/user/emails');
  },

  /**
   * Add a trusted email
   */
  async addTrustedEmail(
    email: string,
    label?: string
  ): Promise<ApiResponse<{ id: string; verificationSent: boolean }>> {
    return api.post('/user/emails', { email: email.toLowerCase().trim(), label });
  },

  /**
   * Remove a trusted email
   */
  async removeTrustedEmail(emailId: string): Promise<ApiResponse<{ message: string }>> {
    return api.delete(`/user/emails/${emailId}`);
  },

  /**
   * Set an email as primary
   */
  async setPrimaryEmail(emailId: string): Promise<ApiResponse<{ message: string }>> {
    return api.post(`/user/emails/${emailId}/primary`, {});
  },

  /**
   * Delete user account
   */
  async deleteAccount(password: string): Promise<ApiResponse<{ message: string }>> {
    const passwordHash = Blake3Crypto.hash(password);

    const response = await api.post<{ message: string }>('/user/delete', { passwordHash });

    if (response.ok) {
      // Clear all local data
      await EncryptedStorage.clearAll();
    }

    return response;
  },

  /**
   * Export user data (GDPR compliance)
   */
  async exportData(): Promise<ApiResponse<{
    downloadUrl: string;
    expiresAt: string;
  }>> {
    return api.post('/user/export', {});
  },
};

export default userApi;
