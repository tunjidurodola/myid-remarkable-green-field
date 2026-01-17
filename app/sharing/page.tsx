'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// Types
interface MDLCredential {
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

interface PresentationRequest {
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

interface ClaimInfo {
  key: string;
  fullKey: string;
  label: string;
  value: any;
  category: string;
  sensitive: boolean;
  isRequested: boolean;
}

// ISO 18013-5 claim metadata
const MDL_CLAIM_METADATA: Record<string, { label: string; category: string; sensitive: boolean }> = {
  family_name: { label: 'Family Name', category: 'identity', sensitive: false },
  given_name: { label: 'Given Name', category: 'identity', sensitive: false },
  birth_date: { label: 'Date of Birth', category: 'identity', sensitive: true },
  issue_date: { label: 'Issue Date', category: 'document', sensitive: false },
  expiry_date: { label: 'Expiry Date', category: 'document', sensitive: false },
  issuing_country: { label: 'Issuing Country', category: 'document', sensitive: false },
  issuing_authority: { label: 'Issuing Authority', category: 'document', sensitive: false },
  document_number: { label: 'Document Number', category: 'document', sensitive: true },
  portrait: { label: 'Portrait Photo', category: 'biometric', sensitive: true },
  driving_privileges: { label: 'Driving Privileges', category: 'license', sensitive: false },
  age_over_18: { label: 'Over 18', category: 'age', sensitive: false },
  age_over_21: { label: 'Over 21', category: 'age', sensitive: false },
  age_over_65: { label: 'Over 65', category: 'age', sensitive: false },
  resident_address: { label: 'Address', category: 'address', sensitive: true },
  resident_city: { label: 'City', category: 'address', sensitive: false },
  resident_state: { label: 'State/Province', category: 'address', sensitive: false },
  resident_postal_code: { label: 'Postal Code', category: 'address', sensitive: false },
  nationality: { label: 'Nationality', category: 'identity', sensitive: false },
  sex: { label: 'Sex', category: 'identity', sensitive: false },
  height: { label: 'Height', category: 'physical', sensitive: false },
  weight: { label: 'Weight', category: 'physical', sensitive: false },
  eye_colour: { label: 'Eye Colour', category: 'physical', sensitive: false },
  hair_colour: { label: 'Hair Colour', category: 'physical', sensitive: false },
};

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Identity',
  document: 'Document',
  age: 'Age Verification',
  address: 'Address',
  biometric: 'Biometric',
  license: 'License',
  physical: 'Physical',
};

const CATEGORY_ICONS: Record<string, JSX.Element> = {
  identity: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  age: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  address: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  biometric: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  license: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
    </svg>
  ),
  physical: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
};

const MDL_NAMESPACE = 'org.iso.18013.5.1.mDL';

// Sharing Mode Selection
function ShareModeSelector({
  mode,
  onModeChange,
}: {
  mode: 'scan' | 'present';
  onModeChange: (mode: 'scan' | 'present') => void;
}) {
  return (
    <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-xl p-1">
      <button
        onClick={() => onModeChange('scan')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                    font-medium text-sm transition-all duration-200
                    ${mode === 'scan'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        Scan QR
      </button>
      <button
        onClick={() => onModeChange('present')}
        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                    font-medium text-sm transition-all duration-200
                    ${mode === 'present'
                      ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                      : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
        Present ID
      </button>
    </div>
  );
}

// QR Scanner Component
function QRScanner({
  onScan,
  onCancel,
}: {
  onScan: (data: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startScanner = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setScanning(true);
        }

        // In production, use a proper QR scanning library like @zxing/library
        // For demo, we'll simulate scanning after a delay
        setTimeout(() => {
          // Simulate successful scan
          const mockEngagement = JSON.stringify({
            version: '1.0',
            sessionId: 'demo-session-' + Date.now(),
            rpId: 'demo-verifier',
            rpName: 'Demo Verifier App',
            requestedElements: [
              `${MDL_NAMESPACE}.given_name`,
              `${MDL_NAMESPACE}.family_name`,
              `${MDL_NAMESPACE}.age_over_18`,
            ],
            purpose: 'Age verification',
            intentToRetain: false,
            nonce: Math.random().toString(36).substring(7),
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          });

          onScan(`mdoc://${btoa(mockEngagement)}`);
        }, 3000);
      } catch (err) {
        setError('Camera access denied. Please enable camera permissions.');
        console.error('Camera error:', err);
      }
    };

    startScanner();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onScan]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden
                      bg-black mb-4">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30
                              rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-white text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Corner markers */}
              <div className="relative w-48 h-48">
                {/* Top left */}
                <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-blue-500 rounded-tl-lg" />
                {/* Top right */}
                <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-blue-500 rounded-tr-lg" />
                {/* Bottom left */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-blue-500 rounded-bl-lg" />
                {/* Bottom right */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-blue-500 rounded-br-lg" />

                {/* Scanning line */}
                {scanning && (
                  <div className="absolute left-2 right-2 h-0.5 bg-blue-500 animate-scan" />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <p className="text-neutral-500 dark:text-neutral-400 text-sm text-center mb-4">
        Position the verifier&apos;s QR code within the frame
      </p>

      <button
        onClick={onCancel}
        className="px-6 py-2.5 text-neutral-600 dark:text-neutral-400
                   hover:text-neutral-900 dark:hover:text-white transition-colors"
      >
        Cancel
      </button>

      <style jsx>{`
        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: calc(100% - 2px); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// Claim Selection Component
function ClaimSelector({
  claims,
  selectedClaims,
  onToggle,
  onSelectAll,
  onSelectMinimum,
}: {
  claims: ClaimInfo[];
  selectedClaims: string[];
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onSelectMinimum: () => void;
}) {
  // Group claims by category
  const grouped = claims.reduce((acc, claim) => {
    if (!acc[claim.category]) acc[claim.category] = [];
    acc[claim.category].push(claim);
    return acc;
  }, {} as Record<string, ClaimInfo[]>);

  const categories = Object.entries(grouped);

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={onSelectMinimum}
          className="flex-1 px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400
                     bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200
                     dark:hover:bg-neutral-700 transition-colors"
        >
          Select Minimum
        </button>
        <button
          onClick={onSelectAll}
          className="flex-1 px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400
                     bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200
                     dark:hover:bg-neutral-700 transition-colors"
        >
          Select All Requested
        </button>
      </div>

      {/* Grouped claims */}
      {categories.map(([category, categoryClaims]) => (
        <div key={category} className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50 dark:bg-neutral-900/50
                          border-b border-neutral-100 dark:border-neutral-700">
            <span className="text-neutral-500 dark:text-neutral-400">
              {CATEGORY_ICONS[category] || CATEGORY_ICONS.identity}
            </span>
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {CATEGORY_LABELS[category] || category}
            </span>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
            {categoryClaims.map((claim) => (
              <button
                key={claim.fullKey}
                onClick={() => onToggle(claim.fullKey)}
                className="w-full flex items-center justify-between px-4 py-3
                           hover:bg-neutral-50 dark:hover:bg-neutral-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                                  transition-colors ${
                    selectedClaims.includes(claim.fullKey)
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-neutral-300 dark:border-neutral-600'
                  }`}>
                    {selectedClaims.includes(claim.fullKey) && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      {claim.label}
                    </p>
                    {claim.sensitive && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Sensitive data
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {claim.isRequested && (
                    <span className="px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400
                                     bg-blue-50 dark:bg-blue-900/30 rounded-full">
                      Requested
                    </span>
                  )}
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 truncate max-w-[100px]">
                    {claim.sensitive ? '******' : String(claim.value)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Confirmation Dialog
function ConfirmationDialog({
  request,
  selectedClaims,
  claimDetails,
  onConfirm,
  onCancel,
  isLoading,
}: {
  request: PresentationRequest;
  selectedClaims: string[];
  claimDetails: ClaimInfo[];
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const selectedDetails = claimDetails.filter(c => selectedClaims.includes(c.fullKey));
  const sensitiveCount = selectedDetails.filter(c => c.sensitive).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-neutral-900
                      rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full" />
        </div>

        <div className="px-6 py-4">
          {/* RP Info */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl
                            flex items-center justify-center">
              {request.rpLogo ? (
                <img src={request.rpLogo} alt={request.rpName} className="w-10 h-10 rounded-lg" />
              ) : (
                <svg className="w-7 h-7 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
                Share with {request.rpName}
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                {request.purpose}
              </p>
            </div>
          </div>

          {/* Warning for sensitive data */}
          {sensitiveCount > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-amber-700 dark:text-amber-300 text-sm font-medium">
                  {sensitiveCount} sensitive field{sensitiveCount > 1 ? 's' : ''} will be shared
                </span>
              </div>
            </div>
          )}

          {/* Selected claims summary */}
          <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-4 mb-6">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400
                          uppercase tracking-wider mb-3">
              Data to be shared ({selectedClaims.length} claims)
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedDetails.slice(0, 6).map((claim) => (
                <span
                  key={claim.fullKey}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full
                              ${claim.sensitive
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}`}
                >
                  {claim.label}
                </span>
              ))}
              {selectedDetails.length > 6 && (
                <span className="px-2.5 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  +{selectedDetails.length - 6} more
                </span>
              )}
            </div>
          </div>

          {/* Intent to retain notice */}
          {request.intentToRetain && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-6">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-blue-700 dark:text-blue-300 text-sm">
                  {request.rpName} intends to retain the shared data
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800
                        flex gap-3 bg-neutral-50 dark:bg-neutral-900">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-neutral-200 dark:bg-neutral-700
                       hover:bg-neutral-300 dark:hover:bg-neutral-600
                       text-neutral-900 dark:text-white rounded-xl
                       font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || selectedClaims.length === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                       bg-blue-500 hover:bg-blue-600 text-white rounded-xl
                       font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Confirm Share
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  );
}

// Result Screen
function ResultScreen({
  success,
  message,
  details,
  onDone,
}: {
  success: boolean;
  message: string;
  details?: string;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6
                       ${success ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
        {success ? (
          <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>

      <h2 className={`text-2xl font-bold mb-2 ${success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
        {success ? 'Success!' : 'Failed'}
      </h2>
      <p className="text-neutral-600 dark:text-neutral-300 text-center mb-2">
        {message}
      </p>
      {details && (
        <p className="text-neutral-500 dark:text-neutral-400 text-sm text-center mb-8">
          {details}
        </p>
      )}

      <button
        onClick={onDone}
        className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white
                   rounded-xl font-medium transition-colors"
      >
        Done
      </button>
    </div>
  );
}

// Main Page Component
function SharingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const credentialIdParam = searchParams.get('credentialId');

  const [mode, setMode] = useState<'scan' | 'present'>('scan');
  const [step, setStep] = useState<'select' | 'scan' | 'claims' | 'confirm' | 'result'>('select');
  const [credential, setCredential] = useState<MDLCredential | null>(null);
  const [request, setRequest] = useState<PresentationRequest | null>(null);
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [claimDetails, setClaimDetails] = useState<ClaimInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  // Load credential on mount
  useEffect(() => {
    const stored = localStorage.getItem('myid_mdl_credentials');
    if (stored) {
      const credentials = JSON.parse(stored) as MDLCredential[];
      if (credentialIdParam) {
        const found = credentials.find(c => c.credentialId === credentialIdParam);
        if (found) {
          setCredential(found);
          setMode('present');
        }
      } else if (credentials.length > 0) {
        setCredential(credentials[0]);
      }
    }
  }, [credentialIdParam]);

  // Parse credential claims
  useEffect(() => {
    if (!credential) return;

    const claims: ClaimInfo[] = [];
    const mdlNs = credential.namespaces[MDL_NAMESPACE] || {};

    for (const [key, value] of Object.entries(mdlNs)) {
      if (value === undefined || value === null) continue;

      const meta = MDL_CLAIM_METADATA[key] || {
        label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category: 'other',
        sensitive: false,
      };

      claims.push({
        key,
        fullKey: `${MDL_NAMESPACE}.${key}`,
        label: meta.label,
        value,
        category: meta.category,
        sensitive: meta.sensitive,
        isRequested: request?.requestedElements?.includes(`${MDL_NAMESPACE}.${key}`) || false,
      });
    }

    setClaimDetails(claims);
  }, [credential, request]);

  const handleScan = (qrData: string) => {
    try {
      // Parse device engagement
      const base64Data = qrData.replace('mdoc://', '');
      const decoded = JSON.parse(atob(base64Data));

      const parsedRequest: PresentationRequest = {
        requestId: decoded.sessionId || 'req-' + Date.now(),
        rpId: decoded.rpId || 'unknown',
        rpName: decoded.rpName || 'Verifier',
        rpLogo: decoded.rpLogo,
        requestedElements: decoded.requestedElements || [],
        purpose: decoded.purpose || 'Identity verification',
        intentToRetain: decoded.intentToRetain || false,
        nonce: decoded.nonce || Math.random().toString(36).substring(7),
        expiresAt: decoded.expiresAt || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      };

      setRequest(parsedRequest);

      // Pre-select requested claims
      setSelectedClaims(parsedRequest.requestedElements);

      setStep('claims');
    } catch (error) {
      console.error('Failed to parse QR data:', error);
      setResult({
        success: false,
        message: 'Invalid QR Code',
        details: 'The scanned QR code is not a valid mDL presentation request.',
      });
      setStep('result');
    }
  };

  const handleToggleClaim = (claimKey: string) => {
    setSelectedClaims(prev =>
      prev.includes(claimKey)
        ? prev.filter(k => k !== claimKey)
        : [...prev, claimKey]
    );
  };

  const handleSelectAllRequested = () => {
    if (request) {
      setSelectedClaims(request.requestedElements);
    }
  };

  const handleSelectMinimum = () => {
    // Select only non-sensitive requested claims
    if (request) {
      const minimum = request.requestedElements.filter(el => {
        const claim = claimDetails.find(c => c.fullKey === el);
        return claim && !claim.sensitive;
      });
      setSelectedClaims(minimum);
    }
  };

  const handleConfirm = async () => {
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // In production, this would call the backend to create a presentation
      // const response = await fetch('/api/mdl/present', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     credentialId: credential?.credentialId,
      //     requestedElements: selectedClaims,
      //     sessionId: request?.requestId,
      //   }),
      // });

      setResult({
        success: true,
        message: 'Data shared successfully',
        details: `${selectedClaims.length} claims shared with ${request?.rpName}`,
      });
    } catch (error) {
      setResult({
        success: false,
        message: 'Sharing failed',
        details: 'An error occurred while sharing your data. Please try again.',
      });
    } finally {
      setIsLoading(false);
      setStep('result');
    }
  };

  const handleDone = () => {
    router.push('/security/digital-ids');
  };

  const startPresent = () => {
    if (credential) {
      // Create a mock request for self-presentation
      setRequest({
        requestId: 'self-' + Date.now(),
        rpId: 'self',
        rpName: 'Self Presentation',
        requestedElements: [],
        purpose: 'Generate QR for sharing',
        intentToRetain: false,
        nonce: Math.random().toString(36).substring(7),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      });
      setStep('claims');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-neutral-50/80 dark:bg-black/80 backdrop-blur-xl
                      border-b border-neutral-200/50 dark:border-neutral-800/50">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => {
                if (step === 'select') {
                  router.back();
                } else {
                  setStep('select');
                  setRequest(null);
                  setSelectedClaims([]);
                }
              }}
              className="flex items-center gap-1 text-blue-500 hover:text-blue-600
                         transition-colors -ml-2 px-2 py-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[17px]">{step === 'select' ? 'Back' : 'Cancel'}</span>
            </button>
            <h1 className="text-[17px] font-semibold text-neutral-900 dark:text-white">
              {step === 'scan' ? 'Scan QR Code' :
               step === 'claims' ? 'Select Claims' :
               step === 'confirm' ? 'Confirm' :
               step === 'result' ? '' : 'Share Credential'}
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {step === 'select' && (
          <>
            <ShareModeSelector mode={mode} onModeChange={setMode} />

            <div className="mt-6">
              {mode === 'scan' ? (
                <div className="text-center py-8">
                  <div className="w-24 h-24 mx-auto mb-6 bg-blue-100 dark:bg-blue-900/30
                                  rounded-2xl flex items-center justify-center">
                    <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                    Scan Verifier QR Code
                  </h2>
                  <p className="text-neutral-500 dark:text-neutral-400 mb-6">
                    Scan the QR code displayed by the verifier to begin the sharing process
                  </p>
                  <button
                    onClick={() => setStep('scan')}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white
                               rounded-xl font-medium transition-colors"
                  >
                    Open Scanner
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-24 h-24 mx-auto mb-6 bg-green-100 dark:bg-green-900/30
                                  rounded-2xl flex items-center justify-center">
                    <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-neutral-900 dark:text-white mb-2">
                    Present Your ID
                  </h2>
                  <p className="text-neutral-500 dark:text-neutral-400 mb-6">
                    Select which claims to share and generate a QR code for the verifier to scan
                  </p>
                  <button
                    onClick={startPresent}
                    disabled={!credential}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white
                               rounded-xl font-medium transition-colors disabled:opacity-50"
                  >
                    Select Claims to Share
                  </button>
                  {!credential && (
                    <p className="mt-3 text-amber-600 dark:text-amber-400 text-sm">
                      No credential available. Add a Digital ID first.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {step === 'scan' && (
          <QRScanner
            onScan={handleScan}
            onCancel={() => setStep('select')}
          />
        )}

        {step === 'claims' && request && (
          <>
            {/* RP Info */}
            <div className="flex items-center gap-3 mb-6 p-4 bg-white dark:bg-neutral-800 rounded-2xl">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl
                              flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-neutral-900 dark:text-white">
                  {request.rpName}
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {request.purpose}
                </p>
              </div>
            </div>

            <ClaimSelector
              claims={claimDetails}
              selectedClaims={selectedClaims}
              onToggle={handleToggleClaim}
              onSelectAll={handleSelectAllRequested}
              onSelectMinimum={handleSelectMinimum}
            />

            <div className="mt-6">
              <button
                onClick={() => setStep('confirm')}
                disabled={selectedClaims.length === 0}
                className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600
                           text-white rounded-xl font-medium transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue with {selectedClaims.length} Claims
              </button>
            </div>
          </>
        )}

        {step === 'confirm' && request && (
          <ConfirmationDialog
            request={request}
            selectedClaims={selectedClaims}
            claimDetails={claimDetails}
            onConfirm={handleConfirm}
            onCancel={() => setStep('claims')}
            isLoading={isLoading}
          />
        )}

        {step === 'result' && result && (
          <ResultScreen
            success={result.success}
            message={result.message}
            details={result.details}
            onDone={handleDone}
          />
        )}
      </div>
    </div>
  );
}

export default function SharingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 dark:bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SharingPageContent />
    </Suspense>
  );
}
