/**
 * Frontend mDL Manager
 * Handles mDL credential management, device engagement parsing,
 * presentation token generation, and selective disclosure UI state
 */

import { Blake3Crypto } from '../crypto/blake3';

// ISO 18013-5 Namespaces
export const MDL_NAMESPACES = {
  MDL: 'org.iso.18013.5.1.mDL',
  AAMVA: 'org.iso.18013.5.1.aamva',
  POCKETONE: 'com.pocketone.claims',
} as const;

// Data element definitions with display metadata
export const MDL_ELEMENTS = {
  family_name: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Family Name',
    category: 'identity',
    sensitive: false,
  },
  given_name: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Given Name',
    category: 'identity',
    sensitive: false,
  },
  birth_date: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Date of Birth',
    category: 'identity',
    sensitive: true,
  },
  issue_date: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Issue Date',
    category: 'document',
    sensitive: false,
  },
  expiry_date: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Expiry Date',
    category: 'document',
    sensitive: false,
  },
  issuing_country: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Issuing Country',
    category: 'document',
    sensitive: false,
  },
  issuing_authority: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Issuing Authority',
    category: 'document',
    sensitive: false,
  },
  document_number: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Document Number',
    category: 'document',
    sensitive: true,
  },
  portrait: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Portrait Photo',
    category: 'biometric',
    sensitive: true,
  },
  driving_privileges: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Driving Privileges',
    category: 'license',
    sensitive: false,
  },
  age_over_18: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Over 18',
    category: 'age',
    sensitive: false,
  },
  age_over_21: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Over 21',
    category: 'age',
    sensitive: false,
  },
  resident_address: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Address',
    category: 'address',
    sensitive: true,
  },
  resident_city: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'City',
    category: 'address',
    sensitive: false,
  },
  resident_state: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'State/Province',
    category: 'address',
    sensitive: false,
  },
  resident_postal_code: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Postal Code',
    category: 'address',
    sensitive: false,
  },
  nationality: {
    namespace: MDL_NAMESPACES.MDL,
    label: 'Nationality',
    category: 'identity',
    sensitive: false,
  },
} as const;

// Type definitions
export interface MDLCredential {
  credentialId: string;
  docType: string;
  namespaces: Record<string, Record<string, any>>;
  issuerAuth: {
    signature: string;
    certificate: string;
    algorithm: string;
  };
  merkleRoot: string;
  status: 'active' | 'expired' | 'revoked';
  issueDate: string;
  expiryDate: string;
}

export interface DeviceEngagement {
  version: string;
  sessionId: string;
  deviceKey: {
    kty: string;
    crv: string;
    x: string;
    y: string;
  };
  security: {
    cipherSuite: number;
    readerKeyRequired: boolean;
  };
  originInfos?: Array<{ cat: number; type: number }>;
  timestamp: string;
}

export interface PresentationRequest {
  requestId: string;
  rpId: string;
  rpName: string;
  rpLogo?: string;
  requestedElements: string[];
  purpose: string;
  intentToRetain: boolean;
  nonce: string;
  expiresAt: string;
}

export interface SelectiveDisclosureState {
  requestId: string;
  credential: MDLCredential | null;
  availableElements: string[];
  selectedElements: string[];
  requestedElements: string[];
  predicates: Array<{ type: string; claim?: string; threshold?: number }>;
}

/**
 * Parse device engagement from QR code data
 */
export function parseDeviceEngagement(qrData: string): DeviceEngagement {
  if (!qrData.startsWith('mdoc://')) {
    throw new Error('Invalid mDL QR code format - must start with mdoc://');
  }

  try {
    const base64Data = qrData.slice(7);
    const decoded = atob(base64Data.replace(/-/g, '+').replace(/_/g, '/'));

    // Parse the decoded data (simplified - in production use proper CBOR decoder)
    const engagement = JSON.parse(decoded);

    return engagement as DeviceEngagement;
  } catch (error) {
    throw new Error(`Failed to parse device engagement: ${error}`);
  }
}

/**
 * Generate device engagement QR data
 */
export function generateEngagementQR(sessionId: string): string {
  const engagement: DeviceEngagement = {
    version: '1.0',
    sessionId,
    deviceKey: {
      kty: 'EC',
      crv: 'P-256',
      x: Blake3Crypto.generateRandomBytes(32),
      y: Blake3Crypto.generateRandomBytes(32),
    },
    security: {
      cipherSuite: 1,
      readerKeyRequired: false,
    },
    timestamp: new Date().toISOString(),
  };

  const encoded = btoa(JSON.stringify(engagement))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `mdoc://${encoded}`;
}

/**
 * mDL Manager class for handling credentials and presentations
 */
export class MDLManager {
  private credentials: Map<string, MDLCredential> = new Map();
  private disclosureState: SelectiveDisclosureState | null = null;

  /**
   * Load credentials from storage
   */
  async loadCredentials(): Promise<MDLCredential[]> {
    const stored = localStorage.getItem('myid_mdl_credentials');
    if (stored) {
      const creds = JSON.parse(stored) as MDLCredential[];
      creds.forEach(c => this.credentials.set(c.credentialId, c));
      return creds;
    }
    return [];
  }

  /**
   * Save credentials to storage
   */
  private saveCredentials(): void {
    const creds = Array.from(this.credentials.values());
    localStorage.setItem('myid_mdl_credentials', JSON.stringify(creds));
  }

  /**
   * Add a credential
   */
  addCredential(credential: MDLCredential): void {
    this.credentials.set(credential.credentialId, credential);
    this.saveCredentials();
  }

  /**
   * Get credential by ID
   */
  getCredential(credentialId: string): MDLCredential | undefined {
    return this.credentials.get(credentialId);
  }

  /**
   * Get all credentials
   */
  getAllCredentials(): MDLCredential[] {
    return Array.from(this.credentials.values());
  }

  /**
   * Get active credentials (not expired or revoked)
   */
  getActiveCredentials(): MDLCredential[] {
    const now = new Date();
    return this.getAllCredentials().filter(c => {
      if (c.status !== 'active') return false;
      if (new Date(c.expiryDate) < now) return false;
      return true;
    });
  }

  /**
   * Remove a credential
   */
  removeCredential(credentialId: string): boolean {
    const removed = this.credentials.delete(credentialId);
    if (removed) {
      this.saveCredentials();
    }
    return removed;
  }

  /**
   * Get available elements from a credential
   */
  getAvailableElements(credentialId: string): string[] {
    const credential = this.credentials.get(credentialId);
    if (!credential) return [];

    const elements: string[] = [];
    for (const [ns, nsElements] of Object.entries(credential.namespaces)) {
      for (const key of Object.keys(nsElements)) {
        elements.push(`${ns}.${key}`);
      }
    }
    return elements;
  }

  /**
   * Initialize selective disclosure state
   */
  initializeDisclosure(
    request: PresentationRequest,
    credentialId: string
  ): SelectiveDisclosureState {
    const credential = this.credentials.get(credentialId);
    const availableElements = this.getAvailableElements(credentialId);

    this.disclosureState = {
      requestId: request.requestId,
      credential: credential || null,
      availableElements,
      selectedElements: [],
      requestedElements: request.requestedElements,
      predicates: [],
    };

    return this.disclosureState;
  }

  /**
   * Get current disclosure state
   */
  getDisclosureState(): SelectiveDisclosureState | null {
    return this.disclosureState;
  }

  /**
   * Toggle element selection
   */
  toggleElementSelection(element: string): void {
    if (!this.disclosureState) return;

    const index = this.disclosureState.selectedElements.indexOf(element);
    if (index === -1) {
      this.disclosureState.selectedElements.push(element);
    } else {
      this.disclosureState.selectedElements.splice(index, 1);
    }
  }

  /**
   * Select all requested elements
   */
  selectAllRequested(): void {
    if (!this.disclosureState) return;

    this.disclosureState.selectedElements = [
      ...this.disclosureState.requestedElements,
    ];
  }

  /**
   * Select minimum required elements
   */
  selectMinimum(): void {
    if (!this.disclosureState) return;

    // Select only mandatory requested elements
    this.disclosureState.selectedElements =
      this.disclosureState.requestedElements.filter(el => {
        const [, key] = el.split('.');
        return MDL_ELEMENTS[key as keyof typeof MDL_ELEMENTS]?.sensitive === false;
      });
  }

  /**
   * Clear selection
   */
  clearSelection(): void {
    if (!this.disclosureState) return;
    this.disclosureState.selectedElements = [];
  }

  /**
   * Add predicate proof
   */
  addPredicate(predicate: { type: string; claim?: string; threshold?: number }): void {
    if (!this.disclosureState) return;
    this.disclosureState.predicates.push(predicate);
  }

  /**
   * Clear disclosure state
   */
  clearDisclosureState(): void {
    this.disclosureState = null;
  }

  /**
   * Generate presentation token
   */
  generatePresentationToken(
    credentialId: string,
    selectedElements: string[],
    nonce: string
  ): string {
    const credential = this.credentials.get(credentialId);
    if (!credential) {
      throw new Error('Credential not found');
    }

    // Create presentation data
    const presentationData = {
      credentialId,
      selectedElements,
      nonce,
      timestamp: Date.now(),
    };

    // Generate token hash
    const token = Blake3Crypto.hash(JSON.stringify(presentationData));

    return token;
  }

  /**
   * Check if element is requested
   */
  isElementRequested(element: string): boolean {
    return this.disclosureState?.requestedElements.includes(element) || false;
  }

  /**
   * Check if element is selected
   */
  isElementSelected(element: string): boolean {
    return this.disclosureState?.selectedElements.includes(element) || false;
  }

  /**
   * Get element display info
   */
  getElementDisplayInfo(element: string): {
    label: string;
    category: string;
    sensitive: boolean;
  } | null {
    const [, key] = element.split('.');
    const info = MDL_ELEMENTS[key as keyof typeof MDL_ELEMENTS];
    if (!info) return null;

    return {
      label: info.label,
      category: info.category,
      sensitive: info.sensitive,
    };
  }

  /**
   * Group elements by category
   */
  groupElementsByCategory(elements: string[]): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};

    for (const element of elements) {
      const info = this.getElementDisplayInfo(element);
      const category = info?.category || 'other';

      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(element);
    }

    return grouped;
  }
}

/**
 * Singleton instance
 */
let mdlManagerInstance: MDLManager | null = null;

export function getMDLManager(): MDLManager {
  if (!mdlManagerInstance) {
    mdlManagerInstance = new MDLManager();
  }
  return mdlManagerInstance;
}

/**
 * Helper to format credential for display
 */
export function formatCredentialForDisplay(credential: MDLCredential): {
  documentNumber: string;
  holderName: string;
  issueDate: string;
  expiryDate: string;
  isExpired: boolean;
  daysUntilExpiry: number;
} {
  const mdlNs = credential.namespaces[MDL_NAMESPACES.MDL] || {};

  const expiryDate = new Date(credential.expiryDate);
  const now = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    documentNumber: mdlNs.document_number || 'Unknown',
    holderName: `${mdlNs.given_name || ''} ${mdlNs.family_name || ''}`.trim() || 'Unknown',
    issueDate: credential.issueDate,
    expiryDate: credential.expiryDate,
    isExpired: daysUntilExpiry < 0,
    daysUntilExpiry,
  };
}

/**
 * Calculate age from birth date
 */
export function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

export default MDLManager;
