import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

/**
 * Unified Textarea component following Obsidian Intelligence design system.
 */
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      helperText,
      error,
      id,
      className = '',
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

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[color:var(--text-primary)] mb-2"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`input-base ${errorClasses} ${className}`.trim()}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...props}
        />
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

Textarea.displayName = 'Textarea';
