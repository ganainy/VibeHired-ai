import React from 'react';

export type BadgeVariant = 'gold' | 'jade' | 'rose' | 'ember' | 'ink';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
}

/**
 * Unified Badge component following Obsidian Intelligence design system.
 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({
    variant = 'gold',
    size = 'md',
    icon,
    className = '',
    children,
    ...props
  }, ref) => {
    const variantClass = `badge badge-${variant}`;

    const sizeClass = {
      sm: 'text-[0.6875rem] px-2 py-0.5',
      md: '',
      lg: 'text-sm px-3 py-1',
    }[size];

    return (
      <span
        ref={ref}
        className={`${variantClass} ${sizeClass} ${className}`.trim()}
        {...props}
      >
        {icon && <span className="flex items-center">{icon}</span>}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';
