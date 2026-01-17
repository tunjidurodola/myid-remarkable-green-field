'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col font-['Ubuntu',sans-serif]">
      {/* Status Bar */}
      <div className="h-11 bg-[#F2F2F7] flex justify-between items-center px-5 text-sm font-semibold text-black">
        <div className="flex items-center gap-1">
          <span>{currentTime}</span>
        </div>
        <div className="flex items-center gap-1">
          <i className="fas fa-signal text-xs"></i>
          <i className="fas fa-wifi text-xs"></i>
          <i className="fas fa-battery-full text-xs"></i>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        <div className="text-center mt-8 mb-8">
          <Image
            src="/logo-light.png"
            alt="myID"
            width={120}
            height={40}
            className="mx-auto mb-6"
          />
          <h1 className="text-[28px] font-bold text-black mb-2">Reset Password</h1>
          <p className="text-base text-[#8E8E93]">
            {sent ? "Check your email" : "Enter your email to reset password"}
          </p>
        </div>

        {sent ? (
          <div className="bg-white border border-[#C6C6C8] rounded-xl p-6 mb-5">
            <div className="text-center">
              <i className="fas fa-check-circle text-[#007AFF] text-5xl mb-4"></i>
              <p className="text-base text-black mb-2">Password reset link sent!</p>
              <p className="text-sm text-[#8E8E93]">Check your email ({email}) for instructions to reset your password.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-base font-semibold text-black mb-2">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 pr-12 py-4 bg-white border border-[#C6C6C8] rounded-xl text-base text-black placeholder:text-[#8E8E93] focus:outline-none focus:border-[#007AFF]"
                />
                <i className="fas fa-envelope absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93]"></i>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-4 bg-[#007AFF] text-white rounded-xl text-base font-semibold cursor-pointer transition-opacity duration-200 hover:opacity-80 disabled:opacity-50 mb-5"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="text-center text-sm text-[#8E8E93] mt-6">
          <Link href="/auth/signin" className="text-[#007AFF] no-underline font-semibold">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
