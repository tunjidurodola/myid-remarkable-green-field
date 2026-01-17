'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TD1Card, type TD1CardData } from '@/components/molecules';

// Types for mDL credentials
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

interface CredentialDisplayInfo {
  documentNumber: string;
  holderName: string;
  issueDate: string;
  expiryDate: string;
  isExpired: boolean;
  daysUntilExpiry: number;
  portrait?: string;
  issuingCountry: string;
  issuingAuthority: string;
}

const MDL_NAMESPACE = 'org.iso.18013.5.1.mDL';

// Helper function to format credential for display
function formatCredentialForDisplay(credential: MDLCredential): CredentialDisplayInfo {
  const mdlNs = credential.namespaces[MDL_NAMESPACE] || {};

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
    portrait: mdlNs.portrait,
    issuingCountry: mdlNs.issuing_country || 'ZA',
    issuingAuthority: mdlNs.issuing_authority || 'myID.africa',
  };
}

// Convert MDLCredential to TD1CardData format
function credentialToTD1Data(credential: MDLCredential): TD1CardData {
  const mdlNs = credential.namespaces[MDL_NAMESPACE] || {};

  // Generate a TrustCode from the credential ID (mock for demo)
  const trustCode = credential.credentialId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

  return {
    surname: mdlNs.family_name || 'UNKNOWN',
    givenNames: mdlNs.given_name || 'UNKNOWN',
    nationality: mdlNs.issuing_country || 'ZA',
    dateOfBirth: mdlNs.birth_date || '1990-01-01',
    sex: 'M' as const, // Default, would come from credential in production
    placeOfBirth: 'South Africa',
    documentNumber: mdlNs.document_number || 'ZA000000000',
    issueDate: credential.issueDate,
    expiryDate: credential.expiryDate,
    issuingAuthority: mdlNs.issuing_authority || 'myID.africa',
    trustCode: trustCode || 'TC00000000',
    photoUrl: mdlNs.portrait,
  };
}

// Credential Card Component - Apple-style
function CredentialCard({
  credential,
  onSelect,
  onShare,
  isSelected,
}: {
  credential: MDLCredential;
  onSelect: () => void;
  onShare: () => void;
  isSelected: boolean;
}) {
  const display = formatCredentialForDisplay(credential);

  const statusColor = display.isExpired
    ? 'bg-red-500'
    : display.daysUntilExpiry < 30
      ? 'bg-amber-500'
      : 'bg-green-500';

  const statusText = display.isExpired
    ? 'Expired'
    : display.daysUntilExpiry < 30
      ? `Expires in ${display.daysUntilExpiry} days`
      : 'Valid';

  return (
    <div
      onClick={onSelect}
      className={`
        relative overflow-hidden rounded-2xl transition-all duration-300
        ${isSelected ? 'ring-2 ring-blue-500 scale-[1.02]' : 'hover:scale-[1.01]'}
        cursor-pointer
      `}
    >
      {/* Card Background - License Style */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 p-5">
        {/* Header Row */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
              </svg>
            </div>
            <div>
              <p className="text-white/60 text-xs font-medium uppercase tracking-wider">
                Mobile Driving License
              </p>
              <p className="text-white text-sm font-semibold">ISO 18013-5</p>
            </div>
          </div>
          <div className={`${statusColor} px-3 py-1 rounded-full`}>
            <span className="text-white text-xs font-medium">{statusText}</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-4">
          {/* Portrait */}
          <div className="w-20 h-24 bg-white/10 rounded-lg overflow-hidden flex-shrink-0">
            {display.portrait ? (
              <img
                src={display.portrait}
                alt="Portrait"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-10 h-10 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-lg font-semibold truncate">
              {display.holderName}
            </p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span className="text-white/60 text-xs">Document No.</span>
                <span className="text-white text-xs font-medium font-mono">
                  {display.documentNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60 text-xs">Issued</span>
                <span className="text-white text-xs font-medium">
                  {new Date(display.issueDate).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/60 text-xs">Expires</span>
                <span className={`text-xs font-medium ${display.isExpired ? 'text-red-400' : 'text-white'}`}>
                  {new Date(display.expiryDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-xs">{display.issuingCountry}</span>
            <span className="text-white/40">|</span>
            <span className="text-white/60 text-xs">{display.issuingAuthority}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShare();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20
                       rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-white text-xs font-medium">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Credential Detail Sheet
function CredentialDetailSheet({
  credential,
  onClose,
  onShare,
  onRevoke,
}: {
  credential: MDLCredential;
  onClose: () => void;
  onShare: () => void;
  onRevoke: () => void;
}) {
  const display = formatCredentialForDisplay(credential);
  const mdlNs = credential.namespaces[MDL_NAMESPACE] || {};

  const claims = [
    { label: 'Given Name', value: mdlNs.given_name, key: 'given_name' },
    { label: 'Family Name', value: mdlNs.family_name, key: 'family_name' },
    { label: 'Date of Birth', value: mdlNs.birth_date, key: 'birth_date', sensitive: true },
    { label: 'Document Number', value: mdlNs.document_number, key: 'document_number' },
    { label: 'Issue Date', value: mdlNs.issue_date, key: 'issue_date' },
    { label: 'Expiry Date', value: mdlNs.expiry_date, key: 'expiry_date' },
    { label: 'Issuing Country', value: mdlNs.issuing_country, key: 'issuing_country' },
    { label: 'Issuing Authority', value: mdlNs.issuing_authority, key: 'issuing_authority' },
    { label: 'Age Over 18', value: mdlNs.age_over_18 ? 'Yes' : 'No', key: 'age_over_18' },
    { label: 'Age Over 21', value: mdlNs.age_over_21 ? 'Yes' : 'No', key: 'age_over_21' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg max-h-[90vh] bg-white dark:bg-neutral-900
                      rounded-t-3xl sm:rounded-3xl overflow-hidden animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Credential Details
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full
                         bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200
                         dark:hover:bg-neutral-700 transition-colors"
            >
              <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">
            ISO 18013-5 Mobile Driving License
          </p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
          {/* Status Banner */}
          <div className={`
            p-3 rounded-xl mb-4
            ${display.isExpired
              ? 'bg-red-50 dark:bg-red-900/20'
              : display.daysUntilExpiry < 30
                ? 'bg-amber-50 dark:bg-amber-900/20'
                : 'bg-green-50 dark:bg-green-900/20'}
          `}>
            <div className="flex items-center gap-2">
              {display.isExpired ? (
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              <span className={`
                font-medium text-sm
                ${display.isExpired
                  ? 'text-red-700 dark:text-red-400'
                  : display.daysUntilExpiry < 30
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-green-700 dark:text-green-400'}
              `}>
                {display.isExpired
                  ? 'This credential has expired'
                  : display.daysUntilExpiry < 30
                    ? `Expires in ${display.daysUntilExpiry} days`
                    : 'Valid credential'}
              </span>
            </div>
          </div>

          {/* Claims List */}
          <div className="space-y-3">
            {claims.filter(c => c.value).map((claim) => (
              <div
                key={claim.key}
                className="flex justify-between items-center py-2 border-b
                           border-neutral-100 dark:border-neutral-800 last:border-0"
              >
                <span className="text-neutral-500 dark:text-neutral-400 text-sm">
                  {claim.label}
                </span>
                <span className={`
                  text-sm font-medium
                  ${claim.sensitive
                    ? 'text-neutral-400 dark:text-neutral-500'
                    : 'text-neutral-900 dark:text-white'}
                `}>
                  {claim.sensitive ? '******' : claim.value}
                </span>
              </div>
            ))}
          </div>

          {/* Technical Details */}
          <div className="mt-6 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
              Technical Details
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Credential ID</span>
                <span className="text-neutral-700 dark:text-neutral-300 font-mono truncate max-w-[180px]">
                  {credential.credentialId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Merkle Root</span>
                <span className="text-neutral-700 dark:text-neutral-300 font-mono truncate max-w-[180px]">
                  {credential.merkleRoot?.slice(0, 16)}...
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500 dark:text-neutral-400">Algorithm</span>
                <span className="text-neutral-700 dark:text-neutral-300">
                  {credential.issuerAuth.algorithm}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800
                        flex gap-3 bg-neutral-50 dark:bg-neutral-900">
          <button
            onClick={onShare}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3
                       bg-blue-500 hover:bg-blue-600 text-white rounded-xl
                       font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share with Selective Disclosure
          </button>
          <button
            onClick={onRevoke}
            className="px-4 py-3 bg-red-100 dark:bg-red-900/20 hover:bg-red-200
                       dark:hover:bg-red-900/40 text-red-600 dark:text-red-400
                       rounded-xl font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-2xl
                      flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-neutral-400 dark:text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
        No Digital IDs Yet
      </h3>
      <p className="text-neutral-500 dark:text-neutral-400 text-center max-w-sm mb-6">
        Add your first digital credential to securely share your identity with selective disclosure.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600
                   text-white rounded-xl font-medium transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Digital ID
      </button>
    </div>
  );
}

// Main Page Component
export default function SecurityDigitalIdsPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<MDLCredential[]>([]);
  const [selectedCredential, setSelectedCredential] = useState<MDLCredential | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load credentials on mount
  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    setIsLoading(true);
    try {
      // Try to load from localStorage first (for demo)
      const stored = localStorage.getItem('myid_mdl_credentials');
      if (stored) {
        setCredentials(JSON.parse(stored));
      } else {
        // Demo credential for display
        const demoCredential: MDLCredential = {
          credentialId: 'demo-mdl-001',
          docType: 'org.iso.18013.5.1.mDL',
          namespaces: {
            'org.iso.18013.5.1.mDL': {
              family_name: 'Nkosi',
              given_name: 'Thabo',
              birth_date: '1990-05-15',
              document_number: 'ZA123456789',
              issue_date: '2024-01-15',
              expiry_date: '2034-01-15',
              issuing_country: 'ZA',
              issuing_authority: 'myID.africa',
              age_over_18: true,
              age_over_21: true,
            },
          },
          issuerAuth: {
            signature: 'demo-signature',
            certificate: 'demo-cert',
            algorithm: 'ES256',
          },
          merkleRoot: 'abc123def456789...',
          status: 'active',
          issueDate: '2024-01-15',
          expiryDate: '2034-01-15',
        };
        setCredentials([demoCredential]);
        localStorage.setItem('myid_mdl_credentials', JSON.stringify([demoCredential]));
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCredential = (credential: MDLCredential) => {
    setSelectedCredential(credential);
    setShowDetail(true);
  };

  const handleShare = (credential?: MDLCredential) => {
    const cred = credential || selectedCredential;
    if (cred) {
      router.push(`/sharing?credentialId=${cred.credentialId}`);
    }
  };

  const handleRevoke = async () => {
    if (!selectedCredential) return;

    if (confirm('Are you sure you want to revoke this credential? This action cannot be undone.')) {
      const updated = credentials.filter(c => c.credentialId !== selectedCredential.credentialId);
      setCredentials(updated);
      localStorage.setItem('myid_mdl_credentials', JSON.stringify(updated));
      setShowDetail(false);
      setSelectedCredential(null);
    }
  };

  const handleAddCredential = () => {
    // Navigate to credential issuance flow
    router.push('/onboarding/step-4');
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black">
      {/* iOS-style Header */}
      <div className="sticky top-0 z-40 bg-neutral-50/80 dark:bg-black/80 backdrop-blur-xl
                      border-b border-neutral-200/50 dark:border-neutral-800/50">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-blue-500 hover:text-blue-600
                         transition-colors -ml-2 px-2 py-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-[17px]">Back</span>
            </button>
            <h1 className="text-[17px] font-semibold text-neutral-900 dark:text-white">
              Digital IDs
            </h1>
            <button
              onClick={handleAddCredential}
              className="w-8 h-8 flex items-center justify-center rounded-full
                         hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors"
            >
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Description */}
        <div className="mb-6">
          <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed">
            Your ICAO 9303 TD1 digital identity cards. Tap a card to flip and view the
            MRZ zone on the back. Share credentials with selective disclosure.
          </p>
        </div>

        {/* Credentials List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : credentials.length === 0 ? (
          <EmptyState onAdd={handleAddCredential} />
        ) : (
          <div className="space-y-6">
            {credentials.map((credential) => {
              const td1Data = credentialToTD1Data(credential);
              const display = formatCredentialForDisplay(credential);
              const isSelected = selectedCredential?.credentialId === credential.credentialId;

              return (
                <div key={credential.credentialId} className="space-y-3">
                  {/* TD1 Card - Tap to Flip */}
                  <div className={`
                    transition-all duration-300
                    ${isSelected ? 'ring-2 ring-blue-500 rounded-xl' : ''}
                  `}>
                    <TD1Card
                      data={td1Data}
                      showHint={true}
                      scale={1}
                      className="mx-auto"
                    />
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <div className={`
                        w-2 h-2 rounded-full
                        ${display.isExpired
                          ? 'bg-red-500'
                          : display.daysUntilExpiry < 30
                            ? 'bg-amber-500'
                            : 'bg-green-500'}
                      `} />
                      <span className={`
                        text-xs font-medium
                        ${display.isExpired
                          ? 'text-red-600 dark:text-red-400'
                          : display.daysUntilExpiry < 30
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-green-600 dark:text-green-400'}
                      `}>
                        {display.isExpired
                          ? 'Expired'
                          : display.daysUntilExpiry < 30
                            ? `Expires in ${display.daysUntilExpiry} days`
                            : 'Valid'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSelectCredential(credential)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800
                                   hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-lg transition-colors text-xs"
                      >
                        <svg className="w-4 h-4 text-neutral-600 dark:text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-neutral-700 dark:text-neutral-300">Details</span>
                      </button>
                      <button
                        onClick={() => handleShare(credential)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600
                                   text-white rounded-lg transition-colors text-xs"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                        <span>Share</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Info Card */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl">
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-800/50
                            rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-blue-900 dark:text-blue-100 text-sm font-medium mb-1">
                ICAO TD1 Digital Identity Card
              </p>
              <p className="text-blue-700 dark:text-blue-300 text-xs leading-relaxed">
                Your digital ID follows ICAO 9303 TD1 format with OCR-B compliant MRZ.
                Tap the card to flip and view the Machine Readable Zone. Share specific
                claims with selective disclosure using cryptographic commitments.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Sheet */}
      {showDetail && selectedCredential && (
        <CredentialDetailSheet
          credential={selectedCredential}
          onClose={() => {
            setShowDetail(false);
            setSelectedCredential(null);
          }}
          onShare={() => handleShare()}
          onRevoke={handleRevoke}
        />
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
