'use client';

import React, { useState, useEffect } from 'react';
import { WebAuthnManager } from '@/lib/auth/webauthn';

export interface PasskeyButtonProps {
  /** Button text */
  children?: React.ReactNode;
  /** Called when passkey action completes successfully */
  onSuccess?: (data: any) => void;
  /** Called when passkey action fails */
  onError?: (error: Error) => void;
  /** Type of action - register or authenticate */
  mode?: 'register' | 'authenticate';
  /** User info for registration */
  userId?: string;
  userName?: string;
  userDisplayName?: string;
  /** Allowed credentials for authentication */
  allowedCredentials?: string[];
  /** Show loading state */
  loading?: boolean;
  /** Disable button */
  disabled?: boolean;
  /** Additional className */
  className?: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline';
  /** Full width button */
  fullWidth?: boolean;
}

export const PasskeyButton: React.FC<PasskeyButtonProps> = ({
  children,
  onSuccess,
  onError,
  mode = 'authenticate',
  userId,
  userName,
  userDisplayName,
  allowedCredentials,
  loading: externalLoading,
  disabled,
  className = '',
  variant = 'primary',
  fullWidth = false,
}) => {
  const [isSupported, setIsSupported] = useState(false);
  const [isPlatformAvailable, setIsPlatformAvailable] = useState(false);
  const [internalLoading, setInternalLoading] = useState(false);

  const loading = externalLoading || internalLoading;

  useEffect(() => {
    const checkSupport = async () => {
      // Check if WebAuthn is supported
      const supported = typeof window !== 'undefined' &&
        window.PublicKeyCredential !== undefined &&
        typeof window.PublicKeyCredential === 'function';
      setIsSupported(supported);

      // Check platform authenticator availability
      if (supported) {
        try {
          const platformAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setIsPlatformAvailable(platformAvailable);
        } catch {
          setIsPlatformAvailable(false);
        }
      }
    };
    checkSupport();
  }, []);

  const handleClick = async () => {
    if (!isSupported) {
      onError?.(new Error('WebAuthn is not supported on this device'));
      return;
    }

    setInternalLoading(true);

    try {
      if (mode === 'register') {
        if (!userId || !userName) {
          throw new Error('User ID and username are required for registration');
        }
        const credential = await WebAuthnManager.registerPasskey(
          userId,
          userName,
          userDisplayName || userName
        );
        onSuccess?.(credential);
      } else {
        const assertion = await WebAuthnManager.authenticateWithPasskey(allowedCredentials);
        onSuccess?.(assertion);
      }
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setInternalLoading(false);
    }
  };

  const variantClasses = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 active:bg-primary-800',
    secondary: 'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 focus:ring-neutral-400 active:bg-neutral-300',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500',
  };

  const BiometricIcon = () => (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
    </svg>
  );

  const LoadingSpinner = () => (
    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );

  const buttonContent = (
    <>
      <span className="mr-2">
        {loading ? <LoadingSpinner /> : <BiometricIcon />}
      </span>
      {children || (mode === 'register'
        ? (isPlatformAvailable ? 'Set up Passkey' : 'Set up Security Key')
        : (isPlatformAvailable ? 'Sign in with Passkey' : 'Sign in with Security Key')
      )}
    </>
  );

  if (!isSupported) {
    return (
      <button
        disabled
        className={`
          inline-flex items-center justify-center
          px-4 py-3 rounded-xl font-medium
          bg-neutral-100 text-neutral-400 cursor-not-allowed
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
      >
        <span className="mr-2">
          <BiometricIcon />
        </span>
        Passkey not supported
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center
        px-4 py-3 rounded-xl font-medium
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      {buttonContent}
    </button>
  );
};

export default PasskeyButton;
