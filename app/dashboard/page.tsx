'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface UserData {
  firstName: string;
  lastName: string;
  email: string;
}

const TRUST_ASSETS = [
  {
    id: 'emails',
    name: 'Verified Emails',
    count: 1,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    color: 'bg-blue-500',
  },
  {
    id: 'codes',
    name: 'TOTP Codes',
    count: 0,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    color: 'bg-purple-500',
  },
  {
    id: 'passkeys',
    name: 'Passkeys',
    count: 1,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3" />
      </svg>
    ),
    color: 'bg-green-500',
  },
  {
    id: 'certificates',
    name: 'Certificates',
    count: 1,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    color: 'bg-orange-500',
  },
];

const QUICK_ACTIONS = [
  {
    id: 'share',
    name: 'Share Identity',
    description: 'Share verified claims',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
    ),
    href: '/share',
  },
  {
    id: 'scan',
    name: 'Scan QR',
    description: 'Authenticate with QR',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
    href: '/scan',
  },
  {
    id: 'sign',
    name: 'Sign Document',
    description: 'QES digital signature',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    href: '/sign',
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [greeting, setGreeting] = useState('Hello');
  const [activeTab, setActiveTab] = useState('home');
  const [currentTime, setCurrentTime] = useState('');

  // Real clock
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
    // Get greeting based on time
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');

    // Load user data
    const step1Data = localStorage.getItem('myid_onboarding_step1');
    const regData = localStorage.getItem('myid_registration');

    let firstName = '';
    let lastName = '';
    let email = '';

    if (step1Data) {
      try {
        const data = JSON.parse(step1Data);
        firstName = data.firstName || '';
        lastName = data.lastName || '';
      } catch (e) {
        console.error('Failed to parse step 1 data');
      }
    }

    if (regData) {
      try {
        const data = JSON.parse(regData);
        email = data.email || '';
        if (!firstName && data.fullName) {
          const names = data.fullName.split(' ');
          firstName = names[0] || '';
          lastName = names.slice(1).join(' ') || '';
        }
      } catch (e) {
        console.error('Failed to parse registration data');
      }
    }

    setUserData({ firstName, lastName, email });
  }, []);

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

      {/* Header */}
      <div className="bg-gradient-to-br from-[#16424a] to-[#0f2e33] px-5 pt-4 pb-8">
        <div className="flex items-center justify-between mb-6">
          <Image
            src="/logo-dark.png"
            alt="myID"
            width={80}
            height={28}
            className="h-7 w-auto"
          />
          <button
            onClick={() => router.push('/settings')}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        <h1 className="text-2xl font-bold text-white mb-1">
          {greeting}, {userData?.firstName || 'User'}
        </h1>
        <p className="text-white/70 text-sm">Your identity is verified and secure</p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto -mt-4">
        {/* Trust Assets Card */}
        <div className="mx-5 bg-white rounded-2xl shadow-lg p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-black">Trust Assets</h2>
            <Link href="/trust-email" className="text-[#007AFF] text-sm font-medium">
              View All
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {TRUST_ASSETS.map((asset) => (
              <div
                key={asset.id}
                className="bg-[#F2F2F7] rounded-xl p-3"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${asset.color} flex items-center justify-center text-white`}>
                    {asset.icon}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-black">{asset.count}</p>
                    <p className="text-xs text-[#8E8E93]">{asset.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mx-5 mb-4">
          <h2 className="font-semibold text-black mb-3">Quick Actions</h2>
          <div className="space-y-2">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.id}
                href={action.href}
                className="block bg-white rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF]">
                    {action.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-black">{action.name}</h3>
                    <p className="text-sm text-[#8E8E93]">{action.description}</p>
                  </div>
                  <svg className="w-5 h-5 text-[#C6C6C8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mx-5 mb-4">
          <h2 className="font-semibold text-black mb-3">Recent Activity</h2>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-black">Identity Verified</p>
                <p className="text-sm text-[#8E8E93]">Just now</p>
              </div>
            </div>
          </div>
        </div>

        {/* Spacer for tab bar */}
        <div className="h-20"></div>
      </div>

      {/* Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E5EA] px-4 pb-6 pt-2">
        <div className="flex justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 px-4 py-1 ${
              activeTab === 'home' ? 'text-[#007AFF]' : 'text-[#8E8E93]'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs font-medium">Home</span>
          </button>

          <button
            onClick={() => router.push('/otp')}
            className={`flex flex-col items-center gap-1 px-4 py-1 ${
              activeTab === 'vault' ? 'text-[#007AFF]' : 'text-[#8E8E93]'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="text-xs font-medium">Vault</span>
          </button>

          <button
            onClick={() => router.push('/scan')}
            className="flex flex-col items-center gap-1 px-4 py-1 -mt-6"
          >
            <div className="w-14 h-14 rounded-full bg-[#007AFF] flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-[#8E8E93]">Scan</span>
          </button>

          <button
            onClick={() => router.push('/security')}
            className={`flex flex-col items-center gap-1 px-4 py-1 ${
              activeTab === 'history' ? 'text-[#007AFF]' : 'text-[#8E8E93]'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">History</span>
          </button>

          <button
            onClick={() => router.push('/settings')}
            className={`flex flex-col items-center gap-1 px-4 py-1 ${
              activeTab === 'profile' ? 'text-[#007AFF]' : 'text-[#8E8E93]'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
