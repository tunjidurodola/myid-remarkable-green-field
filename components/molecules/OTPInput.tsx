'use client';

import React, { useRef, useEffect, useCallback } from 'react';

export interface OTPInputProps {
  /** Number of digits in the OTP */
  length?: number;
  /** Current value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Error message */
  error?: string;
  /** Auto-focus the first input on mount */
  autoFocus?: boolean;
  /** Disable all inputs */
  disabled?: boolean;
  /** Called when all digits are entered */
  onComplete?: (value: string) => void;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show as password type */
  masked?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  value,
  onChange,
  error,
  autoFocus = true,
  disabled = false,
  onComplete,
  size = 'md',
  masked = false,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const sizeClasses = {
    sm: 'w-10 h-10 text-lg',
    md: 'w-12 h-12 text-xl',
    lg: 'w-14 h-14 text-2xl',
  };

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    // Call onComplete when all digits are entered
    if (value.length === length && onComplete) {
      onComplete(value);
    }
  }, [value, length, onComplete]);

  const focusInput = useCallback((index: number) => {
    if (index >= 0 && index < length) {
      inputRefs.current[index]?.focus();
    }
  }, [length]);

  const handleChange = useCallback((index: number, digit: string) => {
    // Only allow digits
    if (!/^\d*$/.test(digit)) return;

    const newValue = value.split('');

    if (digit.length === 1) {
      // Single digit entered
      newValue[index] = digit;
      onChange(newValue.join(''));

      // Auto-advance to next input
      if (digit && index < length - 1) {
        focusInput(index + 1);
      }
    } else if (digit.length === length) {
      // Pasted full OTP
      onChange(digit);
      focusInput(length - 1);
    } else if (digit.length > 1) {
      // Pasted partial OTP
      const pastedDigits = digit.slice(0, length - index);
      for (let i = 0; i < pastedDigits.length; i++) {
        newValue[index + i] = pastedDigits[i];
      }
      onChange(newValue.join(''));
      focusInput(Math.min(index + pastedDigits.length, length - 1));
    }
  }, [value, onChange, length, focusInput]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const newValue = value.split('');

      if (value[index]) {
        // Clear current digit
        newValue[index] = '';
        onChange(newValue.join(''));
      } else if (index > 0) {
        // Move to previous and clear
        newValue[index - 1] = '';
        onChange(newValue.join(''));
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusInput(index + 1);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      const newValue = value.split('');
      newValue[index] = '';
      onChange(newValue.join(''));
    }
  }, [value, onChange, focusInput]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (pastedData) {
      onChange(pastedData);
      focusInput(Math.min(pastedData.length, length - 1));
    }
  }, [onChange, length, focusInput]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 justify-center" role="group" aria-label="OTP input">
        {Array.from({ length }).map((_, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type={masked ? 'password' : 'text'}
            inputMode="numeric"
            pattern="\d*"
            maxLength={length}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={handleFocus}
            disabled={disabled}
            aria-label={`Digit ${index + 1}`}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            className={`
              ${sizeClasses[size]}
              text-center font-semibold font-mono
              border-2 rounded-lg
              focus:outline-none focus:ring-2
              transition-all duration-200
              ${disabled ? 'bg-neutral-100 cursor-not-allowed opacity-50' : 'bg-white'}
              ${error
                ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
                : value[index]
                  ? 'border-primary-500 focus:border-primary-600 focus:ring-primary-500/20'
                  : 'border-neutral-300 focus:border-primary-500 focus:ring-primary-500/20'
              }
            `}
          />
        ))}
      </div>
      {error && (
        <p className="text-center text-sm text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default OTPInput;
