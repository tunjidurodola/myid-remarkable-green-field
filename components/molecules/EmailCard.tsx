'use client';

import React from 'react';
import { Card } from '../atoms/Card';

export interface EmailCardProps {
  /** Email address */
  email: string;
  /** Label/name for the email */
  label?: string;
  /** Trust status */
  status?: 'trusted' | 'pending' | 'unverified';
  /** When the email was added */
  addedAt?: Date;
  /** Primary email indicator */
  isPrimary?: boolean;
  /** Show verification badge */
  verified?: boolean;
  /** Click handler for the card */
  onClick?: () => void;
  /** Handler for remove action */
  onRemove?: () => void;
  /** Handler for verify action */
  onVerify?: () => void;
  /** Handler for set primary action */
  onSetPrimary?: () => void;
  /** Additional className */
  className?: string;
  /** Compact display mode */
  compact?: boolean;
}

export const EmailCard: React.FC<EmailCardProps> = ({
  email,
  label,
  status = 'trusted',
  addedAt,
  isPrimary = false,
  verified = true,
  onClick,
  onRemove,
  onVerify,
  onSetPrimary,
  className = '',
  compact = false,
}) => {
  const statusConfig = {
    trusted: {
      bg: 'bg-success-50',
      text: 'text-success-700',
      label: 'Trusted',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
    pending: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      label: 'Pending',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      ),
    },
    unverified: {
      bg: 'bg-neutral-100',
      text: 'text-neutral-600',
      label: 'Unverified',
      icon: (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  const config = statusConfig[status];

  const EmailIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  if (compact) {
    return (
      <div
        className={`
          flex items-center gap-3 p-3 rounded-lg
          ${onClick ? 'cursor-pointer hover:bg-neutral-50' : ''}
          ${className}
        `}
        onClick={onClick}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
          <EmailIcon />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-neutral-900 truncate">{email}</p>
          {label && <p className="text-xs text-neutral-500">{label}</p>}
        </div>
        {verified && (
          <div className={`flex-shrink-0 ${config.text}`}>
            {config.icon}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card
      className={`${className}`}
      onClick={onClick}
      hover={!!onClick}
      padding="none"
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Email Icon */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center">
            <EmailIcon />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-base font-medium text-neutral-900 truncate">{email}</p>
              {isPrimary && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">
                  Primary
                </span>
              )}
            </div>
            {label && (
              <p className="text-sm text-neutral-600 mb-1">{label}</p>
            )}
            <div className="flex items-center gap-3 text-sm">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
                {config.icon}
                {config.label}
              </span>
              {addedAt && (
                <span className="text-neutral-500">
                  Added {formatDate(addedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {(onRemove || onVerify || onSetPrimary) && (
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-neutral-100">
            {status === 'unverified' && onVerify && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onVerify();
                }}
                className="text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                Verify email
              </button>
            )}
            {!isPrimary && verified && onSetPrimary && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSetPrimary();
                }}
                className="text-sm font-medium text-neutral-600 hover:text-neutral-700"
              >
                Set as primary
              </button>
            )}
            {onRemove && !isPrimary && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
                className="text-sm font-medium text-danger-600 hover:text-danger-700 ml-auto"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default EmailCard;
