'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function OnboardingSuccessPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);
  const [userName, setUserName] = useState('');
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
    // Get user name
    const step1Data = localStorage.getItem('myid_onboarding_step1');
    if (step1Data) {
      try {
        const data = JSON.parse(step1Data);
        setUserName(data.firstName || '');
      } catch (e) {
        console.error('Failed to parse step 1 data');
      }
    }

    // Hide confetti after animation
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    setLoading(true);
    // Store session
    localStorage.setItem('myid_session', JSON.stringify({
      verified: true,
      timestamp: Date.now(),
    }));
    setTimeout(() => {
      router.push('/dashboard');
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#16424a] to-[#0f2e33] flex flex-col font-['Ubuntu',sans-serif] relative overflow-hidden">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: '-20px',
                backgroundColor: ['#007AFF', '#34C759', '#FF9500', '#FF2D55', '#AF52DE'][Math.floor(Math.random() * 5)],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Status Bar */}
      <div className="h-11 flex justify-between items-center px-5 text-sm font-semibold text-white/80">
        <span>{currentTime}</span>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21z"/>
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5">
        {/* Success Animation */}
        <div className="relative mb-8">
          <div className="w-32 h-32 rounded-full bg-green-500 flex items-center justify-center animate-bounce-in">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          {/* Glow Effect */}
          <div className="absolute inset-0 rounded-full bg-green-500/30 blur-xl animate-pulse"></div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-white text-center mb-2">
          Identity Verified!
        </h1>
        <p className="text-white/70 text-center mb-8">
          {userName ? `Welcome to myID, ${userName}!` : 'Welcome to myID!'}
        </p>

        {/* Achievements Card */}
        <div className="w-full bg-white/10 backdrop-blur-lg rounded-2xl p-5 mb-8">
          <h2 className="text-white font-semibold mb-4 text-center">Your Trust Assets</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="w-10 h-10 rounded-full bg-[#007AFF] mx-auto mb-2 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white/80 text-sm">Verified Email</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="w-10 h-10 rounded-full bg-green-500 mx-auto mb-2 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
                </svg>
              </div>
              <p className="text-white/80 text-sm">ID Document</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="w-10 h-10 rounded-full bg-purple-500 mx-auto mb-2 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3" />
                </svg>
              </div>
              <p className="text-white/80 text-sm">Passkey</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="w-10 h-10 rounded-full bg-orange-500 mx-auto mb-2 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-white/80 text-sm">QES Ready</p>
            </div>
          </div>
        </div>

        {/* Logo */}
        <Image
          src="/myid-badge.png"
          alt="myID"
          width={48}
          height={48}
          className="h-10 w-auto opacity-60 mb-4"
        />
      </div>

      {/* Bottom Action */}
      <div className="px-5 pb-8">
        <button
          onClick={handleContinue}
          disabled={loading}
          className="w-full py-4 bg-white text-[#16424a] rounded-xl text-base font-semibold transition-all duration-200 hover:bg-white/90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading...
            </>
          ) : (
            <>
              Go to Dashboard
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* CSS for confetti animation */}
      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes bounce-in {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-confetti {
          animation: confetti 3s ease-out forwards;
        }
        .animate-bounce-in {
          animation: bounce-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
