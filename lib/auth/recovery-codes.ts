import { Blake3Crypto } from '../crypto/blake3';

/**
 * Recovery Codes Manager
 * Generates and manages backup recovery codes for account recovery
 */

export interface RecoveryCode {
  code: string;
  hash: string;
  used: boolean;
  usedAt?: number;
}

export interface RecoveryCodeSet {
  id: string;
  codes: RecoveryCode[];
  createdAt: number;
  expiresAt?: number;
}

export class RecoveryCodesManager {
  private static readonly CODE_LENGTH = 8;
  private static readonly CODE_COUNT = 10;
  private static readonly CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding ambiguous chars

  /**
   * Generate a new set of recovery codes
   */
  static generate(count: number = this.CODE_COUNT): RecoveryCodeSet {
    const codes: RecoveryCode[] = [];

    for (let i = 0; i < count; i++) {
      const code = this.generateCode();
      codes.push({
        code,
        hash: Blake3Crypto.hash(code),
        used: false,
      });
    }

    return {
      id: crypto.randomUUID(),
      codes,
      createdAt: Date.now(),
    };
  }

  /**
   * Generate a single recovery code
   */
  private static generateCode(): string {
    let code = '';
    const array = new Uint8Array(this.CODE_LENGTH);
    crypto.getRandomValues(array);

    for (let i = 0; i < this.CODE_LENGTH; i++) {
      code += this.CHARSET[array[i] % this.CHARSET.length];

      // Add hyphen every 4 characters for readability
      if ((i + 1) % 4 === 0 && i < this.CODE_LENGTH - 1) {
        code += '-';
      }
    }

    return code;
  }

  /**
   * Verify a recovery code
   */
  static verify(codeSet: RecoveryCodeSet, inputCode: string): boolean {
    const normalizedInput = inputCode.replace(/[-\s]/g, '').toUpperCase();
    const inputHash = Blake3Crypto.hash(normalizedInput);

    const matchingCode = codeSet.codes.find(
      (c) => c.hash === inputHash && !c.used
    );

    if (matchingCode) {
      matchingCode.used = true;
      matchingCode.usedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Get remaining unused codes
   */
  static getRemainingCount(codeSet: RecoveryCodeSet): number {
    return codeSet.codes.filter((c) => !c.used).length;
  }

  /**
   * Check if codes need regeneration (less than 3 remaining)
   */
  static needsRegeneration(codeSet: RecoveryCodeSet): boolean {
    return this.getRemainingCount(codeSet) < 3;
  }

  /**
   * Format code for display (with hyphens)
   */
  static formatCode(code: string): string {
    const clean = code.replace(/[-\s]/g, '');
    return clean.match(/.{1,4}/g)?.join('-') || code;
  }

  /**
   * Export codes to plain text
   */
  static exportToText(codeSet: RecoveryCodeSet): string {
    const header = `myID.africa Recovery Codes
Generated: ${new Date(codeSet.createdAt).toLocaleDateString()}
Keep these codes in a safe place!

`;

    const codesList = codeSet.codes
      .map((c, i) => `${(i + 1).toString().padStart(2, '0')}. ${c.code}`)
      .join('\n');

    return header + codesList;
  }

  /**
   * Generate printable HTML for recovery codes
   */
  static generatePrintableHTML(codeSet: RecoveryCodeSet): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>myID.africa Recovery Codes</title>
  <style>
    body {
      font-family: 'Courier New', monospace;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      color: #0ea5e9;
      border-bottom: 2px solid #0ea5e9;
      padding-bottom: 10px;
    }
    .warning {
      background: #fef2f2;
      border: 1px solid #ef4444;
      padding: 15px;
      margin: 20px 0;
      border-radius: 5px;
    }
    .codes {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 30px 0;
    }
    .code {
      background: #f9fafb;
      padding: 10px;
      border: 1px solid #e5e7eb;
      border-radius: 5px;
      font-size: 18px;
      font-weight: bold;
    }
    .footer {
      margin-top: 40px;
      color: #6b7280;
      font-size: 14px;
    }
    @media print {
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <h1>myID.africa Recovery Codes</h1>
  <p>Generated: ${new Date(codeSet.createdAt).toLocaleString()}</p>

  <div class="warning">
    <strong>⚠️ Important:</strong>
    <ul>
      <li>Store these codes in a safe place</li>
      <li>Each code can only be used once</li>
      <li>Do not share these codes with anyone</li>
      <li>Generate new codes when you have less than 3 remaining</li>
    </ul>
  </div>

  <div class="codes">
    ${codeSet.codes
      .map(
        (c, i) =>
          `<div class="code">${(i + 1).toString().padStart(2, '0')}. ${c.code}</div>`
      )
      .join('')}
  </div>

  <div class="footer">
    <p>These recovery codes allow you to regain access to your account if you lose your primary authentication method.</p>
    <p>Store them securely and keep them confidential.</p>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Validate code format
   */
  static isValidFormat(code: string): boolean {
    const normalized = code.replace(/[-\s]/g, '').toUpperCase();
    return (
      normalized.length === this.CODE_LENGTH &&
      /^[A-Z0-9]+$/.test(normalized)
    );
  }
}
