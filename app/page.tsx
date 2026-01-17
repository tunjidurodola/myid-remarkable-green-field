'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function RootPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check for existing session and redirect accordingly
    const checkAuthAndRedirect = () => {
      try {
        const sessionData = localStorage.getItem('myid_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          // Check if session is valid (verified and not expired - 24 hour expiry)
          const isExpired = session.timestamp && (Date.now() - session.timestamp > 24 * 60 * 60 * 1000);
          if (session.verified && !isExpired) {
            // User is authenticated, go to dashboard
            router.replace('/dashboard');
            return;
          }
        }
        // No valid session, show splash screen
        router.replace('/splash');
      } catch (e) {
        // If there's any error parsing session, go to splash
        console.error('Session check failed:', e);
        router.replace('/splash');
      }
    };

    // Small delay to show loading state briefly
    const timer = setTimeout(checkAuthAndRedirect, 100);
    return () => clearTimeout(timer);
  }, [router]);

  // Show minimal loading state while checking auth
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#16424a] to-[#0f2e33] flex flex-col items-center justify-center font-['Ubuntu',sans-serif]">
      {/* Logo */}
      <div className="mb-8">
        <Image
          src="/myid-badge.png"
          alt="myID"
          width={80}
          height={80}
          className="w-20 h-20"
          priority
        />
      </div>

      {/* Loading indicator */}
      <div className="flex items-center gap-2">
        <svg className="animate-spin w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-white/60 text-sm">Loading...</span>
      </div>
    </div>
  );
}
