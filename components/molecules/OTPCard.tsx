'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '../atoms/Card';
import { ClockIcon } from '../atoms/Icons';
import { TOTPManager } from '@/lib/otp/totp-manager';

export interface OTPCardProps {
  service: string;
  secret: string;
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512';
  digits?: number;
  period?: number;
  icon?: React.ReactNode;
}

export const OTPCard: React.FC<OTPCardProps> = ({
  service,
  secret,
  algorithm = 'SHA1',
  digits = 6,
  period = 30,
  icon,
}) => {
  const [code, setCode] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(30);

  useEffect(() => {
    const updateCode = () => {
      try {
        const newCode = TOTPManager.generateCode({
          id: service,
          service,
          secret,
          algorithm,
          digits,
          period,
        });
        setCode(newCode);
      } catch (error) {
        console.error('Failed to generate OTP code:', error);
      }
    };

    updateCode();
    const interval = setInterval(updateCode, 1000);
    return () => clearInterval(interval);
  }, [service, secret, algorithm, digits, period]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(TOTPManager.getTimeRemaining(period));
    }, 100);
    return () => clearInterval(interval);
  }, [period]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
  };

  const progressPercentage = (timeRemaining / period) * 100;

  return (
    <Card padding="md" hover onClick={copyToClipboard}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon && <div className="text-neutral-600">{icon}</div>}
          <div>
            <h3 className="font-semibold text-neutral-900">{service}</h3>
            <p className="text-2xl font-mono font-bold text-primary-600 mt-1 tracking-wider">
              {code || '------'}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-neutral-200"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className={timeRemaining < 10 ? 'text-danger-500' : 'text-primary-500'}
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressPercentage / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-sm font-semibold ${timeRemaining < 10 ? 'text-danger-600' : 'text-neutral-700'}`}>
                {timeRemaining}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
