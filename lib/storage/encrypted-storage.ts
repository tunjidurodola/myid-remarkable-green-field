import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * Session data structure
 */
export interface SessionData {
  id: string;
  userId: string;
  accessToken?: string;
  refreshToken?: string;
  encryptionKey: string;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    language: string;
  };
}

/**
 * Passkey data structure
 */
export interface StoredPasskey {
  id: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  createdAt: number;
  lastUsedAt?: number;
  deviceName?: string;
  transports?: string[];
}

interface MyIDDB extends DBSchema {
  userData: {
    key: string;
    value: {
      id: string;
      data: string; // Encrypted JSON
      timestamp: number;
    };
  };
  credentials: {
    key: string;
    value: {
      id: string;
      format: string;
      data: string; // Encrypted credential
      issuedAt: number;
      expiresAt?: number;
    };
    indexes: {
      format: string;
    };
  };
  consentHistory: {
    key: string;
    value: {
      id: string;
      rpid: string;
      claims: string[];
      uct: string;
      timestamp: number;
      status: 'approved' | 'denied' | 'revoked';
    };
    indexes: {
      rpid: string;
      timestamp: number;
    };
  };
  otpSecrets: {
    key: string;
    value: {
      id: string;
      service: string;
      secret: string; // Encrypted
      algorithm: string;
      digits: number;
      period: number;
    };
  };
  passkeys: {
    key: string;
    value: StoredPasskey;
  };
  sessions: {
    key: string;
    value: SessionData;
    indexes: {
      'by-userId': string;
      'by-expiresAt': number;
    };
  };
}

/**
 * Session configuration
 */
const SESSION_CONFIG = {
  /** Default session duration: 24 hours */
  DEFAULT_DURATION: 24 * 60 * 60 * 1000,
  /** Extended session duration: 30 days */
  EXTENDED_DURATION: 30 * 24 * 60 * 60 * 1000,
  /** Session activity timeout: 30 minutes of inactivity */
  ACTIVITY_TIMEOUT: 30 * 60 * 1000,
  /** Storage key for current session ID */
  CURRENT_SESSION_KEY: 'myid_current_session',
};

/**
 * Encrypted storage layer using IndexedDB with localStorage fallback
 */
export class EncryptedStorage {
  private static db: IDBPDatabase<MyIDDB> | null = null;
  private static readonly DB_NAME = 'myid-storage';
  private static readonly DB_VERSION = 2;
  private static currentSession: SessionData | null = null;

  /**
   * Initialize the database
   */
  static async init(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB<MyIDDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db, oldVersion) {
          // User data store
          if (!db.objectStoreNames.contains('userData')) {
            db.createObjectStore('userData', { keyPath: 'id' });
          }

          // Credentials store
          if (!db.objectStoreNames.contains('credentials')) {
            const credStore = db.createObjectStore('credentials', { keyPath: 'id' });
            credStore.createIndex('format', 'format', { unique: false });
          }

          // Consent history
          if (!db.objectStoreNames.contains('consentHistory')) {
            const consentStore = db.createObjectStore('consentHistory', { keyPath: 'id' });
            consentStore.createIndex('rpid', 'rpid', { unique: false });
            consentStore.createIndex('timestamp', 'timestamp', { unique: false });
          }

          // OTP secrets
          if (!db.objectStoreNames.contains('otpSecrets')) {
            db.createObjectStore('otpSecrets', { keyPath: 'id' });
          }

          // Passkeys
          if (!db.objectStoreNames.contains('passkeys')) {
            db.createObjectStore('passkeys', { keyPath: 'id' });
          }

          // Sessions store (added in v2)
          if (oldVersion < 2 && !db.objectStoreNames.contains('sessions')) {
            const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
            sessionStore.createIndex('by-userId', 'userId', { unique: false });
            sessionStore.createIndex('by-expiresAt', 'expiresAt', { unique: false });
          }
        },
      });

      // Restore current session if exists
      await this.restoreSession();
    } catch (error) {
      console.error('Failed to initialize IndexedDB, falling back to localStorage', error);
    }
  }

  /**
   * Simple XOR encryption (for demo purposes - use Web Crypto API in production)
   */
  private static encrypt(data: string, key: string): string {
    const encrypted = [];
    for (let i = 0; i < data.length; i++) {
      encrypted.push(String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
    }
    return btoa(encrypted.join(''));
  }

  private static decrypt(data: string, key: string): string {
    const decoded = atob(data);
    const decrypted = [];
    for (let i = 0; i < decoded.length; i++) {
      decrypted.push(String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
    }
    return decrypted.join('');
  }

  /**
   * Store user data (PII)
   */
  static async storeUserData(id: string, data: any, encryptionKey: string): Promise<void> {
    await this.init();
    const encrypted = this.encrypt(JSON.stringify(data), encryptionKey);

    if (this.db) {
      await this.db.put('userData', {
        id,
        data: encrypted,
        timestamp: Date.now(),
      });
    } else {
      localStorage.setItem(`userData_${id}`, encrypted);
    }
  }

  /**
   * Retrieve user data
   */
  static async getUserData(id: string, encryptionKey: string): Promise<any> {
    await this.init();

    let encrypted: string;
    if (this.db) {
      const record = await this.db.get('userData', id);
      if (!record) return null;
      encrypted = record.data;
    } else {
      encrypted = localStorage.getItem(`userData_${id}`) || '';
      if (!encrypted) return null;
    }

    const decrypted = this.decrypt(encrypted, encryptionKey);
    return JSON.parse(decrypted);
  }

  /**
   * Store credential
   */
  static async storeCredential(
    id: string,
    format: string,
    data: any,
    encryptionKey: string,
    expiresAt?: number
  ): Promise<void> {
    await this.init();
    const encrypted = this.encrypt(JSON.stringify(data), encryptionKey);

    if (this.db) {
      await this.db.put('credentials', {
        id,
        format,
        data: encrypted,
        issuedAt: Date.now(),
        expiresAt,
      });
    } else {
      localStorage.setItem(`credential_${id}`, JSON.stringify({
        format,
        data: encrypted,
        issuedAt: Date.now(),
        expiresAt,
      }));
    }
  }

  /**
   * Get all credentials
   */
  static async getAllCredentials(encryptionKey: string): Promise<any[]> {
    await this.init();

    if (this.db) {
      const records = await this.db.getAll('credentials');
      return records.map(record => ({
        id: record.id,
        format: record.format,
        data: JSON.parse(this.decrypt(record.data, encryptionKey)),
        issuedAt: record.issuedAt,
        expiresAt: record.expiresAt,
      }));
    } else {
      // Fallback to localStorage
      const credentials = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('credential_')) {
          const value = localStorage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            credentials.push({
              id: key.replace('credential_', ''),
              format: parsed.format,
              data: JSON.parse(this.decrypt(parsed.data, encryptionKey)),
              issuedAt: parsed.issuedAt,
              expiresAt: parsed.expiresAt,
            });
          }
        }
      }
      return credentials;
    }
  }

  /**
   * Store consent record
   */
  static async storeConsent(
    id: string,
    rpid: string,
    claims: string[],
    uct: string,
    status: 'approved' | 'denied' | 'revoked'
  ): Promise<void> {
    await this.init();

    if (this.db) {
      await this.db.put('consentHistory', {
        id,
        rpid,
        claims,
        uct,
        timestamp: Date.now(),
        status,
      });
    } else {
      localStorage.setItem(`consent_${id}`, JSON.stringify({
        rpid,
        claims,
        uct,
        timestamp: Date.now(),
        status,
      }));
    }
  }

  /**
   * Get consent history
   */
  static async getConsentHistory(): Promise<any[]> {
    await this.init();

    if (this.db) {
      return await this.db.getAll('consentHistory');
    } else {
      const history = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('consent_')) {
          const value = localStorage.getItem(key);
          if (value) {
            history.push({ id: key.replace('consent_', ''), ...JSON.parse(value) });
          }
        }
      }
      return history;
    }
  }

  /**
   * Store OTP secret
   */
  static async storeOTPSecret(
    id: string,
    service: string,
    secret: string,
    encryptionKey: string,
    algorithm: string = 'SHA1',
    digits: number = 6,
    period: number = 30
  ): Promise<void> {
    await this.init();
    const encrypted = this.encrypt(secret, encryptionKey);

    if (this.db) {
      await this.db.put('otpSecrets', {
        id,
        service,
        secret: encrypted,
        algorithm,
        digits,
        period,
      });
    } else {
      localStorage.setItem(`otp_${id}`, JSON.stringify({
        service,
        secret: encrypted,
        algorithm,
        digits,
        period,
      }));
    }
  }

  /**
   * Get all OTP secrets
   */
  static async getAllOTPSecrets(encryptionKey: string): Promise<any[]> {
    await this.init();

    if (this.db) {
      const records = await this.db.getAll('otpSecrets');
      return records.map(record => ({
        ...record,
        secret: this.decrypt(record.secret, encryptionKey),
      }));
    } else {
      const secrets = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('otp_')) {
          const value = localStorage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            secrets.push({
              id: key.replace('otp_', ''),
              ...parsed,
              secret: this.decrypt(parsed.secret, encryptionKey),
            });
          }
        }
      }
      return secrets;
    }
  }

  /**
   * Clear all data (logout)
   */
  static async clearAll(): Promise<void> {
    await this.init();

    if (this.db) {
      const tx = this.db.transaction(['userData', 'credentials', 'consentHistory', 'otpSecrets', 'passkeys', 'sessions'], 'readwrite');
      await Promise.all([
        tx.objectStore('userData').clear(),
        tx.objectStore('credentials').clear(),
        tx.objectStore('consentHistory').clear(),
        tx.objectStore('otpSecrets').clear(),
        tx.objectStore('passkeys').clear(),
        tx.objectStore('sessions').clear(),
      ]);
    } else {
      localStorage.clear();
    }

    this.currentSession = null;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(SESSION_CONFIG.CURRENT_SESSION_KEY);
    }
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Create a new session
   */
  static async createSession(
    userId: string,
    encryptionKey: string,
    options: {
      accessToken?: string;
      refreshToken?: string;
      rememberMe?: boolean;
    } = {}
  ): Promise<SessionData> {
    await this.init();

    const now = Date.now();
    const duration = options.rememberMe
      ? SESSION_CONFIG.EXTENDED_DURATION
      : SESSION_CONFIG.DEFAULT_DURATION;

    const session: SessionData = {
      id: crypto.randomUUID(),
      userId,
      accessToken: options.accessToken,
      refreshToken: options.refreshToken,
      encryptionKey,
      createdAt: now,
      expiresAt: now + duration,
      lastActivityAt: now,
      deviceInfo: typeof navigator !== 'undefined' ? {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      } : undefined,
    };

    if (this.db) {
      await this.db.put('sessions', session);
    } else {
      localStorage.setItem(`session_${session.id}`, JSON.stringify(session));
    }

    // Store current session reference
    this.currentSession = session;
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_CONFIG.CURRENT_SESSION_KEY, session.id);
    }

    return session;
  }

  /**
   * Get current session
   */
  static async getCurrentSession(): Promise<SessionData | null> {
    if (this.currentSession && this.isSessionValid(this.currentSession)) {
      return this.currentSession;
    }

    await this.restoreSession();
    return this.currentSession;
  }

  /**
   * Restore session from storage
   */
  private static async restoreSession(): Promise<void> {
    if (typeof sessionStorage === 'undefined') return;

    const sessionId = sessionStorage.getItem(SESSION_CONFIG.CURRENT_SESSION_KEY);
    if (!sessionId) return;

    await this.init();

    let session: SessionData | null = null;

    if (this.db) {
      const stored = await this.db.get('sessions', sessionId);
      session = stored || null;
    } else {
      const stored = localStorage.getItem(`session_${sessionId}`);
      session = stored ? JSON.parse(stored) : null;
    }

    if (session && this.isSessionValid(session)) {
      this.currentSession = session;
      // Update last activity
      await this.updateSessionActivity();
    } else if (session) {
      // Session expired, clean up
      await this.endSession(sessionId);
    }
  }

  /**
   * Check if session is valid
   */
  private static isSessionValid(session: SessionData): boolean {
    const now = Date.now();

    // Check if session has expired
    if (session.expiresAt < now) {
      return false;
    }

    // Check for activity timeout
    const inactiveTime = now - session.lastActivityAt;
    if (inactiveTime > SESSION_CONFIG.ACTIVITY_TIMEOUT) {
      return false;
    }

    return true;
  }

  /**
   * Update session activity timestamp
   */
  static async updateSessionActivity(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.lastActivityAt = Date.now();

    await this.init();

    if (this.db) {
      await this.db.put('sessions', this.currentSession);
    } else {
      localStorage.setItem(
        `session_${this.currentSession.id}`,
        JSON.stringify(this.currentSession)
      );
    }
  }

  /**
   * Update session tokens
   */
  static async updateSessionTokens(
    accessToken: string,
    refreshToken?: string
  ): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.accessToken = accessToken;
    if (refreshToken) {
      this.currentSession.refreshToken = refreshToken;
    }
    this.currentSession.lastActivityAt = Date.now();

    await this.init();

    if (this.db) {
      await this.db.put('sessions', this.currentSession);
    } else {
      localStorage.setItem(
        `session_${this.currentSession.id}`,
        JSON.stringify(this.currentSession)
      );
    }
  }

  /**
   * End a specific session
   */
  static async endSession(sessionId?: string): Promise<void> {
    await this.init();

    const targetId = sessionId || this.currentSession?.id;
    if (!targetId) return;

    if (this.db) {
      await this.db.delete('sessions', targetId);
    } else {
      localStorage.removeItem(`session_${targetId}`);
    }

    if (targetId === this.currentSession?.id) {
      this.currentSession = null;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(SESSION_CONFIG.CURRENT_SESSION_KEY);
      }
    }
  }

  /**
   * End all sessions for a user
   */
  static async endAllSessions(userId: string): Promise<void> {
    await this.init();

    if (this.db) {
      const sessions = await this.db.getAllFromIndex('sessions', 'by-userId', userId);
      const tx = this.db.transaction('sessions', 'readwrite');
      await Promise.all(sessions.map(s => tx.store.delete(s.id)));
    } else {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith('session_')) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const session = JSON.parse(stored);
            if (session.userId === userId) {
              localStorage.removeItem(key);
            }
          }
        }
      }
    }

    if (this.currentSession?.userId === userId) {
      this.currentSession = null;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(SESSION_CONFIG.CURRENT_SESSION_KEY);
      }
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<number> {
    await this.init();

    const now = Date.now();
    let cleaned = 0;

    if (this.db) {
      const sessions = await this.db.getAll('sessions');
      const tx = this.db.transaction('sessions', 'readwrite');

      for (const session of sessions) {
        if (!this.isSessionValid(session)) {
          await tx.store.delete(session.id);
          cleaned++;
        }
      }
    } else {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key?.startsWith('session_')) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const session = JSON.parse(stored) as SessionData;
            if (!this.isSessionValid(session)) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        }
      }
    }

    return cleaned;
  }

  /**
   * Get all active sessions for a user
   */
  static async getUserSessions(userId: string): Promise<SessionData[]> {
    await this.init();

    let sessions: SessionData[] = [];

    if (this.db) {
      sessions = await this.db.getAllFromIndex('sessions', 'by-userId', userId);
    } else {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('session_')) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const session = JSON.parse(stored) as SessionData;
            if (session.userId === userId) {
              sessions.push(session);
            }
          }
        }
      }
    }

    // Filter to only valid sessions
    return sessions.filter(s => this.isSessionValid(s));
  }

  /**
   * Get the current encryption key from session
   */
  static getEncryptionKey(): string | null {
    return this.currentSession?.encryptionKey || null;
  }

  /**
   * Get current access token
   */
  static getAccessToken(): string | null {
    return this.currentSession?.accessToken || null;
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return this.currentSession !== null && this.isSessionValid(this.currentSession);
  }

  // ============================================
  // Passkey Management
  // ============================================

  /**
   * Store a passkey
   */
  static async storePasskey(passkey: StoredPasskey): Promise<void> {
    await this.init();

    if (this.db) {
      await this.db.put('passkeys', passkey);
    } else {
      localStorage.setItem(`passkey_${passkey.id}`, JSON.stringify(passkey));
    }
  }

  /**
   * Get all passkeys
   */
  static async getAllPasskeys(): Promise<StoredPasskey[]> {
    await this.init();

    if (this.db) {
      return await this.db.getAll('passkeys');
    } else {
      const passkeys: StoredPasskey[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('passkey_')) {
          const value = localStorage.getItem(key);
          if (value) {
            passkeys.push(JSON.parse(value));
          }
        }
      }
      return passkeys;
    }
  }

  /**
   * Get a passkey by credential ID
   */
  static async getPasskeyByCredentialId(credentialId: string): Promise<StoredPasskey | null> {
    await this.init();

    if (this.db) {
      const passkeys = await this.db.getAll('passkeys');
      return passkeys.find(p => p.credentialId === credentialId) || null;
    } else {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('passkey_')) {
          const value = localStorage.getItem(key);
          if (value) {
            const passkey = JSON.parse(value) as StoredPasskey;
            if (passkey.credentialId === credentialId) {
              return passkey;
            }
          }
        }
      }
      return null;
    }
  }

  /**
   * Update passkey counter (after authentication)
   */
  static async updatePasskeyCounter(credentialId: string, counter: number): Promise<void> {
    const passkey = await this.getPasskeyByCredentialId(credentialId);
    if (!passkey) return;

    passkey.counter = counter;
    passkey.lastUsedAt = Date.now();

    await this.storePasskey(passkey);
  }

  /**
   * Delete a passkey
   */
  static async deletePasskey(id: string): Promise<void> {
    await this.init();

    if (this.db) {
      await this.db.delete('passkeys', id);
    } else {
      localStorage.removeItem(`passkey_${id}`);
    }
  }
}
