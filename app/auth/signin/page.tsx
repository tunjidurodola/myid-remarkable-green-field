'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

interface FormErrors {
  email?: string;
  password?: string;
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  useEffect(() => {
    // Check if passkey authentication is available
    const checkPasskeySupport = async () => {
      if (typeof window !== 'undefined' && window.PublicKeyCredential) {
        try {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          setPasskeyAvailable(available);
        } catch {
          setPasskeyAvailable(false);
        }
      }
    };
    checkPasskeySupport();
  }, []);

  const validateEmail = (value: string): string | undefined => {
    if (!value) return 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return 'Please enter a valid email address';
    return undefined;
  };

  const validatePassword = (value: string): string | undefined => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(newErrors);
    return !newErrors.email && !newErrors.password;
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'email') {
      setErrors((prev) => ({ ...prev, email: validateEmail(email) }));
    } else {
      setErrors((prev) => ({ ...prev, password: validatePassword(password) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTouched({ email: true, password: true });

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Demo authentication - in production, this would call the API
      if (email && password) {
        localStorage.setItem('myid_session', JSON.stringify({
          email,
          timestamp: Date.now(),
          authMethod: 'password',
        }));

        if (rememberMe) {
          localStorage.setItem('myid_remember', email);
        } else {
          localStorage.removeItem('myid_remember');
        }

        router.push('/dashboard');
      } else {
        setError('Please enter email and password');
      }
    } catch (err) {
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    try {
      setLoading(true);
      setError('');

      // Import WebAuthn browser functions
      const { startAuthentication } = await import('@simplewebauthn/browser');

      // Get authentication options from server
      const optionsRes = await fetch('/api/auth/webauthn/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: null }), // discoverable credential
      });

      if (!optionsRes.ok) {
        throw new Error('Failed to get authentication options');
      }

      const { options, challenge } = await optionsRes.json();

      // Start WebAuthn authentication
      const credential = await startAuthentication(options);

      // Verify with server
      const verifyRes = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, challenge }),
      });

      const result = await verifyRes.json();

      if (result.verified) {
        // Store session
        localStorage.setItem('myid_session', JSON.stringify({
          email: result.user.email,
          name: result.user.name,
          timestamp: Date.now(),
          authMethod: 'passkey',
        }));
        router.push('/dashboard');
      } else {
        setError('Passkey authentication failed');
      }
    } catch (err: unknown) {
      console.error('Passkey sign-in error:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Passkey authentication was cancelled');
      } else {
        setError('Passkey authentication failed. Please try password login.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7] flex flex-col font-['Ubuntu',sans-serif]">
      {/* Status Bar */}
      <div className="h-11 bg-[#F2F2F7] flex justify-between items-center px-5 text-sm font-semibold text-black">
        <div className="flex items-center gap-1">
          <span>9:41</span>
        </div>
        <div className="flex items-center gap-1">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 21l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21z"/>
          </svg>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24">
        {/* Header */}
        <div className="text-center mt-8 mb-8">
          <Image
            src="/logo-light.png"
            alt="myID"
            width={120}
            height={40}
            className="mx-auto mb-6"
            priority
          />
          <h1 className="text-[28px] font-bold text-black mb-2">Welcome Back</h1>
          <p className="text-base text-[#8E8E93]">Sign in to your secure account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email Address */}
          <div className="mb-5">
            <label className="block text-base font-semibold text-black mb-2">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touched.email) {
                    setErrors((prev) => ({ ...prev, email: validateEmail(e.target.value) }));
                  }
                }}
                onBlur={() => handleBlur('email')}
                placeholder="you@example.com"
                autoComplete="email"
                className={`w-full px-4 pr-12 py-4 bg-white border rounded-xl text-base text-black placeholder:text-[#8E8E93] focus:outline-none transition-colors ${
                  touched.email && errors.email
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-[#C6C6C8] focus:border-[#007AFF]'
                }`}
              />
              <svg
                className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${
                  touched.email && errors.email ? 'text-red-500' : 'text-[#8E8E93]'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            {touched.email && errors.email && (
              <p className="mt-1.5 text-sm text-red-500">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="mb-5">
            <label className="block text-base font-semibold text-black mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (touched.password) {
                    setErrors((prev) => ({ ...prev, password: validatePassword(e.target.value) }));
                  }
                }}
                onBlur={() => handleBlur('password')}
                placeholder="Enter your password"
                autoComplete="current-password"
                className={`w-full px-4 pr-20 py-4 bg-white border rounded-xl text-base text-black placeholder:text-[#8E8E93] focus:outline-none transition-colors ${
                  touched.password && errors.password
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-[#C6C6C8] focus:border-[#007AFF]'
                }`}
              />
              <svg
                className={`absolute right-[45px] top-1/2 -translate-y-1/2 w-5 h-5 ${
                  touched.password && errors.password ? 'text-red-500' : 'text-[#8E8E93]'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8E8E93] hover:text-[#007AFF] transition-colors"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            {touched.password && errors.password && (
              <p className="mt-1.5 text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex justify-between items-center my-5">
            <label className="flex items-center gap-2 text-sm text-[#8E8E93] cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-[#C6C6C8] text-[#007AFF] focus:ring-[#007AFF]"
              />
              Remember me
            </label>
            <Link href="/auth/forgot-password" className="text-[#007AFF] no-underline text-sm font-semibold hover:underline">
              Forgot Password?
            </Link>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-5 flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-4 bg-[#007AFF] text-white rounded-xl text-base font-semibold cursor-pointer transition-all duration-200 hover:bg-[#0066CC] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mb-5 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Sign In
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center my-5">
            <div className="flex-1 h-px bg-[#C6C6C8]"></div>
            <span className="px-4 text-sm text-[#8E8E93]">or</span>
            <div className="flex-1 h-px bg-[#C6C6C8]"></div>
          </div>

          {/* Sign in with Passkey */}
          <button
            type="button"
            onClick={handlePasskeySignIn}
            disabled={loading || !passkeyAvailable}
            className="w-full px-4 py-4 bg-white border border-[#C6C6C8] rounded-xl text-base font-semibold text-black cursor-pointer mb-5 flex items-center justify-center gap-2 transition-all duration-200 hover:bg-[#F2F2F7] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
            </svg>
            Sign in with Passkey
          </button>

          {/* Footer Link */}
          <div className="text-center text-sm text-[#8E8E93]">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-[#007AFF] no-underline font-semibold hover:underline">
              Sign Up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
