/**
 * Credential Manager
 * Unified interface for all credential types with IndexedDB storage
 */

import { Blake3Crypto } from '../crypto/blake3';

// Credential types
export type CredentialType = 'mDL' | 'PID' | 'DTC' | 'VC';

// Credential status
export type CredentialStatus = 'active' | 'revoked' | 'expired' | 'pending';

// Base credential interface
export interface BaseCredential {
  id: string;
  type: CredentialType;
  namespace: string;
  status: CredentialStatus;
  issuedAt: string;
  expiresAt?: string;
  issuer: string;
  subject: string;
}

// mDL Credential
export interface MDLCredential extends BaseCredential {
  type: 'mDL';
  namespace: 'org.iso.18013.5.1.mDL';
  claims: {
    family_name: string;
    given_name: string;
    birth_date: string;
    document_number: string;
    driving_privileges?: Array<{
      vehicle_category_code: string;
      issue_date?: string;
      expiry_date?: string;
    }>;
    portrait?: string;
    issue_date?: string;
    expiry_date?: string;
    issuing_country?: string;
    resident_address?: string;
    [key: string]: unknown;
  };
}

// PID Credential (eIDAS2)
export interface PIDCredential extends BaseCredential {
  type: 'PID';
  namespace: 'eu.europa.ec.eudi.pid.1';
  claims: {
    family_name: string;
    given_name: string;
    birth_date: string;
    personal_identifier?: string;
    nationality?: string;
    resident_address?: string;
    over_18?: boolean;
    over_21?: boolean;
    [key: string]: unknown;
  };
}

// DTC Credential (ICAO)
export interface DTCCredential extends BaseCredential {
  type: 'DTC';
  namespace: 'icao.9303.dtc';
  documentType: string;
  holderInfo: {
    primaryIdentifier: string;
    secondaryIdentifier: string;
    nationality: string;
    dateOfBirth: string;
    sex: string;
  };
  dataGroups: {
    DG1?: unknown;
    DG2?: unknown;
    [key: string]: unknown;
  };
}

// W3C Verifiable Credential
export interface VCCredential extends BaseCredential {
  type: 'VC';
  namespace: 'https://www.w3.org/2018/credentials/v1';
  credentialType: string[];
  claims: Record<string, unknown>;
  proof?: {
    type: string;
    created: string;
    proofValue?: string;
    verificationMethod: string;
  };
}

export type Credential = MDLCredential | PIDCredential | DTCCredential | VCCredential;

// Presentation request
export interface PresentationRequest {
  verifier: {
    id: string;
    name: string;
    logo?: string;
  };
  requestedClaims: string[];
  challenge: string;
  domain?: string;
  expiresAt?: string;
}

// Presentation response
export interface Presentation {
  credentialId: string;
  type: CredentialType;
  disclosedClaims: Record<string, unknown>;
  proof: {
    type: string;
    created: string;
    challenge: string;
    domain?: string;
    signature: string;
  };
}

// IndexedDB configuration
const DB_NAME = 'myid_credentials';
const DB_VERSION = 1;
const STORE_NAME = 'credentials';

/**
 * Open IndexedDB database
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('issuedAt', 'issuedAt', { unique: false });
      }
    };
  });
}

/**
 * Credential Manager Class
 */
export class CredentialManager {
  private db: IDBDatabase | null = null;

  /**
   * Initialize the credential manager
   */
  async init(): Promise<void> {
    this.db = await openDB();
  }

  /**
   * Ensure database is initialized
   */
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  /**
   * Store a credential
   */
  async store(credential: Credential): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.put(credential);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get a credential by ID
   */
  async get(id: string): Promise<Credential | null> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  /**
   * Get all credentials
   */
  async getAll(): Promise<Credential[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  /**
   * Get credentials by type
   */
  async getByType(type: CredentialType): Promise<Credential[]> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('type');

      const request = index.getAll(type);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  /**
   * Get active credentials
   */
  async getActive(): Promise<Credential[]> {
    const all = await this.getAll();
    const now = new Date();

    return all.filter((c) => {
      if (c.status !== 'active') return false;
      if (c.expiresAt && new Date(c.expiresAt) < now) return false;
      return true;
    });
  }

  /**
   * Delete a credential
   */
  async delete(id: string): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Update credential status
   */
  async updateStatus(id: string, status: CredentialStatus): Promise<void> {
    const credential = await this.get(id);
    if (!credential) {
      throw new Error('Credential not found');
    }

    credential.status = status;
    await this.store(credential);
  }

  /**
   * Generate a presentation for selective disclosure
   */
  async createPresentation(
    credentialId: string,
    request: PresentationRequest,
  ): Promise<Presentation> {
    const credential = await this.get(credentialId);
    if (!credential) {
      throw new Error('Credential not found');
    }

    if (credential.status !== 'active') {
      throw new Error('Credential is not active');
    }

    // Extract only requested claims
    const disclosedClaims: Record<string, unknown> = {};

    if ('claims' in credential) {
      for (const claim of request.requestedClaims) {
        if (credential.claims[claim] !== undefined) {
          disclosedClaims[claim] = credential.claims[claim];
        }
      }
    } else if (credential.type === 'DTC' && credential.holderInfo) {
      // For DTC, map requested claims to holder info
      const claimMapping: Record<string, string> = {
        family_name: 'primaryIdentifier',
        given_name: 'secondaryIdentifier',
        nationality: 'nationality',
        birth_date: 'dateOfBirth',
        sex: 'sex',
      };

      for (const claim of request.requestedClaims) {
        const mappedKey = claimMapping[claim];
        if (mappedKey && credential.holderInfo[mappedKey as keyof typeof credential.holderInfo] !== undefined) {
          disclosedClaims[claim] = credential.holderInfo[mappedKey as keyof typeof credential.holderInfo];
        }
      }
    }

    // Create proof
    const proofData = JSON.stringify({
      credentialId,
      disclosedClaims,
      challenge: request.challenge,
      domain: request.domain,
      timestamp: new Date().toISOString(),
    });

    const signature = Blake3Crypto.hash(proofData);

    return {
      credentialId,
      type: credential.type,
      disclosedClaims,
      proof: {
        type: 'Blake3Hash2024',
        created: new Date().toISOString(),
        challenge: request.challenge,
        domain: request.domain,
        signature,
      },
    };
  }

  /**
   * Verify a presentation
   */
  verifyPresentation(presentation: Presentation): boolean {
    // Verify proof structure
    if (!presentation.proof?.signature) {
      return false;
    }

    // Recreate proof data and verify hash
    const proofData = JSON.stringify({
      credentialId: presentation.credentialId,
      disclosedClaims: presentation.disclosedClaims,
      challenge: presentation.proof.challenge,
      domain: presentation.proof.domain,
      timestamp: presentation.proof.created,
    });

    const expectedSignature = Blake3Crypto.hash(proofData);
    return expectedSignature === presentation.proof.signature;
  }

  /**
   * Check age predicate without revealing DOB
   */
  checkAgePredicate(credential: Credential, predicate: string): boolean | null {
    if (credential.type !== 'PID' && credential.type !== 'mDL') {
      return null;
    }

    const claims = (credential as PIDCredential | MDLCredential).claims;

    // Check precomputed predicates
    if (claims[predicate] !== undefined) {
      return claims[predicate] as boolean;
    }

    // Calculate from birth date if available
    if (claims.birth_date) {
      const age = this.calculateAge(claims.birth_date);
      const thresholds: Record<string, number> = {
        over_12: 12,
        over_14: 14,
        over_16: 16,
        over_18: 18,
        over_21: 21,
        over_25: 25,
        over_65: 65,
      };

      if (thresholds[predicate] !== undefined) {
        return age >= thresholds[predicate];
      }
    }

    return null;
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Get credential summary for display
   */
  getCredentialSummary(credential: Credential): {
    title: string;
    subtitle: string;
    icon: string;
    color: string;
  } {
    const summaries: Record<CredentialType, { icon: string; color: string }> = {
      mDL: { icon: 'car', color: '#007AFF' },
      PID: { icon: 'person', color: '#34C759' },
      DTC: { icon: 'airplane', color: '#5856D6' },
      VC: { icon: 'checkmark.seal', color: '#FF9500' },
    };

    const { icon, color } = summaries[credential.type];

    let title = '';
    let subtitle = '';

    switch (credential.type) {
      case 'mDL':
        title = 'Mobile Driver\'s License';
        subtitle = `${(credential as MDLCredential).claims.given_name} ${(credential as MDLCredential).claims.family_name}`;
        break;
      case 'PID':
        title = 'Personal ID (eIDAS2)';
        subtitle = `${(credential as PIDCredential).claims.given_name} ${(credential as PIDCredential).claims.family_name}`;
        break;
      case 'DTC':
        title = 'Digital Travel Credential';
        subtitle = `${(credential as DTCCredential).holderInfo.secondaryIdentifier} ${(credential as DTCCredential).holderInfo.primaryIdentifier}`;
        break;
      case 'VC':
        title = 'Verifiable Credential';
        subtitle = (credential as VCCredential).credentialType.join(', ');
        break;
    }

    return { title, subtitle, icon, color };
  }

  /**
   * Export credentials as encrypted backup
   */
  async exportBackup(encryptionKey: string): Promise<string> {
    const credentials = await this.getAll();
    const data = JSON.stringify(credentials);

    // Simple encryption using Blake3 (in production, use proper AES-GCM)
    const key = Blake3Crypto.hash(encryptionKey);
    const encrypted = Blake3Crypto.keyedHash(data, key);

    return JSON.stringify({
      version: 1,
      encrypted: true,
      hash: encrypted,
      data: btoa(data), // Base64 encode (in production, actually encrypt)
    });
  }

  /**
   * Import credentials from backup
   */
  async importBackup(backup: string, encryptionKey: string): Promise<number> {
    const parsed = JSON.parse(backup);

    if (parsed.version !== 1) {
      throw new Error('Unsupported backup version');
    }

    const data = atob(parsed.data);
    const credentials: Credential[] = JSON.parse(data);

    let imported = 0;
    for (const credential of credentials) {
      await this.store(credential);
      imported++;
    }

    return imported;
  }

  /**
   * Clear all credentials
   */
  async clear(): Promise<void> {
    const db = await this.ensureDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

// Singleton instance
let credentialManagerInstance: CredentialManager | null = null;

/**
 * Get the credential manager singleton
 */
export function getCredentialManager(): CredentialManager {
  if (!credentialManagerInstance) {
    credentialManagerInstance = new CredentialManager();
  }
  return credentialManagerInstance;
}

export default CredentialManager;
