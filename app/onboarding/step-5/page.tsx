'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const VERIFICATION_METHODS = [
  {
    id: 'nfc',
    name: 'NFC Chip Reading',
    description: 'Fastest and most secure method',
    badge: 'Recommended',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
  },
  {
    id: 'camera',
    name: 'Camera Scan',
    description: 'Scan MRZ code with your camera',
    badge: null,
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function OnboardingStep5Page() {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState('');
  const [loading, setLoading] = useState(false);
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

  const handleNext = () => {
    if (!selectedMethod) return;

    setLoading(true);
    localStorage.setItem('myid_onboarding_step5', JSON.stringify({
      verificationMethod: selectedMethod,
    }));

    setTimeout(() => {
      router.push('/onboarding/step-6');
    }, 300);
  };

  const handleBack = () => {
    router.push('/onboarding/step-4');
  };

  const progress = (5 / 9) * 100;

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
            <h1 className="text-xl font-bold text-black">Verification Method</h1>
            <p className="text-sm text-[#8E8E93]">Step 5 of 9</p>
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
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-black mb-2">How would you like to verify?</h2>
          <p className="text-sm text-[#8E8E93]">
            Choose how you want to verify your identity document
          </p>
        </div>

        {/* Method Options */}
        <div className="space-y-3">
          {VERIFICATION_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              className={`w-full bg-white rounded-2xl p-4 shadow-sm border-2 transition-all duration-200 text-left ${
                selectedMethod === method.id
                  ? 'border-[#007AFF] bg-[#007AFF]/5'
                  : 'border-transparent hover:border-[#E5E5EA]'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                  selectedMethod === method.id
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-[#F2F2F7] text-[#8E8E93]'
                }`}>
                  {method.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-black">{method.name}</h3>
                    {method.badge && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                        {method.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#8E8E93]">{method.description}</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  selectedMethod === method.id
                    ? 'border-[#007AFF] bg-[#007AFF]'
                    : 'border-[#C6C6C8]'
                }`}>
                  {selectedMethod === method.id && (
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Info Box */}
        <div className="bg-[#007AFF]/5 border border-[#007AFF]/20 rounded-xl p-4 mt-6">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-[#007AFF] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-[#007AFF] font-medium mb-1">NFC vs Camera</p>
              <p className="text-sm text-[#8E8E93]">
                NFC reading provides cryptographic proof of authenticity. Camera scanning reads the MRZ code but cannot verify chip data.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          onClick={handleNext}
          disabled={loading || !selectedMethod}
          className="w-full py-4 bg-[#007AFF] text-white rounded-xl text-base font-semibold transition-all duration-200 hover:bg-[#0066CC] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
              Continue
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
