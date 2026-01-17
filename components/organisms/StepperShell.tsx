'use client';

import React from 'react';
import { ProgressIndicator } from '../atoms/ProgressIndicator';
import { Button } from '../atoms/Button';

export interface StepperShellProps {
  currentStep: number;
  totalSteps: number;
  title: string;
  description?: string;
  children: React.ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
}

export const StepperShell: React.FC<StepperShellProps> = ({
  currentStep,
  totalSteps,
  title,
  description,
  children,
  onNext,
  onBack,
  nextLabel = 'Continue',
  backLabel = 'Back',
  nextDisabled = false,
  loading = false,
}) => {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <div className="bg-white shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <ProgressIndicator current={currentStep} total={totalSteps} />
        </div>
      </div>

      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">{title}</h1>
          {description && (
            <p className="text-neutral-600">{description}</p>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          {children}
        </div>

        <div className="flex gap-4">
          {onBack && currentStep > 1 && (
            <Button
              variant="secondary"
              onClick={onBack}
              disabled={loading}
            >
              {backLabel}
            </Button>
          )}
          {onNext && (
            <Button
              variant="primary"
              fullWidth={!onBack || currentStep === 1}
              onClick={onNext}
              disabled={nextDisabled || loading}
              loading={loading}
            >
              {nextLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
