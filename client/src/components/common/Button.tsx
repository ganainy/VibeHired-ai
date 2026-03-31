import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

/**
 * Unified Button component following Obsidian Intelligence design system.
 * Replaces ad-hoc button styling across the codebase.
 *
 * @example
 * // Primary button
 * <Button onClick={handleClick}>Save Changes</Button>
 *
 * @example
 * // Secondary with icon
 * <Button variant="secondary" size="sm" icon={<EditIcon />}>
 *   Edit
 * </Button>
 *
 * @example
 * // Danger button (destructive action)
 * <Button variant="danger">Delete</Button>
 *
 * @example
 * // Loading state
 * <Button isLoading>Processing...</Button>
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconPosition = 'left',
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    // Base class from @layer components in index.css
    const variantClass = `btn btn-${variant}`;

    // Size-based padding and text
    const sizeClass = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-2 text-sm',
      lg: 'px-4 py-3 text-base',
    }[size];

    // Loading state styling
    const loadingClass = isLoading ? 'opacity-60 cursor-wait' : '';

    return (
      <button
        ref={ref}
        className={`${variantClass} ${sizeClass} ${loadingClass} ${className}`.trim()}
        disabled={disabled || isLoading}
        {...props}
      >
        <span className="flex items-center justify-center gap-2">
          {icon && iconPosition === 'left' && <span>{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span>{icon}</span>}
          {isLoading && (
            <span
              className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
              aria-hidden="true"
            />
          )}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
