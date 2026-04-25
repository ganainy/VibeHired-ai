import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

/**
 * Unified Select component following Obsidian Intelligence design system.
 */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      icon,
      id,
      className = '',
      containerClassName = 'w-full',
      children,
      ...props
    },
    ref
  ) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    const errorClasses = error
      ? 'border-[color:var(--rose)] focus:border-[color:var(--rose)] focus:shadow-[0_0_0_3px_rgba(200,32,20,0.15)]'
      : '';

    const iconPadding = icon ? 'pl-10' : '';

    return (
      <div className={containerClassName}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[color:var(--text-primary)] mb-2"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)]">
              {icon}
            </span>
          )}
          <select
            ref={ref}
            id={inputId}
            className={`input-base ${iconPadding} ${errorClasses} ${className}`.trim()}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            {...props}
          >
            {children}
          </select>
        </div>
        {error ? (
          <p id={errorId} className="mt-2 text-sm text-[color:var(--rose)]">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="mt-2 text-sm text-[color:var(--text-muted)]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
