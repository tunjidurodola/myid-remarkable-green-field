'use client';

import { useTheme } from '@/lib/theme/ThemeProvider';

interface ThemeToggleProps {
  /** Show label text */
  showLabel?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
}

export function ThemeToggle({ showLabel = false, size = 'md', className = '' }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const sizes = {
    sm: { toggle: 'w-10 h-6', dot: 'w-4 h-4', translate: 'translate-x-4' },
    md: { toggle: 'w-12 h-7', dot: 'w-5 h-5', translate: 'translate-x-5' },
    lg: { toggle: 'w-14 h-8', dot: 'w-6 h-6', translate: 'translate-x-6' },
  };

  const s = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLabel && (
        <span className="text-sm font-medium text-[#1C1C1E] dark:text-white">
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        onClick={toggleTheme}
        className={`
          relative inline-flex ${s.toggle} shrink-0 cursor-pointer rounded-full
          border-2 border-transparent transition-colors duration-200 ease-in-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007AFF] focus-visible:ring-offset-2
          ${isDark ? 'bg-[#007AFF]' : 'bg-[#E5E5EA] dark:bg-[#39393D]'}
        `}
      >
        <span className="sr-only">Toggle theme</span>

        {/* Toggle dot with icons */}
        <span
          className={`
            pointer-events-none inline-flex ${s.dot} transform items-center justify-center
            rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out
            ${isDark ? s.translate : 'translate-x-0'}
          `}
        >
          {isDark ? (
            /* Moon icon */
            <svg
              className="w-3 h-3 text-[#007AFF]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          ) : (
            /* Sun icon */
            <svg
              className="w-3 h-3 text-[#FF9500]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </span>
      </button>
    </div>
  );
}

interface ThemeSelectProps {
  className?: string;
}

export function ThemeSelect({ className = '' }: ThemeSelectProps) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-medium text-[#1C1C1E] dark:text-white">
        Appearance
      </label>
      <div className="flex gap-2">
        {(['light', 'dark', 'system'] as const).map((option) => (
          <button
            key={option}
            onClick={() => setTheme(option)}
            className={`
              flex-1 px-4 py-3 rounded-xl text-sm font-medium capitalize
              transition-all duration-200
              ${theme === option
                ? 'bg-[#007AFF] text-white'
                : 'bg-[#F2F2F7] dark:bg-[#2C2C2E] text-[#1C1C1E] dark:text-white hover:bg-[#E5E5EA] dark:hover:bg-[#3A3A3C]'
              }
            `}
          >
            {option === 'system' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                System
              </span>
            ) : option === 'light' ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
                Light
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
                Dark
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
