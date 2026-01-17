'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface QESCertificate {
  id: string;
  serialNumber: string;
  subject: string;
  issuer: string;
  validFrom: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
}

interface QESSignature {
  id: string;
  documentHash: string;
  format: string;
  status: string;
  createdAt: string;
}

interface IdentityData {
  firstName: string;
  lastName: string;
  email: string;
}

export default function QESPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'certificate' | 'sign' | 'history'>('certificate');
  const [certificate, setCertificate] = useState<QESCertificate | null>(null);
  const [signatures, setSignatures] = useState<QESSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [documentHash, setDocumentHash] = useState('');
  const [signatureReason, setSignatureReason] = useState('');
  const [signatureResult, setSignatureResult] = useState<{ id: string; signature: string } | null>(null);
  const [identityData, setIdentityData] = useState<IdentityData>({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check dark mode preference
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(darkMode);

    // Load user data from localStorage
    const step1Data = localStorage.getItem('myid_onboarding_step1');
    const regData = localStorage.getItem('myid_registration');

    if (step1Data) {
      try {
        const data = JSON.parse(step1Data);
        setIdentityData((prev) => ({
          ...prev,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
        }));
      } catch (e) {
        console.error('Failed to parse step 1 data');
      }
    }

    if (regData) {
      try {
        const data = JSON.parse(regData);
        setIdentityData((prev) => ({
          ...prev,
          email: data.email || '',
        }));
      } catch (e) {
        console.error('Failed to parse registration data');
      }
    }

    // Simulate loading certificate data
    setTimeout(() => {
      // Demo certificate - in production would fetch from API
      const demoCert = localStorage.getItem('myid_qes_certificate');
      if (demoCert) {
        setCertificate(JSON.parse(demoCert));
      }

      const demoSignatures = localStorage.getItem('myid_qes_signatures');
      if (demoSignatures) {
        setSignatures(JSON.parse(demoSignatures));
      }

      setLoading(false);
    }, 500);
  }, []);

  const handleRequestCertificate = async () => {
    if (!identityData.firstName || !identityData.lastName || !identityData.email) {
      alert('Please fill in all identity fields');
      return;
    }

    setRequesting(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const newCert: QESCertificate = {
      id: `cert_${Date.now()}`,
      serialNumber: Math.random().toString(16).substring(2, 18).toUpperCase(),
      subject: `CN=${identityData.firstName} ${identityData.lastName}, emailAddress=${identityData.email}`,
      issuer: 'CN=pocketOne CA, O=pocketOne (Pty) Ltd, C=ZA',
      validFrom: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
    };

    setCertificate(newCert);
    localStorage.setItem('myid_qes_certificate', JSON.stringify(newCert));
    setRequesting(false);
  };

  const handleSignDocument = async () => {
    if (!documentHash) {
      alert('Please enter a document hash');
      return;
    }

    if (!certificate) {
      alert('No active certificate found');
      return;
    }

    setSigning(true);

    // Simulate signing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const signatureId = `sig_${Date.now()}`;
    const signature = Array.from({ length: 64 }, () =>
      Math.random().toString(16).charAt(2),
    ).join('');

    const newSignature: QESSignature = {
      id: signatureId,
      documentHash: documentHash.substring(0, 16) + '...',
      format: 'CAdES-B',
      status: 'valid',
      createdAt: new Date().toISOString(),
    };

    const updatedSignatures = [newSignature, ...signatures];
    setSignatures(updatedSignatures);
    localStorage.setItem('myid_qes_signatures', JSON.stringify(updatedSignatures));

    setSignatureResult({ id: signatureId, signature });
    setSigning(false);
    setDocumentHash('');
    setSignatureReason('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const bgColor = isDarkMode ? 'bg-black' : 'bg-[#F2F2F7]';
  const cardBg = isDarkMode ? 'bg-[#1C1C1E]' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-white' : 'text-black';
  const textSecondary = isDarkMode ? 'text-[#8E8E93]' : 'text-[#8E8E93]';
  const borderColor = isDarkMode ? 'border-[#38383A]' : 'border-[#E5E5EA]';
  const inputBg = isDarkMode ? 'bg-[#2C2C2E]' : 'bg-[#F2F2F7]';

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
            <h1 className={`text-lg font-semibold ${textPrimary}`}>QES Signatures</h1>
            <div className="w-16"></div>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className={`${cardBg} border-b ${borderColor}`}>
        <div className="max-w-lg mx-auto px-4">
          <div className="flex">
            {[
              { id: 'certificate', label: 'Certificate' },
              { id: 'sign', label: 'Sign' },
              { id: 'history', label: 'History' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'certificate' | 'sign' | 'history')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[#007AFF] text-[#007AFF]'
                    : `border-transparent ${textSecondary}`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#007AFF] border-t-transparent"></div>
          </div>
        ) : (
          <>
            {/* Certificate Tab */}
            {activeTab === 'certificate' && (
              <div className="space-y-6">
                {certificate ? (
                  <>
                    {/* Certificate Card */}
                    <div className={`${cardBg} rounded-2xl overflow-hidden shadow-sm`}>
                      <div className="bg-gradient-to-r from-[#007AFF] to-[#5856D6] px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-white/70 text-xs font-medium uppercase tracking-wide">QES Certificate</p>
                            <p className="text-white font-semibold">Qualified Electronic Signature</p>
                          </div>
                          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                            certificate.status === 'active' ? 'bg-green-500/20 text-green-300' :
                            certificate.status === 'expired' ? 'bg-red-500/20 text-red-300' :
                            'bg-yellow-500/20 text-yellow-300'
                          }`}>
                            {certificate.status.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-4 space-y-4">
                        <div>
                          <p className={`text-xs ${textSecondary} uppercase tracking-wide mb-1`}>Subject</p>
                          <p className={`text-sm ${textPrimary} font-medium`}>{certificate.subject}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className={`text-xs ${textSecondary} uppercase tracking-wide mb-1`}>Serial Number</p>
                            <p className={`text-sm ${textPrimary} font-mono`}>{certificate.serialNumber}</p>
                          </div>
                          <div>
                            <p className={`text-xs ${textSecondary} uppercase tracking-wide mb-1`}>Issuer</p>
                            <p className={`text-sm ${textPrimary}`}>pocketOne CA</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className={`text-xs ${textSecondary} uppercase tracking-wide mb-1`}>Valid From</p>
                            <p className={`text-sm ${textPrimary}`}>{formatDate(certificate.validFrom)}</p>
                          </div>
                          <div>
                            <p className={`text-xs ${textSecondary} uppercase tracking-wide mb-1`}>Expires</p>
                            <p className={`text-sm ${textPrimary}`}>{formatDate(certificate.expiresAt)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Compliance Badge */}
                    <div className={`${cardBg} rounded-2xl p-4 shadow-sm`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${textPrimary}`}>eIDAS Compliant</p>
                          <p className={`text-xs ${textSecondary}`}>Qualified level - legally binding in EU</p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* No Certificate - Request Form */}
                    <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
                      <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-[#007AFF]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                        <h2 className={`text-lg font-semibold ${textPrimary} mb-2`}>Request QES Certificate</h2>
                        <p className={`text-sm ${textSecondary}`}>
                          Get a qualified electronic signature certificate for legally binding digital signatures.
                        </p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className={`block text-sm font-medium ${textPrimary} mb-2`}>First Name</label>
                          <input
                            type="text"
                            value={identityData.firstName}
                            onChange={(e) => setIdentityData({ ...identityData, firstName: e.target.value })}
                            className={`w-full px-4 py-3 ${inputBg} ${textPrimary} rounded-xl border ${borderColor} focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent`}
                            placeholder="Enter first name"
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Last Name</label>
                          <input
                            type="text"
                            value={identityData.lastName}
                            onChange={(e) => setIdentityData({ ...identityData, lastName: e.target.value })}
                            className={`w-full px-4 py-3 ${inputBg} ${textPrimary} rounded-xl border ${borderColor} focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent`}
                            placeholder="Enter last name"
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Email</label>
                          <input
                            type="email"
                            value={identityData.email}
                            onChange={(e) => setIdentityData({ ...identityData, email: e.target.value })}
                            className={`w-full px-4 py-3 ${inputBg} ${textPrimary} rounded-xl border ${borderColor} focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent`}
                            placeholder="Enter email address"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleRequestCertificate}
                        disabled={requesting}
                        className="w-full mt-6 bg-[#007AFF] text-white py-3.5 rounded-xl font-semibold text-base disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {requesting ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            Requesting...
                          </>
                        ) : (
                          'Request Certificate'
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Sign Tab */}
            {activeTab === 'sign' && (
              <div className="space-y-6">
                {certificate ? (
                  <>
                    <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
                      <h2 className={`text-lg font-semibold ${textPrimary} mb-4`}>Sign Document</h2>

                      <div className="space-y-4">
                        <div>
                          <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Document Hash (SHA-256)</label>
                          <textarea
                            value={documentHash}
                            onChange={(e) => setDocumentHash(e.target.value)}
                            className={`w-full px-4 py-3 ${inputBg} ${textPrimary} rounded-xl border ${borderColor} focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent resize-none font-mono text-sm`}
                            rows={3}
                            placeholder="Enter or paste document hash..."
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-medium ${textPrimary} mb-2`}>Signature Reason (Optional)</label>
                          <input
                            type="text"
                            value={signatureReason}
                            onChange={(e) => setSignatureReason(e.target.value)}
                            className={`w-full px-4 py-3 ${inputBg} ${textPrimary} rounded-xl border ${borderColor} focus:outline-none focus:ring-2 focus:ring-[#007AFF] focus:border-transparent`}
                            placeholder="e.g., Contract approval"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleSignDocument}
                        disabled={signing || !documentHash}
                        className="w-full mt-6 bg-[#34C759] text-white py-3.5 rounded-xl font-semibold text-base disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {signing ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            Signing...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            Sign with QES
                          </>
                        )}
                      </button>
                    </div>

                    {signatureResult && (
                      <div className={`${cardBg} rounded-2xl p-5 shadow-sm`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className={`font-semibold ${textPrimary}`}>Document Signed</p>
                            <p className={`text-xs ${textSecondary}`}>Signature ID: {signatureResult.id}</p>
                          </div>
                        </div>
                        <div className={`${inputBg} rounded-xl p-3`}>
                          <p className={`text-xs ${textSecondary} mb-1`}>Signature Value</p>
                          <p className={`text-xs font-mono ${textPrimary} break-all`}>{signatureResult.signature}</p>
                        </div>
                      </div>
                    )}

                    {/* Signature Info */}
                    <div className={`${cardBg} rounded-2xl p-4 shadow-sm`}>
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-[#FF9500] mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className={`text-sm font-medium ${textPrimary} mb-1`}>About QES Signatures</p>
                          <p className={`text-xs ${textSecondary}`}>
                            Qualified Electronic Signatures are legally equivalent to handwritten signatures in the EU under eIDAS regulation. They use HSM-protected keys for maximum security.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={`${cardBg} rounded-2xl p-8 text-center shadow-sm`}>
                    <div className="w-16 h-16 bg-[#FF3B30]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-[#FF3B30]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>Certificate Required</h3>
                    <p className={`text-sm ${textSecondary} mb-4`}>
                      You need an active QES certificate to sign documents.
                    </p>
                    <button
                      onClick={() => setActiveTab('certificate')}
                      className="text-[#007AFF] font-medium"
                    >
                      Request Certificate
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-4">
                {signatures.length > 0 ? (
                  signatures.map((sig) => (
                    <div key={sig.id} className={`${cardBg} rounded-2xl p-4 shadow-sm`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-[#007AFF]/10 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${textPrimary}`}>Document Signed</p>
                            <p className={`text-xs ${textSecondary}`}>{sig.format}</p>
                          </div>
                        </div>
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                          sig.status === 'valid' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {sig.status}
                        </div>
                      </div>
                      <div className={`${inputBg} rounded-xl p-3`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-xs ${textSecondary}`}>Document Hash</p>
                            <p className={`text-xs font-mono ${textPrimary}`}>{sig.documentHash}</p>
                          </div>
                          <p className={`text-xs ${textSecondary}`}>{formatDate(sig.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={`${cardBg} rounded-2xl p-8 text-center shadow-sm`}>
                    <div className="w-16 h-16 bg-[#8E8E93]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className={`text-lg font-semibold ${textPrimary} mb-2`}>No Signatures Yet</h3>
                    <p className={`text-sm ${textSecondary}`}>
                      Documents you sign with QES will appear here.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Safe Area */}
      <div className="h-8"></div>
    </div>
  );
}
