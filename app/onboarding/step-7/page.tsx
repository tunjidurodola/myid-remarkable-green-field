'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function OnboardingStep7Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
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
    if (scanning && scanProgress < 100) {
      const timer = setTimeout(() => {
        setScanProgress((prev) => Math.min(prev + 10, 100));
      }, 300);
      return () => clearTimeout(timer);
    } else if (scanProgress >= 100) {
      setScanning(false);
      setScanComplete(true);
    }
  }, [scanning, scanProgress]);

  const handleStartScan = () => {
    setScanning(true);
    setScanProgress(0);
  };

  const handleNext = () => {
    setLoading(true);
    localStorage.setItem('myid_onboarding_step7', JSON.stringify({
      mrzScanned: true,
      scannedAt: Date.now(),
    }));
    setTimeout(() => {
      router.push('/onboarding/step-8');
    }, 300);
  };

  const handleBack = () => {
    router.push('/onboarding/step-6');
  };

  const progress = (7 / 9) * 100;

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col font-['Ubuntu',sans-serif]">
      {/* Status Bar */}
      <div className="h-11 bg-black flex justify-between items-center px-5 text-sm font-semibold text-white">
        <span>{currentTime}</span>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21z"/>
          </svg>
        </div>
      </div>

      {/* Camera View */}
      <div className="flex-1 bg-black relative">
        {/* Simulated camera feed */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60"></div>

        {/* Header Overlay */}
        <div className="absolute top-0 left-0 right-0 px-5 pt-2 z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="p-2 -ml-2 text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="text-center">
              <h1 className="text-white font-semibold">Scan MRZ</h1>
              <p className="text-white/70 text-sm">Step 7 of 9</p>
            </div>
            <Image
              src="/myid-badge.png"
              alt="myID"
              width={32}
              height={32}
              className="h-8 w-auto opacity-80"
            />
          </div>

          {/* Progress Bar */}
          <div className="h-1 bg-white/20 rounded-full overflow-hidden mt-4">
            <div
              className="h-full bg-[#007AFF] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Scan Frame */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Frame */}
            <div className={`w-72 h-44 border-2 rounded-xl transition-colors ${
              scanComplete ? 'border-green-500' : scanning ? 'border-[#007AFF]' : 'border-white/50'
            }`}>
              {/* Corner Markers */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg"></div>
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg"></div>
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg"></div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg"></div>

              {/* Scan Line Animation */}
              {scanning && (
                <div
                  className="absolute left-2 right-2 h-0.5 bg-[#007AFF] shadow-lg shadow-[#007AFF]"
                  style={{
                    top: `${(scanProgress / 100) * 100}%`,
                    transition: 'top 0.3s linear',
                  }}
                />
              )}

              {/* Success Checkmark */}
              {scanComplete && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-xl">
                  <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* MRZ Area Indicator */}
            <div className="absolute -bottom-2 left-4 right-4 bg-white/10 rounded px-2 py-1">
              <div className="space-y-0.5">
                <div className="h-1 bg-white/60 rounded-sm"></div>
                <div className="h-1 bg-white/60 rounded-sm"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Text */}
        <div className="absolute bottom-32 left-0 right-0 text-center">
          {!scanning && !scanComplete && (
            <p className="text-white/80 text-sm">Position the MRZ zone within the frame</p>
          )}
          {scanning && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-[#007AFF] font-medium">Scanning... {scanProgress}%</p>
              <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#007AFF] rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
          )}
          {scanComplete && (
            <p className="text-green-400 font-medium">MRZ scanned successfully!</p>
          )}
        </div>
      </div>

      {/* Bottom Action */}
      <div className="bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        {!scanComplete ? (
          <button
            onClick={handleStartScan}
            disabled={scanning}
            className="w-full py-4 bg-[#007AFF] text-white rounded-xl text-base font-semibold transition-all duration-200 hover:bg-[#0066CC] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {scanning ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                Start Scan
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
                Continue to NFC
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
