import React from 'react';

export interface ProgressIndicatorProps {
  current: number;
  total: number;
  showLabels?: boolean;
}

export const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  current,
  total,
  showLabels = true,
}) => {
  const percentage = (current / total) * 100;

  return (
    <div className="w-full">
      {showLabels && (
        <div className="flex justify-between text-sm text-neutral-600 mb-2">
          <span>Step {current} of {total}</span>
          <span>{Math.round(percentage)}%</span>
        </div>
      )}
      <div className="w-full bg-neutral-200 rounded-full h-2">
        <div
          className="bg-primary-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export interface StepperProps {
  steps: string[];
  currentStep: number;
}

export const Stepper: React.FC<StepperProps> = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <React.Fragment key={index}>
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                index < currentStep
                  ? 'bg-success-600 text-white'
                  : index === currentStep
                  ? 'bg-primary-600 text-white'
                  : 'bg-neutral-200 text-neutral-600'
              }`}
            >
              {index < currentStep ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <span className="text-xs mt-2 text-center max-w-[80px]">{step}</span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`flex-1 h-1 mx-2 ${
                index < currentStep ? 'bg-success-600' : 'bg-neutral-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
