'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function OnboardingStep8Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'searching' | 'reading' | 'success' | 'error'>('idle');
  const [readProgress, setReadProgress] = useState(0);
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
    if (nfcStatus === 'searching') {
      const timer = setTimeout(() => {
        setNfcStatus('reading');
      }, 2000);
      return () => clearTimeout(timer);
    }

    if (nfcStatus === 'reading' && readProgress < 100) {
      const timer = setTimeout(() => {
        setReadProgress((prev) => Math.min(prev + 20, 100));
      }, 500);
      return () => clearTimeout(timer);
    } else if (readProgress >= 100 && nfcStatus === 'reading') {
      setNfcStatus('success');
    }
  }, [nfcStatus, readProgress]);

  const handleStartNfc = () => {
    setNfcStatus('searching');
    setReadProgress(0);
  };

  const handleNext = () => {
    setLoading(true);
    localStorage.setItem('myid_onboarding_step8', JSON.stringify({
      nfcVerified: true,
      verifiedAt: Date.now(),
    }));
    setTimeout(() => {
      router.push('/onboarding/step-9');
    }, 300);
  };

  const handleBack = () => {
    router.push('/onboarding/step-7');
  };

  const progress = (8 / 9) * 100;

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
            <h1 className="text-xl font-bold text-black">NFC Verification</h1>
            <p className="text-sm text-[#8E8E93]">Step 8 of 9</p>
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
        {/* NFC Animation Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex justify-center mb-6">
            <div className={`relative w-40 h-40 rounded-full flex items-center justify-center ${
              nfcStatus === 'success' ? 'bg-green-100' : 'bg-[#007AFF]/10'
            }`}>
              {/* Ripple Animation */}
              {(nfcStatus === 'searching' || nfcStatus === 'reading') && (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-[#007AFF]/30 animate-ping"></div>
                  <div className="absolute inset-4 rounded-full border-4 border-[#007AFF]/20 animate-ping animation-delay-200"></div>
                </>
              )}

              {/* Icon */}
              {nfcStatus === 'success' ? (
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <svg className={`w-20 h-20 ${nfcStatus === 'idle' ? 'text-[#8E8E93]' : 'text-[#007AFF]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              )}
            </div>
          </div>

          {/* Status Text */}
          <div className="text-center">
            {nfcStatus === 'idle' && (
              <>
                <h2 className="text-lg font-bold text-black mb-2">Ready to Scan</h2>
                <p className="text-sm text-[#8E8E93]">
                  Place your passport on the back of your phone to read the NFC chip
                </p>
              </>
            )}
            {nfcStatus === 'searching' && (
              <>
                <h2 className="text-lg font-bold text-[#007AFF] mb-2">Searching for chip...</h2>
                <p className="text-sm text-[#8E8E93]">
                  Hold your passport steady against your phone
                </p>
              </>
            )}
            {nfcStatus === 'reading' && (
              <>
                <h2 className="text-lg font-bold text-[#007AFF] mb-2">Reading data...</h2>
                <div className="w-full max-w-xs mx-auto">
                  <div className="h-2 bg-[#E5E5EA] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#007AFF] rounded-full transition-all duration-500"
                      style={{ width: `${readProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-[#8E8E93] mt-2">{readProgress}% complete</p>
                </div>
              </>
            )}
            {nfcStatus === 'success' && (
              <>
                <h2 className="text-lg font-bold text-green-600 mb-2">Verification Complete!</h2>
                <p className="text-sm text-[#8E8E93]">
                  Your document has been successfully verified
                </p>
              </>
            )}
          </div>
        </div>

        {/* Instructions */}
        {nfcStatus === 'idle' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
            <h3 className="font-semibold text-black mb-3">How to scan</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold text-sm flex-shrink-0">
                  1
                </div>
                <p className="text-sm text-[#8E8E93]">Keep your passport closed with the cover facing up</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold text-sm flex-shrink-0">
                  2
                </div>
                <p className="text-sm text-[#8E8E93]">Place the passport on the upper back of your phone</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center font-bold text-sm flex-shrink-0">
                  3
                </div>
                <p className="text-sm text-[#8E8E93]">Hold still until the scan is complete</p>
              </div>
            </div>
          </div>
        )}

        {/* Skip Option */}
        {nfcStatus === 'idle' && (
          <button
            onClick={handleNext}
            className="w-full text-center text-[#8E8E93] text-sm hover:text-[#007AFF] transition-colors"
          >
            Skip NFC verification (demo only)
          </button>
        )}
      </div>

      {/* Bottom Action */}
      <div className="bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {nfcStatus !== 'success' ? (
          <button
            onClick={handleStartNfc}
            disabled={nfcStatus === 'searching' || nfcStatus === 'reading'}
            className="w-full py-4 bg-[#007AFF] text-white rounded-xl text-base font-semibold transition-all duration-200 hover:bg-[#0066CC] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {(nfcStatus === 'searching' || nfcStatus === 'reading') ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {nfcStatus === 'searching' ? 'Searching...' : 'Reading...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
                Start NFC Scan
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={loading}
            className="w-full py-4 bg-green-500 text-white rounded-xl text-base font-semibold transition-all duration-200 hover:bg-green-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                Continue to Final Step
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
