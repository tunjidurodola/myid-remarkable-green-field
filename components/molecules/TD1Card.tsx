'use client';

import { useState } from 'react';

interface TD1CardData {
  // Personal info
  surname: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string;
  sex: 'M' | 'F' | 'X';
  placeOfBirth?: string;
  // Document info
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  issuingAuthority: string;
  // Trust info
  trustCode: string;
  masterCode?: string;
  // Photo (base64 or URL)
  photoUrl?: string;
}

interface TD1CardProps {
  data: TD1CardData;
  /** Show flip hint */
  showHint?: boolean;
  /** Card scale (1 = full size, 0.5 = half) */
  scale?: number;
  /** Custom class name */
  className?: string;
}

// Generate ICAO 9303 TD1 MRZ (3 lines, 30 chars each)
function generateMRZ(data: TD1CardData): string[] {
  const pad = (str: string, len: number, char = '<') => str.toUpperCase().replace(/[^A-Z0-9]/g, '<').padEnd(len, char).slice(0, len);
  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  };

  // Calculate check digit (ICAO algorithm)
  const checkDigit = (str: string): string => {
    const weights = [7, 3, 1];
    const values: Record<string, number> = {};
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach((c, i) => values[c] = i + 10);
    '0123456789'.split('').forEach((c, i) => values[c] = i);
    values['<'] = 0;

    let sum = 0;
    str.split('').forEach((c, i) => {
      sum += (values[c] || 0) * weights[i % 3];
    });
    return String(sum % 10);
  };

  const docType = 'I';
  const countryCode = pad(data.nationality, 3);
  const docNum = pad(data.documentNumber, 9);
  const docNumCheck = checkDigit(docNum);
  const dob = formatDate(data.dateOfBirth);
  const dobCheck = checkDigit(dob);
  const expiry = formatDate(data.expiryDate);
  const expiryCheck = checkDigit(expiry);
  const sex = data.sex;
  const surname = pad(data.surname, 30);
  const givenNames = pad(data.givenNames, 30);

  // Line 1: Document type + Issuing state + Document number
  const line1 = `${docType}<${countryCode}${docNum}${docNumCheck}${'<'.repeat(15)}`.slice(0, 30);

  // Line 2: DOB + Sex + Expiry + Nationality + Optional data
  const line2 = `${dob}${dobCheck}${sex}${expiry}${expiryCheck}${countryCode}${'<'.repeat(11)}0`.slice(0, 30);

  // Line 3: Name (Surname<<Given Names)
  const line3 = `${surname.replace(/\s+/g, '<')}<<${givenNames.replace(/\s+/g, '<')}`.slice(0, 30).padEnd(30, '<');

  return [line1, line2, line3];
}

export function TD1Card({ data, showHint = true, scale = 1, className = '' }: TD1CardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const mrz = generateMRZ(data);

  const cardStyle = {
    width: `${85.6 * scale * 4}px`,  // TD1 width: 85.6mm at 4px/mm
    height: `${53.98 * scale * 4}px`, // TD1 height: 53.98mm
  };

  return (
    <div className={`card-flip ${isFlipped ? 'flipped' : ''} ${className}`} style={cardStyle}>
      <div
        className="card-flip-inner cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Front */}
        <div className="card-flip-front bg-gradient-to-br from-[#16424a] to-[#0f2e33] p-3 text-white shadow-xl">
          {/* Header */}
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="text-[8px] uppercase tracking-wider opacity-70">Digital Identity Card</div>
              <div className="text-[10px] font-bold">myID.africa</div>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-6 h-4 border border-white/30 rounded-sm flex items-center justify-center">
                <svg className="w-3 h-3 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <rect x="4" y="8" width="4" height="4" fill="#16424a" />
                </svg>
              </div>
              <div className="text-[8px] opacity-70">TD1</div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex gap-3">
            {/* Photo */}
            <div className="w-16 h-20 bg-white/10 rounded overflow-hidden flex-shrink-0 flex items-center justify-center">
              {data.photoUrl ? (
                <img src={data.photoUrl} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <svg className="w-10 h-10 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )}
            </div>

            {/* Personal info */}
            <div className="flex-1 text-[9px] space-y-1">
              <div>
                <div className="text-[7px] text-white/50 uppercase">Surname</div>
                <div className="font-bold truncate">{data.surname.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-[7px] text-white/50 uppercase">Given Names</div>
                <div className="font-bold truncate">{data.givenNames.toUpperCase()}</div>
              </div>
              <div className="flex gap-3">
                <div>
                  <div className="text-[7px] text-white/50 uppercase">Nationality</div>
                  <div className="font-semibold">{data.nationality}</div>
                </div>
                <div>
                  <div className="text-[7px] text-white/50 uppercase">DOB</div>
                  <div className="font-semibold">{data.dateOfBirth}</div>
                </div>
                <div>
                  <div className="text-[7px] text-white/50 uppercase">Sex</div>
                  <div className="font-semibold">{data.sex}</div>
                </div>
              </div>
            </div>
          </div>

          {/* TrustCode */}
          <div className="mt-2 flex justify-between items-end">
            <div className="text-[8px]">
              <span className="text-white/50">TC:</span>{' '}
              <span className="font-mono font-bold tracking-wider">{data.trustCode}</span>
            </div>
            <div className="text-[7px] text-white/50">
              Valid: {data.issueDate} - {data.expiryDate}
            </div>
          </div>

          {/* Tap hint */}
          {showHint && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[6px] text-white/40">
              Tap to flip
            </div>
          )}
        </div>

        {/* Back */}
        <div className="card-flip-back bg-[#f5f5f0] p-3 shadow-xl">
          {/* Header */}
          <div className="flex justify-between items-start mb-2">
            <div className="text-[8px] text-[#16424a] font-bold">myID.africa</div>
            <div className="text-[7px] text-gray-500 font-mono">{data.trustCode}</div>
          </div>

          {/* MRZ Zone - ICAO TD1 format */}
          <div className="bg-white border border-gray-300 rounded p-2 mb-2">
            <div className="font-mrz text-[11px] leading-tight text-black tracking-[2px]">
              {mrz.map((line, i) => (
                <div key={i} className="whitespace-pre font-mono">{line}</div>
              ))}
            </div>
          </div>

          {/* Trust metadata */}
          <div className="text-[7px] text-gray-600 space-y-0.5">
            <div className="flex justify-between">
              <span className="font-semibold">Issuer:</span>
              <span>{data.issuingAuthority}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Trust Scheme:</span>
              <span>eIDAS2 / QTSP-aligned</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold">Document:</span>
              <span>{data.documentNumber}</span>
            </div>
          </div>

          {/* QR Code placeholder */}
          <div className="absolute bottom-2 right-2 w-12 h-12 bg-white border border-gray-200 rounded flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 3h6v6H3V3zm2 2v2h2V5H5zm8-2h6v6h-6V3zm2 2v2h2V5h-2zM3 13h6v6H3v-6zm2 2v2h2v-2H5zm13-2h1v1h-1v-1zm-3 0h1v3h-1v-3zm-2 0h1v1h-1v-1zm5 2h1v3h-2v-1h1v-2zm-3 2h1v1h-1v-1zm-2 0h1v1h-1v-1zm5 1h1v1h-1v-1z" />
            </svg>
          </div>

          {/* Tap hint */}
          {showHint && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[6px] text-gray-400">
              Tap to flip
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export type { TD1CardData, TD1CardProps };
