'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

// Dynamically import theme components to avoid SSR issues
const ThemeToggle = dynamic(
  () => import('@/components/molecules/ThemeToggle').then(mod => ({ default: mod.ThemeToggle })),
  { ssr: false, loading: () => <div className="w-12 h-7 bg-[#E5E5EA] dark:bg-[#39393D] rounded-full" /> }
);

const ThemeSelect = dynamic(
  () => import('@/components/molecules/ThemeToggle').then(mod => ({ default: mod.ThemeSelect })),
  { ssr: false, loading: () => <div className="h-20 bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl animate-pulse" /> }
);

interface SettingsItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  type?: 'toggle' | 'link';
  value?: string;
  path?: string;
}

interface SettingsGroup {
  title: string;
  items: SettingsItem[];
}

export default function SettingsPage() {
  const router = useRouter();

  const settingsGroups: SettingsGroup[] = [
    {
      title: 'APPEARANCE',
      items: [
        {
          id: 'theme',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5856D6] to-[#AF52DE] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            </div>
          ),
          label: 'Dark Mode',
          type: 'toggle' as const,
        },
        {
          id: 'language',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-[#007AFF] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
          ),
          label: 'Language',
          value: 'English',
          path: '/settings/language',
        },
      ],
    },
    {
      title: 'SECURITY',
      items: [
        {
          id: 'passkeys',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-[#34C759] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
            </div>
          ),
          label: 'Passkeys',
          path: '/security/passkeys',
        },
        {
          id: 'backup',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-[#FF9500] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          ),
          label: 'Backup & Recovery',
          path: '/security/recovery',
        },
        {
          id: 'hardware',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-[#5856D6] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
          ),
          label: 'Hardware Tokens',
          path: '/security/hardware-tokens',
        },
      ],
    },
    {
      title: 'IDENTITY',
      items: [
        {
          id: 'profile',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-[#007AFF] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          ),
          label: 'Profile',
          path: '/profile',
        },
        {
          id: 'digital-ids',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-[#FF3B30] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>
            </div>
          ),
          label: 'Digital IDs',
          path: '/security/digital-ids',
        },
        {
          id: 'qes',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-[#AF52DE] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          ),
          label: 'QES Certificates',
          path: '/security/qes',
        },
      ],
    },
    {
      title: 'SUPPORT',
      items: [
        {
          id: 'legal',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-[#8E8E93] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          ),
          label: 'Legal',
          path: '/legal',
        },
        {
          id: 'privacy',
          icon: (
            <div className="w-8 h-8 rounded-lg bg-[#007AFF] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          ),
          label: 'Privacy Policy',
          path: '/privacy-policy',
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-[#000000] font-['Ubuntu',sans-serif]">
      {/* Header */}
      <div className="bg-[#F2F2F7] dark:bg-[#000000] pt-12 pb-2 px-5">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-[#007AFF] hover:bg-[#E5E5EA] dark:hover:bg-[#1C1C1E] rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-[#1C1C1E] dark:text-white">Settings</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-24">
        {/* Theme Selection Card */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl mb-6 overflow-hidden shadow-sm">
          <div className="p-5">
            <ThemeSelect />
          </div>
        </div>

        {/* Settings Groups */}
        {settingsGroups.map((group) => (
          <div key={group.title} className="mb-6">
            <h2 className="text-xs font-semibold text-[#8E8E93] dark:text-[#8E8E93] uppercase tracking-wide mb-2 px-4">
              {group.title}
            </h2>
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-sm">
              {group.items.map((item, index) => (
                <div key={item.id}>
                  {item.type === 'toggle' ? (
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span className="text-[#1C1C1E] dark:text-white font-medium">
                          {item.label}
                        </span>
                      </div>
                      <ThemeToggle size="md" />
                    </div>
                  ) : (
                    <button
                      onClick={() => item.path && router.push(item.path)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span className="text-[#1C1C1E] dark:text-white font-medium">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.value && (
                          <span className="text-[#8E8E93] dark:text-[#8E8E93] text-sm">
                            {item.value}
                          </span>
                        )}
                        <svg
                          className="w-5 h-5 text-[#C7C7CC] dark:text-[#48484A]"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </button>
                  )}
                  {index < group.items.length - 1 && (
                    <div className="ml-16 border-b border-[#E5E5EA] dark:border-[#38383A]" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Sign Out Button */}
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-sm">
          <button
            onClick={() => {
              localStorage.clear();
              router.push('/splash');
            }}
            className="w-full py-4 text-[#FF3B30] font-medium text-center hover:bg-[#F2F2F7] dark:hover:bg-[#2C2C2E] transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Version */}
        <p className="text-center text-[#8E8E93] dark:text-[#8E8E93] text-xs mt-6">
          myID.africa v1.0.0 (Build 2026.01.17)
        </p>
      </div>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-t border-[#E5E5EA] dark:border-[#38383A] pb-safe">
        <div className="flex justify-around py-2">
          {[
            { icon: 'home', label: 'Home', path: '/dashboard' },
            { icon: 'wallet', label: 'Wallet', path: '/security/wallet' },
            { icon: 'scan', label: 'Scan', path: '/scanner' },
            { icon: 'settings', label: 'Settings', path: '/settings', active: true },
          ].map((tab) => (
            <button
              key={tab.label}
              onClick={() => router.push(tab.path)}
              className={`flex flex-col items-center gap-1 py-1 px-4 ${
                tab.active ? 'text-[#007AFF]' : 'text-[#8E8E93] dark:text-[#8E8E93]'
              }`}
            >
              {tab.icon === 'home' && (
                <svg className="w-6 h-6" fill={tab.active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab.active ? 0 : 2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              )}
              {tab.icon === 'wallet' && (
                <svg className="w-6 h-6" fill={tab.active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab.active ? 0 : 2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              )}
              {tab.icon === 'scan' && (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              )}
              {tab.icon === 'settings' && (
                <svg className="w-6 h-6" fill={tab.active ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab.active ? 0 : 2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={tab.active ? 0 : 2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
