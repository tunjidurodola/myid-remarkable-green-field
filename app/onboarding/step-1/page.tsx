'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface FormErrors {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
}

export default function OnboardingStep1Page() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
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
    // Load saved data from registration
    const registration = localStorage.getItem('myid_registration');
    if (registration) {
      try {
        const data = JSON.parse(registration);
        if (data.fullName) {
          const names = data.fullName.split(' ');
          setFirstName(names[0] || '');
          setLastName(names.slice(1).join(' ') || '');
        }
      } catch (e) {
        console.error('Failed to parse registration data');
      }
    }
  }, []);

  const validateFirstName = (value: string): string | undefined => {
    if (!value.trim()) return 'First name is required';
    if (value.trim().length < 2) return 'First name must be at least 2 characters';
    return undefined;
  };

  const validateLastName = (value: string): string | undefined => {
    if (!value.trim()) return 'Last name is required';
    if (value.trim().length < 2) return 'Last name must be at least 2 characters';
    return undefined;
  };

  const validateDateOfBirth = (value: string): string | undefined => {
    if (!value) return 'Date of birth is required';
    const date = new Date(value);
    const now = new Date();
    const age = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 18) return 'You must be at least 18 years old';
    if (age > 120) return 'Please enter a valid date of birth';
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      firstName: validateFirstName(firstName),
      lastName: validateLastName(lastName),
      dateOfBirth: validateDateOfBirth(dateOfBirth),
    };
    setErrors(newErrors);
    return Object.values(newErrors).every((e) => !e);
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    switch (field) {
      case 'firstName':
        setErrors((prev) => ({ ...prev, firstName: validateFirstName(firstName) }));
        break;
      case 'lastName':
        setErrors((prev) => ({ ...prev, lastName: validateLastName(lastName) }));
        break;
      case 'dateOfBirth':
        setErrors((prev) => ({ ...prev, dateOfBirth: validateDateOfBirth(dateOfBirth) }));
        break;
    }
  };

  const handleNext = () => {
    setTouched({ firstName: true, lastName: true, dateOfBirth: true });
    if (!validateForm()) return;

    setLoading(true);
    // Save to local storage
    localStorage.setItem('myid_onboarding_step1', JSON.stringify({
      firstName,
      lastName,
      dateOfBirth,
    }));

    setTimeout(() => {
      router.push('/onboarding/step-2');
    }, 300);
  };

  const handleBack = () => {
    router.push('/auth/signup');
  };

  const progress = (1 / 9) * 100;

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

      {/* Header with Progress */}
      <div className="bg-white px-5 pb-4 shadow-sm">
        {/* Back Button & Title */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 text-[#007AFF] hover:bg-[#F2F2F7] rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-black">Personal Information</h1>
            <p className="text-sm text-[#8E8E93]">Step 1 of 9</p>
          </div>
          <Image
            src="/myid-badge.png"
            alt="myID"
            width={32}
            height={32}
            className="h-8 w-auto"
          />
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-[#E5E5EA] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#007AFF] rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[#007AFF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-black">Legal Name</h2>
              <p className="text-sm text-[#8E8E93]">Enter your name as it appears on your ID</p>
            </div>
          </div>

          {/* First Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-black mb-1.5">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (touched.firstName) {
                  setErrors((prev) => ({ ...prev, firstName: validateFirstName(e.target.value) }));
                }
              }}
              onBlur={() => handleBlur('firstName')}
              placeholder="Enter your first name"
              className={`w-full px-4 py-3.5 bg-[#F2F2F7] border rounded-xl text-base text-black placeholder:text-[#8E8E93] focus:outline-none focus:bg-white transition-colors ${
                touched.firstName && errors.firstName
                  ? 'border-red-500'
                  : 'border-transparent focus:border-[#007AFF]'
              }`}
            />
            {touched.firstName && errors.firstName && (
              <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-black mb-1.5">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                if (touched.lastName) {
                  setErrors((prev) => ({ ...prev, lastName: validateLastName(e.target.value) }));
                }
              }}
              onBlur={() => handleBlur('lastName')}
              placeholder="Enter your last name"
              className={`w-full px-4 py-3.5 bg-[#F2F2F7] border rounded-xl text-base text-black placeholder:text-[#8E8E93] focus:outline-none focus:bg-white transition-colors ${
                touched.lastName && errors.lastName
                  ? 'border-red-500'
                  : 'border-transparent focus:border-[#007AFF]'
              }`}
            />
            {touched.lastName && errors.lastName && (
              <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
            )}
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-sm font-medium text-black mb-1.5">Date of Birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => {
                setDateOfBirth(e.target.value);
                if (touched.dateOfBirth) {
                  setErrors((prev) => ({ ...prev, dateOfBirth: validateDateOfBirth(e.target.value) }));
                }
              }}
              onBlur={() => handleBlur('dateOfBirth')}
              max={new Date(Date.now() - 18 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
              className={`w-full px-4 py-3.5 bg-[#F2F2F7] border rounded-xl text-base text-black placeholder:text-[#8E8E93] focus:outline-none focus:bg-white transition-colors ${
                touched.dateOfBirth && errors.dateOfBirth
                  ? 'border-red-500'
                  : 'border-transparent focus:border-[#007AFF]'
              }`}
            />
            {touched.dateOfBirth && errors.dateOfBirth && (
              <p className="mt-1 text-sm text-red-500">{errors.dateOfBirth}</p>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-[#007AFF]/5 border border-[#007AFF]/20 rounded-xl p-4 mb-6">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-[#007AFF] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-[#007AFF] font-medium mb-1">Why we need this</p>
              <p className="text-sm text-[#8E8E93]">
                Your legal name will be verified against your government-issued ID document in the next steps.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="bg-white px-5 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
        <button
          onClick={handleNext}
          disabled={loading}
          className="w-full py-4 bg-[#007AFF] text-white rounded-xl text-base font-semibold transition-all duration-200 hover:bg-[#0066CC] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>
              Continue
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
