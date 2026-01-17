'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function OnboardingStep2Page() {
  const router = useRouter();
  const [otp, setOtp] = useState<string[]>(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [email, setEmail] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
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
    // Get email from registration data
    const registration = localStorage.getItem('myid_registration');
    if (registration) {
      try {
        const data = JSON.parse(registration);
        setEmail(data.email || '');
      } catch (e) {
        console.error('Failed to parse registration data');
      }
    }
  }, []);

  useEffect(() => {
    // Countdown timer
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCanResend(true);
    }
  }, [timer]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    if (pastedData.length === 6) {
      inputRefs.current[5]?.focus();
    }
  };

  const handleResend = () => {
    if (!canResend) return;
    setTimer(60);
    setCanResend(false);
    setError('');
    // In production, this would call the API to resend OTP
  };

  const handleNext = () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    // In production, this would verify the OTP with the API
    setTimeout(() => {
      // For demo, accept any 6-digit code
      localStorage.setItem('myid_onboarding_step2', JSON.stringify({
        emailVerified: true,
        verifiedAt: Date.now(),
      }));
      router.push('/onboarding/step-3');
    }, 500);
  };

  const handleBack = () => {
    router.push('/onboarding/step-1');
  };

  const progress = (2 / 9) * 100;
  const isComplete = otp.every((digit) => digit !== '');

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
            <h1 className="text-xl font-bold text-black">Email Verification</h1>
            <p className="text-sm text-[#8E8E93]">Step 2 of 9</p>
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
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
          {/* Email Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-[#007AFF]/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-black text-center mb-2">Check your email</h2>
          <p className="text-sm text-[#8E8E93] text-center mb-6">
            We sent a 6-digit code to<br />
            <span className="font-medium text-black">{email || 'your email'}</span>
          </p>

          {/* OTP Input */}
          <div className="flex justify-center gap-2 mb-4" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none transition-colors ${
                  error
                    ? 'border-red-500 bg-red-50'
                    : digit
                    ? 'border-[#007AFF] bg-[#007AFF]/5'
                    : 'border-[#C6C6C8] bg-[#F2F2F7] focus:border-[#007AFF] focus:bg-white'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center mb-4">{error}</p>
          )}

          {/* Timer & Resend */}
          <div className="text-center">
            {canResend ? (
              <button
                onClick={handleResend}
                className="text-[#007AFF] font-medium hover:underline"
              >
                Resend code
              </button>
            ) : (
              <p className="text-sm text-[#8E8E93]">
                Resend code in <span className="font-medium text-black">{timer}s</span>
              </p>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-[#007AFF]/5 border border-[#007AFF]/20 rounded-xl p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-[#007AFF] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-[#007AFF] font-medium mb-1">Did not receive the code?</p>
              <p className="text-sm text-[#8E8E93]">
                Check your spam folder or ensure you entered the correct email address.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          onClick={handleNext}
          disabled={loading || !isComplete}
          className="w-full py-4 bg-[#007AFF] text-white rounded-xl text-base font-semibold transition-all duration-200 hover:bg-[#0066CC] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Verifying...
            </>
          ) : (
            <>
              Verify Email
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
