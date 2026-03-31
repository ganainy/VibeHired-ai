import React from 'react';

export type CardVariant = 'default' | 'elevated' | 'nested';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  hoverable?: boolean;
}

/**
 * Unified Card component following Obsidian Intelligence design system.
 */
export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      hoverable = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const variantClass = {
      default: 'card',
      elevated: 'card-elevated',
      nested: 'card-nested',
    }[variant];

    const paddingClass =
      variant === 'nested'
        ? ''
        : {
            none: 'p-0',
            sm: 'p-3',
            md: 'p-4',
            lg: 'p-6',
          }[padding];

    const hoverClass = hoverable ? 'transition-shadow hover:shadow-[0_6px_24px_rgba(0,0,0,0.5)]' : '';

    return (
      <div
        ref={ref}
        className={`${variantClass} ${paddingClass} ${hoverClass} ${className}`.trim()}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
