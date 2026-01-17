'use client';

import React from 'react';
import { Card } from '../atoms/Card';

export interface StatCardProps {
  /** Stat title/label */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional description or subtitle */
  description?: string;
  /** Icon to display */
  icon?: React.ReactNode;
  /** Color theme */
  theme?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  /** Change indicator (positive/negative percentage) */
  change?: {
    value: number;
    label?: string;
  };
  /** Click handler */
  onClick?: () => void;
  /** Additional className */
  className?: string;
  /** Loading state */
  loading?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  theme = 'default',
  change,
  onClick,
  className = '',
  loading = false,
}) => {
  const themeClasses = {
    default: {
      bg: 'bg-white',
      icon: 'bg-neutral-100 text-neutral-600',
      value: 'text-neutral-900',
    },
    primary: {
      bg: 'bg-primary-50',
      icon: 'bg-primary-100 text-primary-600',
      value: 'text-primary-900',
    },
    success: {
      bg: 'bg-success-50',
      icon: 'bg-success-100 text-success-600',
      value: 'text-success-900',
    },
    warning: {
      bg: 'bg-amber-50',
      icon: 'bg-amber-100 text-amber-600',
      value: 'text-amber-900',
    },
    danger: {
      bg: 'bg-danger-50',
      icon: 'bg-danger-100 text-danger-600',
      value: 'text-danger-900',
    },
  };

  const colors = themeClasses[theme];

  if (loading) {
    return (
      <Card className={`${colors.bg} ${className}`} onClick={onClick} hover={!!onClick}>
        <div className="animate-pulse space-y-3">
          <div className="flex items-start justify-between">
            <div className="h-4 bg-neutral-200 rounded w-24" />
            {icon && <div className="h-10 w-10 bg-neutral-200 rounded-lg" />}
          </div>
          <div className="h-8 bg-neutral-200 rounded w-16" />
          {description && <div className="h-3 bg-neutral-200 rounded w-32" />}
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`${colors.bg} ${className}`}
      onClick={onClick}
      hover={!!onClick}
      padding="md"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-600 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${colors.value}`}>{value}</p>
          {description && (
            <p className="text-sm text-neutral-500 mt-1">{description}</p>
          )}
          {change && (
            <div className="flex items-center mt-2 gap-1">
              <span
                className={`
                  text-sm font-medium flex items-center
                  ${change.value > 0 ? 'text-success-600' : change.value < 0 ? 'text-danger-600' : 'text-neutral-500'}
                `}
              >
                {change.value > 0 ? (
                  <svg className="w-4 h-4 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                ) : change.value < 0 ? (
                  <svg className="w-4 h-4 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : null}
                {Math.abs(change.value)}%
              </span>
              {change.label && (
                <span className="text-sm text-neutral-500">{change.label}</span>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className={`p-2.5 rounded-lg ${colors.icon}`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

export default StatCard;
