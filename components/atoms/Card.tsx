import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick,
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const hoverClass = hover ? 'hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer' : '';
  const clickableClass = onClick ? 'cursor-pointer' : '';

  return (
    <div
      className={`bg-white rounded-xl shadow-md ${paddingClasses[padding]} ${hoverClass} ${clickableClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export interface SelectableCardProps extends CardProps {
  selected?: boolean;
  onSelect?: () => void;
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

export const SelectableCard: React.FC<SelectableCardProps> = ({
  selected = false,
  onSelect,
  icon,
  title,
  description,
  className = '',
}) => {
  return (
    <Card
      className={`border-2 transition-all ${
        selected
          ? 'border-primary-500 bg-primary-50'
          : 'border-neutral-200 hover:border-primary-300'
      } ${className}`}
      padding="md"
      onClick={onSelect}
      hover
    >
      <div className="flex items-start gap-3">
        {icon && (
          <div className={`flex-shrink-0 ${selected ? 'text-primary-600' : 'text-neutral-600'}`}>
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h3 className={`font-semibold ${selected ? 'text-primary-900' : 'text-neutral-900'}`}>
            {title}
          </h3>
          {description && (
            <p className={`text-sm mt-1 ${selected ? 'text-primary-700' : 'text-neutral-600'}`}>
              {description}
            </p>
          )}
        </div>
        {selected && (
          <svg className="w-6 h-6 text-primary-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </Card>
  );
};
