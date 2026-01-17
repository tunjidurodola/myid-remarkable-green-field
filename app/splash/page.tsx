'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SplashPage() {
  const router = useRouter();
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
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
    // Trigger fade in animation
    const fadeInTimer = setTimeout(() => {
      setFadeIn(true);
    }, 100);

    // Check auth state and redirect
    const redirectTimer = setTimeout(() => {
      setFadeOut(true);

      setTimeout(() => {
        // Check if user has a session
        const hasSession = localStorage.getItem('myid_session');
        if (hasSession) {
          router.push('/dashboard');
        } else {
          router.push('/auth/signin');
        }
      }, 500);
    }, 2500);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(redirectTimer);
    };
  }, [router]);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#16424a] to-[#0f2e33] transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Status Bar Placeholder */}
      <div className="fixed top-0 left-0 right-0 h-11 flex justify-between items-center px-5 text-sm font-semibold text-white/80">
        <span>{currentTime}</span>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v18m-6-6l6 6l6-6"/>
          </svg>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`flex flex-col items-center transition-all duration-700 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
      >
        {/* Brand Logo */}
        <div className="mb-8">
          <Image
            src="/myid-logo.png"
            alt="myID"
            width={180}
            height={60}
            className="h-16 w-auto drop-shadow-lg"
            priority
          />
        </div>

        {/* Loading Animation */}
        <div className="mb-8">
          <div className="relative w-16 h-16">
            {/* Outer Ring */}
            <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
            {/* Animated Ring */}
            <div className="absolute inset-0 border-4 border-transparent border-t-white rounded-full animate-spin"></div>
            {/* Inner Glow */}
            <div className="absolute inset-2 bg-white/10 rounded-full backdrop-blur-sm"></div>
            {/* Center Dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <div
          className={`text-center transition-all duration-700 delay-300 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <h1 className="text-2xl font-semibold text-white mb-2 tracking-wide">
            Your Personal
          </h1>
          <h2 className="text-3xl font-bold text-white tracking-wide">
            Identity Vault
          </h2>
        </div>

        {/* Subtitle */}
        <p
          className={`mt-6 text-white/70 text-sm tracking-wide transition-all duration-700 delay-500 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}
        >
          Secure. Private. Trusted.
        </p>
      </div>

      {/* Bottom Branding */}
      <div
        className={`fixed bottom-8 flex flex-col items-center transition-all duration-700 delay-700 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}
      >
        <Image
          src="/myid-badge.png"
          alt="myID Badge"
          width={48}
          height={48}
          className="h-10 w-auto mb-2 opacity-60"
        />
        <p className="text-white/40 text-xs">
          Powered by myID.africa
        </p>
      </div>

      {/* Background Decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Top Right Glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-teal-400/10 rounded-full blur-3xl"></div>
        {/* Bottom Left Glow */}
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl"></div>
        {/* Center Radial */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-radial from-white/5 to-transparent rounded-full"></div>
      </div>
    </div>
  );
}
