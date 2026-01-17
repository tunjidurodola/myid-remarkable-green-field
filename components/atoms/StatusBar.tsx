'use client';

import { useState, useEffect } from 'react';

interface StatusBarProps {
  /** Custom class name */
  className?: string;
}

export function StatusBar({ className = '' }: StatusBarProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`h-11 bg-white dark:bg-black flex justify-between items-center px-5 text-sm font-semibold text-black dark:text-white ${className}`}>
      <span>{time}</span>
      <div className="flex items-center gap-1">
        {/* Signal */}
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <rect x="1" y="14" width="4" height="8" rx="1" />
          <rect x="7" y="10" width="4" height="12" rx="1" />
          <rect x="13" y="6" width="4" height="16" rx="1" />
          <rect x="19" y="2" width="4" height="20" rx="1" />
        </svg>
        {/* WiFi */}
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 18c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-4.9-2.3l1.4 1.4C9.4 18 10.6 18.5 12 18.5s2.6-.5 3.5-1.4l1.4-1.4C15.6 14.6 13.9 14 12 14s-3.6.6-4.9 1.7zm-2.8-2.8l1.4 1.4C7.3 13 9.5 12 12 12s4.7 1 6.3 2.3l1.4-1.4C17.5 11.1 14.9 10 12 10s-5.5 1.1-7.7 2.9zm-2.8-2.8l1.4 1.4C5.1 10.1 8.3 9 12 9s6.9 1.1 9.1 2.5l1.4-1.4C19.9 8.1 16.2 7 12 7s-7.9 1.1-10.5 3.1z"/>
        </svg>
        {/* Battery */}
        <svg className="w-6 h-4" viewBox="0 0 28 14" fill="currentColor">
          <rect x="0" y="0" width="24" height="14" rx="3" stroke="currentColor" strokeWidth="1" fill="none" />
          <rect x="2" y="2" width="19" height="10" rx="1.5" />
          <rect x="25" y="4" width="2" height="6" rx="1" />
        </svg>
      </div>
    </div>
  );
}

export type { StatusBarProps };
