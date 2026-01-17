'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface FormErrors {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}

const AFRICAN_COUNTRIES = [
  'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Egypt', 'Morocco', 'Ethiopia',
  'Tanzania', 'Uganda', 'Rwanda', 'Senegal', 'Ivory Coast', 'Cameroon',
  'Zimbabwe', 'Mozambique', 'Zambia', 'Botswana', 'Namibia', 'Mauritius',
];

export default function OnboardingStep3Page() {
  const router = useRouter();
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
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

  const validateStreet = (value: string): string | undefined => {
    if (!value.trim()) return 'Street address is required';
    if (value.trim().length < 5) return 'Please enter a valid street address';
    return undefined;
  };

  const validateCity = (value: string): string | undefined => {
    if (!value.trim()) return 'City is required';
    return undefined;
  };

  const validatePostalCode = (value: string): string | undefined => {
    if (!value.trim()) return 'Postal code is required';
    return undefined;
  };

  const validateCountry = (value: string): string | undefined => {
    if (!value) return 'Country is required';
    return undefined;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {
      street: validateStreet(street),
      city: validateCity(city),
      postalCode: validatePostalCode(postalCode),
      country: validateCountry(country),
    };
    setErrors(newErrors);
    return Object.values(newErrors).every((e) => !e);
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    switch (field) {
      case 'street':
        setErrors((prev) => ({ ...prev, street: validateStreet(street) }));
        break;
      case 'city':
        setErrors((prev) => ({ ...prev, city: validateCity(city) }));
        break;
      case 'postalCode':
        setErrors((prev) => ({ ...prev, postalCode: validatePostalCode(postalCode) }));
        break;
      case 'country':
        setErrors((prev) => ({ ...prev, country: validateCountry(country) }));
        break;
    }
  };

  const handleNext = () => {
    setTouched({ street: true, city: true, postalCode: true, country: true });
    if (!validateForm()) return;

    setLoading(true);
    localStorage.setItem('myid_onboarding_step3', JSON.stringify({
      street, city, postalCode, country,
    }));

    setTimeout(() => {
      router.push('/onboarding/step-4');
    }, 300);
  };

  const handleBack = () => {
    router.push('/onboarding/step-2');
  };

  const progress = (3 / 9) * 100;

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
            <h1 className="text-xl font-bold text-black">Address Details</h1>
            <p className="text-sm text-[#8E8E93]">Step 3 of 9</p>
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-black">Residential Address</h2>
              <p className="text-sm text-[#8E8E93]">Enter your current address</p>
            </div>
          </div>

          {/* Street Address */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-black mb-1.5">Street Address</label>
            <input
              type="text"
              value={street}
              onChange={(e) => {
                setStreet(e.target.value);
                if (touched.street) {
                  setErrors((prev) => ({ ...prev, street: validateStreet(e.target.value) }));
                }
              }}
              onBlur={() => handleBlur('street')}
              placeholder="123 Main Street, Apt 4B"
              className={`w-full px-4 py-3.5 bg-[#F2F2F7] border rounded-xl text-base text-black placeholder:text-[#8E8E93] focus:outline-none focus:bg-white transition-colors ${
                touched.street && errors.street
                  ? 'border-red-500'
                  : 'border-transparent focus:border-[#007AFF]'
              }`}
            />
            {touched.street && errors.street && (
              <p className="mt-1 text-sm text-red-500">{errors.street}</p>
            )}
          </div>

          {/* City */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-black mb-1.5">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                if (touched.city) {
                  setErrors((prev) => ({ ...prev, city: validateCity(e.target.value) }));
                }
              }}
              onBlur={() => handleBlur('city')}
              placeholder="Lagos"
              className={`w-full px-4 py-3.5 bg-[#F2F2F7] border rounded-xl text-base text-black placeholder:text-[#8E8E93] focus:outline-none focus:bg-white transition-colors ${
                touched.city && errors.city
                  ? 'border-red-500'
                  : 'border-transparent focus:border-[#007AFF]'
              }`}
            />
            {touched.city && errors.city && (
              <p className="mt-1 text-sm text-red-500">{errors.city}</p>
            )}
          </div>

          {/* Postal Code */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-black mb-1.5">Postal Code</label>
            <input
              type="text"
              value={postalCode}
              onChange={(e) => {
                setPostalCode(e.target.value);
                if (touched.postalCode) {
                  setErrors((prev) => ({ ...prev, postalCode: validatePostalCode(e.target.value) }));
                }
              }}
              onBlur={() => handleBlur('postalCode')}
              placeholder="100001"
              className={`w-full px-4 py-3.5 bg-[#F2F2F7] border rounded-xl text-base text-black placeholder:text-[#8E8E93] focus:outline-none focus:bg-white transition-colors ${
                touched.postalCode && errors.postalCode
                  ? 'border-red-500'
                  : 'border-transparent focus:border-[#007AFF]'
              }`}
            />
            {touched.postalCode && errors.postalCode && (
              <p className="mt-1 text-sm text-red-500">{errors.postalCode}</p>
            )}
          </div>

          {/* Country */}
          <div>
            <label className="block text-sm font-medium text-black mb-1.5">Country</label>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                if (touched.country) {
                  setErrors((prev) => ({ ...prev, country: validateCountry(e.target.value) }));
                }
              }}
              onBlur={() => handleBlur('country')}
              className={`w-full px-4 py-3.5 bg-[#F2F2F7] border rounded-xl text-base text-black focus:outline-none focus:bg-white transition-colors appearance-none ${
                touched.country && errors.country
                  ? 'border-red-500'
                  : 'border-transparent focus:border-[#007AFF]'
              } ${!country ? 'text-[#8E8E93]' : ''}`}
            >
              <option value="">Select your country</option>
              {AFRICAN_COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {touched.country && errors.country && (
              <p className="mt-1 text-sm text-red-500">{errors.country}</p>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-[#007AFF]/5 border border-[#007AFF]/20 rounded-xl p-4">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-[#007AFF] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm text-[#007AFF] font-medium mb-1">Privacy Protected</p>
              <p className="text-sm text-[#8E8E93]">
                Your address is encrypted and stored securely. It will only be shared with your explicit consent.
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
