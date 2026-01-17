'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function OnboardingStep9Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyCreated, setPasskeyCreated] = useState(false);
  const [creating, setCreating] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(`${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check passkey support
    const checkSupport = async () => {
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setPasskeySupported(available);
        } catch {
          setPasskeySupported(false);
        }
      }
    };
    checkSupport();
  }, []);

  const handleCreatePasskey = async () => {
    setCreating(true);
    // Simulate passkey creation
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setPasskeyCreated(true);
    setCreating(false);

    localStorage.setItem('myid_onboarding_step9', JSON.stringify({
      passkeyCreated: true,
      createdAt: Date.now(),
    }));
  };

  const handleComplete = () => {
    setLoading(true);
    // Mark onboarding as complete
    localStorage.setItem('myid_onboarding_complete', 'true');
    localStorage.setItem('myid_verified', 'true');

    setTimeout(() => {
      router.push('/onboarding/success');
    }, 300);
  };

  const handleSkip = () => {
    setLoading(true);
    localStorage.setItem('myid_onboarding_complete', 'true');
    setTimeout(() => {
      router.push('/onboarding/success');
    }, 300);
  };

  const handleBack = () => {
    router.push('/onboarding/step-8');
  };

  const progress = (9 / 9) * 100;

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col font-['Ubuntu',sans-serif]">
      {/* Status Bar */}
      <div className="h-11 bg-white flex justify-between items-center px-5 text-sm font-semibold text-black">
        <span>{currentTime}</span>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21z"/>
          </svg>
        </div>
      </div>

      {/* Header with Progress */}
      <div className="bg-white px-5 pb-4 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-[#007AFF] hover:bg-[#F2F2F7] rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-black">Security Setup</h1>
            <p className="text-sm text-[#8E8E93]">Step 9 of 9</p>
          </div>
          <Image
            src="/myid-badge.png"
            alt="myID"
            width={32}
            height={32}
            className="h-8 w-auto"
          />
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-[#E5E5EA] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#007AFF] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {/* Passkey Setup Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          <div className="flex justify-center mb-6">
            <div className={`w-24 h-24 rounded-2xl flex items-center justify-center ${
              passkeyCreated ? 'bg-green-100' : 'bg-[#007AFF]/10'
            }`}>
              {passkeyCreated ? (
                <svg className="w-14 h-14 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ) : (
                <svg className="w-14 h-14 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
              )}
            </div>
          </div>

          <h2 className="text-xl font-bold text-black text-center mb-2">
            {passkeyCreated ? 'Passkey Created!' : 'Create a Passkey'}
          </h2>
          <p className="text-sm text-[#8E8E93] text-center mb-6">
            {passkeyCreated
              ? 'You can now use Face ID, Touch ID, or your device PIN to sign in securely.'
              : 'Use your device biometrics (Face ID, Touch ID, or PIN) for quick and secure access.'}
          </p>

          {!passkeyCreated && (
            <button
              onClick={handleCreatePasskey}
              disabled={creating || !passkeySupported}
              className="w-full py-4 bg-[#007AFF] text-white rounded-xl text-base font-semibold transition-all duration-200 hover:bg-[#0066CC] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {creating ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Passkey...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                  </svg>
                  Create Passkey
                </>
              )}
            </button>
          )}

          {!passkeySupported && !passkeyCreated && (
            <p className="text-sm text-[#8E8E93] text-center mt-4">
              Passkeys are not supported on this device. You can skip this step.
            </p>
          )}
        </div>

        {/* QES Certificate Info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-black">QES Certificate</h3>
              <p className="text-sm text-[#8E8E93]">Qualified Electronic Signature</p>
            </div>
          </div>
          <p className="text-sm text-[#8E8E93]">
            Your QES certificate will be issued upon completion. This enables legally binding digital signatures across the EU/EEA.
          </p>
        </div>

        {/* Benefits */}
        <div className="bg-[#007AFF]/5 border border-[#007AFF]/20 rounded-xl p-4">
          <h3 className="font-semibold text-[#007AFF] mb-3">What you get</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-[#8E8E93]">Verified Digital Identity</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-[#8E8E93]">Passwordless Authentication</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-[#8E8E93]">Legal Digital Signatures</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-[#8E8E93]">TOTP Authenticator</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          onClick={handleComplete}
          disabled={loading}
          className={`w-full py-4 text-white rounded-xl text-base font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            passkeyCreated ? 'bg-green-500 hover:bg-green-600' : 'bg-[#007AFF] hover:bg-[#0066CC]'
          }`}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Completing Setup...
            </>
          ) : (
            <>
              {passkeyCreated ? 'Complete Setup' : 'Continue Without Passkey'}
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>

        {!passkeyCreated && (
          <button
            onClick={handleSkip}
            disabled={loading}
            className="w-full mt-3 text-center text-[#8E8E93] text-sm hover:text-[#007AFF] transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
