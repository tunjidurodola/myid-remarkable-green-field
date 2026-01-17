'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type CredentialType = 'mDL' | 'PID' | 'DTC' | 'VC';
type CredentialStatus = 'active' | 'expired' | 'revoked' | 'pending';

interface Credential {
  id: string;
  type: CredentialType;
  title: string;
  subtitle: string;
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  status: CredentialStatus;
  claims?: Record<string, unknown>;
  color: string;
  icon: string;
}

const CREDENTIAL_CONFIGS: Record<CredentialType, { title: string; icon: string; color: string }> = {
  mDL: { title: 'Mobile Driver\'s License', icon: 'car', color: '#007AFF' },
  PID: { title: 'Personal ID (eIDAS2)', icon: 'person', color: '#34C759' },
  DTC: { title: 'Digital Travel Credential', icon: 'airplane', color: '#5856D6' },
  VC: { title: 'Verifiable Credential', icon: 'checkmark', color: '#FF9500' },
};

export default function WalletPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareCredentialId, setShareCredentialId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [filterType, setFilterType] = useState<CredentialType | 'all'>('all');

  useEffect(() => {
    // Check dark mode preference
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(darkMode);

    // Load credentials from localStorage (demo)
    setTimeout(() => {
      const storedCredentials = localStorage.getItem('myid_credentials');
      if (storedCredentials) {
        setCredentials(JSON.parse(storedCredentials));
      } else {
        // Demo credentials
        const demoCredentials: Credential[] = [
          {
            id: 'mdl_001',
            type: 'mDL',
            title: 'Mobile Driver\'s License',
            subtitle: 'Class B - Light Motor Vehicle',
            issuer: 'Department of Transport',
            issuedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            claims: {
              given_name: 'John',
              family_name: 'Doe',
              birth_date: '1990-01-15',
              document_number: 'ZA1234567890',
            },
            color: '#007AFF',
            icon: 'car',
          },
          {
            id: 'pid_001',
            type: 'PID',
            title: 'Personal ID (eIDAS2)',
            subtitle: 'South African National ID',
            issuer: 'Department of Home Affairs',
            issuedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            claims: {
              given_name: 'John',
              family_name: 'Doe',
              birth_date: '1990-01-15',
              nationality: 'ZA',
              over_18: true,
              over_21: true,
            },
            color: '#34C759',
            icon: 'person',
          },
        ];
        setCredentials(demoCredentials);
        localStorage.setItem('myid_credentials', JSON.stringify(demoCredentials));
      }
      setLoading(false);
    }, 500);
  }, []);

  const handleShare = (credentialId: string) => {
    setShareCredentialId(credentialId);
    setShowShareSheet(true);
  };

  const handleQuickShare = async (credential: Credential, claims: string[]) => {
    // Simulate sharing
    setShowShareSheet(false);

    // Show success feedback
    alert(`Shared ${claims.join(', ')} from ${credential.title}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: CredentialStatus) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500';
      case 'expired':
        return 'bg-red-500/10 text-red-500';
      case 'revoked':
        return 'bg-red-500/10 text-red-500';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  const filteredCredentials = filterType === 'all'
    ? credentials
    : credentials.filter((c) => c.type === filterType);

  const bgColor = isDarkMode ? 'bg-black' : 'bg-[#F2F2F7]';
  const cardBg = isDarkMode ? 'bg-[#1C1C1E]' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-white' : 'text-black';
  const textSecondary = isDarkMode ? 'text-[#8E8E93]' : 'text-[#8E8E93]';
  const borderColor = isDarkMode ? 'border-[#38383A]' : 'border-[#E5E5EA]';

  const renderCredentialIcon = (type: CredentialType) => {
    switch (type) {
      case 'mDL':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
          </svg>
        );
      case 'PID':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'DTC':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'VC':
        return (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
    }
  };

  return (
    <div className={`min-h-screen ${bgColor} font-['Ubuntu',sans-serif]`}>
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-lg bg-opacity-80">
        <div className={`${isDarkMode ? 'bg-black/80' : 'bg-white/80'} border-b ${borderColor}`}>
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="text-[#007AFF] text-base font-medium flex items-center gap-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <h1 className={`text-lg font-semibold ${textPrimary}`}>My Wallet</h1>
            <button
              onClick={() => router.push('/security/wallet/add')}
              className="text-[#007AFF] text-base font-medium"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={`${cardBg} border-b ${borderColor}`}>
        <div className="max-w-lg mx-auto px-4 py-2">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {(['all', 'mDL', 'PID', 'DTC', 'VC'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterType === type
                    ? 'bg-[#007AFF] text-white'
                    : isDarkMode
                    ? 'bg-[#2C2C2E] text-white'
                    : 'bg-[#F2F2F7] text-black'
                }`}
              >
                {type === 'all' ? 'All' : type}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#007AFF] border-t-transparent"></div>
          </div>
        ) : filteredCredentials.length > 0 ? (
          <>
            {/* Credential Cards */}
            {filteredCredentials.map((credential) => (
              <div
                key={credential.id}
                className={`${cardBg} rounded-2xl overflow-hidden shadow-sm`}
              >
                {/* Card Header with Gradient */}
                <div
                  className="px-5 py-4"
                  style={{
                    background: `linear-gradient(135deg, ${credential.color}, ${credential.color}dd)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white">
                      {renderCredentialIcon(credential.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-white/70 text-xs font-medium uppercase tracking-wide">
                        {credential.type}
                      </p>
                      <p className="text-white font-semibold">{credential.title}</p>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      credential.status === 'active'
                        ? 'bg-white/20 text-white'
                        : 'bg-red-500/20 text-red-200'
                    }`}>
                      {credential.status.toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-5 py-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className={`text-xs ${textSecondary} uppercase tracking-wide mb-1`}>Holder</p>
                      <p className={`text-sm font-medium ${textPrimary}`}>
                        {String(credential.claims?.given_name || '')} {String(credential.claims?.family_name || '')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs ${textSecondary} uppercase tracking-wide mb-1`}>Expires</p>
                      <p className={`text-sm font-medium ${textPrimary}`}>
                        {credential.expiresAt ? formatDate(credential.expiresAt) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className={`text-xs ${textSecondary} mb-4`}>
                    Issued by {credential.issuer}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedCredential(credential)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${
                        isDarkMode ? 'bg-[#2C2C2E] text-white' : 'bg-[#F2F2F7] text-black'
                      }`}
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleShare(credential.id)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#007AFF] text-white"
                    >
                      Share
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Summary Stats */}
            <div className={`${cardBg} rounded-2xl p-4 shadow-sm mt-6`}>
              <h3 className={`text-sm font-semibold ${textPrimary} mb-3`}>Wallet Summary</h3>
              <div className="grid grid-cols-4 gap-3">
                {(['mDL', 'PID', 'DTC', 'VC'] as const).map((type) => {
                  const count = credentials.filter((c) => c.type === type).length;
                  const config = CREDENTIAL_CONFIGS[type];
                  return (
                    <div
                      key={type}
                      className={`text-center p-3 rounded-xl ${
                        isDarkMode ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]'
                      }`}
                    >
                      <p
                        className="text-xl font-bold"
                        style={{ color: config.color }}
                      >
                        {count}
                      </p>
                      <p className={`text-xs ${textSecondary}`}>{type}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className={`${cardBg} rounded-2xl p-8 text-center shadow-sm`}>
            <div className="w-16 h-16 bg-[#007AFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>No Credentials Yet</h3>
            <p className={`text-sm ${textSecondary} mb-4`}>
              Add your first credential to get started with your digital identity wallet.
            </p>
            <button
              onClick={() => router.push('/security/wallet/add')}
              className="bg-[#007AFF] text-white px-6 py-3 rounded-xl font-semibold text-sm"
            >
              Add Credential
            </button>
          </div>
        )}
      </div>

      {/* Credential Detail Modal */}
      {selectedCredential && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedCredential(null)}
          ></div>
          <div
            className={`relative ${cardBg} rounded-t-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto`}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10">
              <div
                className="px-5 py-4 rounded-t-3xl"
                style={{
                  background: `linear-gradient(135deg, ${selectedCredential.color}, ${selectedCredential.color}dd)`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                      {renderCredentialIcon(selectedCredential.type)}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{selectedCredential.title}</p>
                      <p className="text-white/70 text-xs">{selectedCredential.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedCredential(null)}
                    className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="px-5 py-4 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className={`text-sm ${textSecondary}`}>Status</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedCredential.status)}`}>
                  {selectedCredential.status.toUpperCase()}
                </span>
              </div>

              {/* Issuer */}
              <div className="flex items-center justify-between">
                <span className={`text-sm ${textSecondary}`}>Issuer</span>
                <span className={`text-sm ${textPrimary}`}>{selectedCredential.issuer}</span>
              </div>

              {/* Dates */}
              <div className="flex items-center justify-between">
                <span className={`text-sm ${textSecondary}`}>Issued</span>
                <span className={`text-sm ${textPrimary}`}>{formatDate(selectedCredential.issuedAt)}</span>
              </div>
              {selectedCredential.expiresAt && (
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${textSecondary}`}>Expires</span>
                  <span className={`text-sm ${textPrimary}`}>{formatDate(selectedCredential.expiresAt)}</span>
                </div>
              )}

              {/* Divider */}
              <div className={`border-t ${borderColor}`}></div>

              {/* Claims */}
              <div>
                <h4 className={`text-sm font-semibold ${textPrimary} mb-3`}>Claims</h4>
                <div className="space-y-2">
                  {selectedCredential.claims && Object.entries(selectedCredential.claims).map(([key, value]) => (
                    <div
                      key={key}
                      className={`flex items-center justify-between py-2 px-3 rounded-xl ${
                        isDarkMode ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]'
                      }`}
                    >
                      <span className={`text-sm ${textSecondary}`}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span className={`text-sm ${textPrimary} font-medium`}>
                        {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setSelectedCredential(null);
                    handleShare(selectedCredential.id);
                  }}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-[#007AFF] text-white"
                >
                  Share Credential
                </button>
                <button
                  onClick={() => {
                    // Handle delete
                    if (confirm('Are you sure you want to delete this credential?')) {
                      setCredentials((prev) => prev.filter((c) => c.id !== selectedCredential.id));
                      setSelectedCredential(null);
                    }
                  }}
                  className={`py-3 px-4 rounded-xl text-sm font-semibold ${
                    isDarkMode ? 'bg-[#2C2C2E] text-[#FF3B30]' : 'bg-[#F2F2F7] text-[#FF3B30]'
                  }`}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Bottom Safe Area */}
            <div className="h-8"></div>
          </div>
        </div>
      )}

      {/* Share Sheet Modal */}
      {showShareSheet && shareCredentialId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowShareSheet(false)}
          ></div>
          <div className={`relative ${cardBg} rounded-t-3xl w-full max-w-lg`}>
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-lg font-semibold ${textPrimary}`}>Share Credential</h3>
                <button
                  onClick={() => setShowShareSheet(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isDarkMode ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]'
                  }`}
                >
                  <svg className={`w-5 h-5 ${textPrimary}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className={`text-sm ${textSecondary} mb-4`}>
                Choose what information to share:
              </p>

              {/* Quick Share Options */}
              <div className="space-y-2">
                {[
                  { label: 'Full Name Only', claims: ['given_name', 'family_name'] },
                  { label: 'Age Verification (18+)', claims: ['over_18'] },
                  { label: 'Age Verification (21+)', claims: ['over_21'] },
                  { label: 'Full Identity', claims: ['given_name', 'family_name', 'birth_date', 'nationality'] },
                ].map((option) => {
                  const credential = credentials.find((c) => c.id === shareCredentialId);
                  return (
                    <button
                      key={option.label}
                      onClick={() => credential && handleQuickShare(credential, option.claims)}
                      className={`w-full flex items-center justify-between py-3 px-4 rounded-xl ${
                        isDarkMode ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]'
                      }`}
                    >
                      <span className={`text-sm font-medium ${textPrimary}`}>{option.label}</span>
                      <svg className="w-5 h-5 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setShowShareSheet(false)}
                className={`w-full mt-4 py-3 rounded-xl text-sm font-semibold ${
                  isDarkMode ? 'bg-[#2C2C2E] text-white' : 'bg-[#F2F2F7] text-black'
                }`}
              >
                Cancel
              </button>
            </div>

            {/* Bottom Safe Area */}
            <div className="h-8"></div>
          </div>
        </div>
      )}

      {/* Bottom Safe Area */}
      <div className="h-20"></div>
    </div>
  );
}
