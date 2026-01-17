'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function OnboardingStep6Page() {
  const router = useRouter();
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
    setLoading(true);
    setTimeout(() => {
      router.push('/onboarding/step-7');
    }, 300);
  };

  const handleBack = () => {
    router.push('/onboarding/step-5');
  };

  const progress = (6 / 9) * 100;

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
            <h1 className="text-xl font-bold text-black">MRZ Instructions</h1>
            <p className="text-sm text-[#8E8E93]">Step 6 of 9</p>
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
        {/* Illustration */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <div className="flex justify-center mb-6">
            <div className="w-48 h-32 bg-gradient-to-br from-[#16424a] to-[#0f2e33] rounded-xl flex flex-col items-center justify-center relative overflow-hidden">
              {/* Passport decoration */}
              <div className="absolute top-3 left-3 w-8 h-8 border-2 border-white/30 rounded"></div>
              <div className="absolute top-3 right-3 text-white/60 text-xs font-mono">PASSPORT</div>

              {/* MRZ Zone */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 py-2 px-3">
                <div className="space-y-0.5">
                  <div className="h-1.5 bg-white/80 rounded-sm"></div>
                  <div className="h-1.5 bg-white/80 rounded-sm"></div>
                </div>
              </div>

              {/* Highlight */}
              <div className="absolute bottom-0 left-0 right-0 h-12 border-2 border-[#007AFF] border-dashed animate-pulse"></div>
            </div>
          </div>

          <h2 className="text-lg font-bold text-black text-center mb-2">
            Machine Readable Zone (MRZ)
          </h2>
          <p className="text-sm text-[#8E8E93] text-center">
            The MRZ is located at the bottom of your passport data page. It contains two lines of machine-readable text.
          </p>
        </div>

        {/* Instructions */}
        <div className="space-y-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-black mb-1">Open to Data Page</h3>
                <p className="text-sm text-[#8E8E93]">Open your passport to the page with your photo and personal information.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-black mb-1">Good Lighting</h3>
                <p className="text-sm text-[#8E8E93]">Ensure you have good lighting and the MRZ zone is clearly visible without glare.</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#007AFF] text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-black mb-1">Position Camera</h3>
                <p className="text-sm text-[#8E8E93]">Hold your device steady and align the MRZ zone within the camera frame.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm text-yellow-800 font-medium mb-1">Important Tips</p>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>- Avoid shadows on the document</li>
                <li>- Keep the passport flat</li>
                <li>- Remove any protective covers</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          onClick={handleNext}
          disabled={loading}
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
              Start Scanning
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
